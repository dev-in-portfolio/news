// Acquire reduced-size full-page images for Hoosier State Chronicles records
// from the archive's own OpenSeadragon tile service.
//
// Why tiles: full-page downloads on newspapers.library.in.gov require a free
// account login, and the site caps each tile at 256x256. But the viewer's tile
// endpoint is public once the Cloudflare Turnstile check has issued a per-
// document access code:
//   ?a=is&type=pagetileimage&crth=...&vac=...&oid=<doc>.<page>&width=256&crop=x,y,w,h
// The tokens come from ?a=da&command=getViewerAccessCode, which needs a live
// Turnstile response, so one real Chrome page load per DOCUMENT is required
// (tokens are bound to the document, not the page). Tiles for every page of
// that document can then be fetched with plain HTTP.
//
// We request a 4-column grid of square cells, each returned at 256 px, and
// stitch them into a ~1024-px-wide full-page rendition. This is a reduced-size
// access rendition of the archive's scan, assembled only from the archive's
// own pixels. Nothing is generated, retouched, or upscaled beyond the tile
// service's own 256-px cap.
//
// Usage:
//   node scripts/acquire_indiana_mosaics.js [--only HN-704,HN-705] [--limit N] [--dry]
//   node scripts/acquire_indiana_mosaics.js --retry-failed
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'INDIANA_MOSAIC_LEDGER.json');
const SESSION_PATH = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-session.json';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-mosaics';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-profile3';
const PORT = 9354;
const E = '&e=-------en-20--1--txt-txIN-------';
const PROVIDER = 'Hoosier State Chronicles (Indiana State Library)';
const TILE = 256;
const COLS = 4;

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const LIMIT = argVal('--limit') ? Number(argVal('--limit')) : Infinity;
const DRY = args.includes('--dry');
const RETRY = args.includes('--retry-failed');

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function decodeEntities(v) {
  return v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// ---------- work list ----------
const hnUrls = readJsonIf(path.join(ROOT, 'scripts', 'hn_urls.json')) || {};
const images = readJsonIf(path.join(ROOT, 'site', 'data', 'images.json')) || {};
const records = readJsonIf(path.join(ROOT, 'site', 'data', 'records.json'));
const recArr = Array.isArray(records) ? records : (records.records || Object.values(records));
const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

const withImage = new Set(Object.keys(images));
const missing = recArr.filter(r => !withImage.has(r.hn_id));

// A cited URL's suffix is a SECTION id, not a page key. The archive viewer maps
// a section (e.g. 2.6) to the page that actually holds it (e.g. 1.2). Group by
// document + section, then resolve the real page from the viewer before render.
// doc -> { doc, sections: Map(sectionId -> [{hn, url}]) }
const docs = new Map();
for (const r of missing) {
  if (ONLY && !ONLY.has(r.hn_id)) continue;
  const urls = (hnUrls[r.hn_id] || []).map(u => String(u).replace(/&amp;/g, '&'));
  for (const url of urls) {
    if (!/newspapers\.library\.in\.gov/i.test(url)) continue;
    let d;
    try { d = new URL(url).searchParams.get('d'); } catch (e) { continue; }
    if (!d) continue;
    const m = d.match(/^([A-Za-z0-9]+?-?\d{8}(?:-\d+)?)\.(\d+)\.(\d+)$/);
    if (!m) continue;
    const doc = m[1];
    const section = m[2] + '.' + m[3];
    if (!docs.has(doc)) docs.set(doc, { doc, sections: new Map() });
    const secs = docs.get(doc).sections;
    if (!secs.has(section)) secs.set(section, []);
    const list = secs.get(section);
    if (!list.some(x => x.hn === r.hn_id)) list.push({ hn: r.hn_id, url });
  }
}

let docList = [...docs.values()].sort((a, b) => a.doc.localeCompare(b.doc));
if (LIMIT !== Infinity) docList = docList.slice(0, LIMIT);

const sectionTotal = docList.reduce((n, d) => n + d.sections.size, 0);
const recTotal = new Set([...docs.values()].flatMap(d => [...d.sections.values()].flat().map(x => x.hn))).size;
console.log(`Missing records with Indiana page URLs: ${recTotal}`);
console.log(`Documents to load: ${docList.length}   cited sections to resolve: ${sectionTotal}`);

// Skip already-done pages. By default failed and unavailable pages are both
// retried (unavailable may become available after an archive re-scan). With
// --retry-failed only ledger entries explicitly marked failed are retried, so
// a quick retry does not re-walk every page the viewer reports as absent.
function alreadyDone(hn, url) {
  const e = ledger.items[hn + '|' + url];
  if (!e) return false;
  if (e.status === 'page_mosaic_acquired') return true;
  if (RETRY) return e.status !== 'failed';
  return false;
}
for (const d of docList) {
  for (const [section, list] of d.sections) {
    const keep = list.filter(x => !alreadyDone(x.hn, x.url));
    if (keep.length) d.sections.set(section, keep); else d.sections.delete(section);
  }
}
docList = docList.filter(d => d.sections.size);
console.log(`After resume filter: ${docList.length} documents, ${docList.reduce((n, d) => n + d.sections.size, 0)} sections`);
if (DRY) {
  for (const d of docList.slice(0, 30)) {
    console.log('  ' + d.doc + '  ' + [...d.sections.keys()].join(' '));
  }
  process.exit(0);
}

// ---------- HTTP ----------
const session = readJsonIf(SESSION_PATH) || {};
let cookies = { ua: session.ua || '', cookieHeader: session.cookieHeader || '' };

class ChallengeError extends Error {}
class UnavailableError extends Error {}

function httpHeaders(referer) {
  return {
    'User-Agent': cookies.ua,
    Cookie: cookies.cookieHeader,
    Accept: 'image/*,*/*',
    ...(referer ? { Referer: referer } : {}),
  };
}

async function getJpeg(url, dest, referer) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { headers: httpHeaders(referer), redirect: 'follow', signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      fs.writeFileSync(dest, buf);
      return buf.length;
    }
    const head = buf.slice(0, 400).toString('utf8');
    if (/Just a moment|security verification|Attention Required/i.test(head)) {
      lastErr = new ChallengeError('cloudflare challenge on tile');
    } else if (buf.slice(0, 3).toString() === 'GIF') {
      lastErr = new Error('blank 1x1 GIF tile (token rejected)');
    } else {
      lastErr = new Error('not a JPEG: ' + (head.replace(/\s+/g, ' ').slice(0, 80) || r.status));
    }
    await sleep(1200 * (attempt + 1));
  }
  throw lastErr;
}

// Parse the viewer's JSON payload from a document/section page.
function parseViewerData(html) {
  const marker = 'data-viewer-data-base-json=';
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const quote = html[i + marker.length];
  if (quote !== '"' && quote !== "'") return null;
  const start = i + marker.length + 1;
  const end = html.indexOf(quote, start);
  if (end < 0) return null;
  let raw = html.slice(start, end)
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// Resolve a cited section to the page the viewer places it on. Returns
// { pageId, area, sizes } or throws UnavailableError when the section has no
// placed area. This uses the plain HTTP session, not a browser tab.
async function resolveSectionPage(doc, section) {
  const url = 'https://newspapers.library.in.gov/?a=d&d=' + doc + '.' + section + E;
  const r = await fetch(url, {
    headers: { 'User-Agent': cookies.ua, Cookie: cookies.cookieHeader, Accept: 'text/html' },
    redirect: 'follow', signal: AbortSignal.timeout(90000),
  });
  const html = await r.text();
  if (/Just a moment|Performing security verification/i.test(html.slice(0, 4000))) {
    throw new ChallengeError('cloudflare challenge resolving section');
  }
  if (!r.ok) throw new UnavailableError('section page HTTP ' + r.status);
  const v = parseViewerData(html);
  if (!v) throw new UnavailableError('no viewer payload for section');
  const area = v.initialDisplayPageArea || null;
  if (!area || !area.pageID) throw new UnavailableError('section has no placed page area');
  return { pageId: area.pageID, area, sizes: v.pageImageSizes || {} };
}

function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}

// ---------- browser ----------
let browser, ctx;

async function launchBrowser() {
  const child = spawn(CHROME, [
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check', '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    await sleep(500);
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(2000) });
      if (r.ok) { up = true; break; }
    } catch (e) {}
  }
  if (!up) { child.kill(); throw new Error('Chrome CDP did not start'); }
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  ctx = browser.contexts()[0];
  return child;
}

async function refreshHttpIdentity(tab) {
  const list = await ctx.cookies('https://newspapers.library.in.gov');
  cookies.cookieHeader = list.map(c => c.name + '=' + c.value).join('; ');
  let ua = '';
  for (let i = 0; i < 6 && !ua; i++) {
    try { ua = await tab.evaluate(() => navigator.userAgent); } catch (e) { await sleep(1200); }
  }
  if (ua) cookies.ua = ua;
}

// Load one document in its own tab and capture the per-document tile tokens.
// A fresh tab gets a fresh Turnstile response; reusing or reloading an existing
// tab does not. Returns { token, viewer, tab, title }.
async function loadDocument(doc) {
  const tab = await ctx.newPage();
  tab.setDefaultTimeout(120000);
  let token = null;
  const onResponse = async (resp) => {
    if (token) return;
    if (!/command=getViewerAccessCode/.test(resp.url())) return;
    try {
      const t = await resp.text();
      const c = (t.match(/<CAPTCHAResponseTokenHashed>([^<]*)</) || [])[1];
      const v = (t.match(/<ViewerAccessCode>([^<]*)</) || [])[1];
      if (c && v) token = { crth: decodeEntities(c), vac: decodeEntities(v) };
    } catch (e) {}
  };
  const onRequest = (req) => {
    if (token) return;
    const u = req.url();
    if (!/type=pagetileimage/.test(u)) return;
    try {
      const q = new URL(u).searchParams;
      const c = q.get('crth'), v = q.get('vac');
      if (c && v) token = { crth: c, vac: v };
    } catch (e) {}
  };
  tab.on('response', onResponse);
  tab.on('request', onRequest);

  const viewerUrl = 'https://newspapers.library.in.gov/?a=d&d=' + doc + '.1.1' + E;
  await tab.goto(viewerUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

  const started = Date.now();
  let lastReload = 0;
  let title = '';
  while (!token && Date.now() - started < 120000) {
    title = await tab.title().catch(() => '');
    if (/just a moment|verification|attention required/i.test(title)) {
      await tab.bringToFront().catch(() => {});
    } else if (/^loading/i.test(title) && Date.now() - lastReload > 25000) {
      lastReload = Date.now();
      await tab.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await sleep(1500);
  }
  tab.off('response', onResponse);
  tab.off('request', onRequest);

  const viewer = await tab.evaluate(() => {
    try {
      const el = document.querySelector('#oseadinitialviewerdata');
      if (!el) return null;
      return JSON.parse(el.getAttribute('data-viewer-data-base-json'));
    } catch (e) { return null; }
  }).catch(() => null);

  const pageTitle = await tab.title().catch(() => '');
  return { token, viewer, tab, title: pageTitle || title, viewerUrl };
}

// ---------- one page ----------
async function renderPage(doc, pageKey, token, viewer, workDir) {
  const sizes = viewer && viewer.pageImageSizes;
  if (!sizes || !sizes[pageKey]) throw new UnavailableError('page not in viewer pageImageSizes');
  const W = sizes[pageKey].w, H = sizes[pageKey].h;
  if (!W || !H) throw new UnavailableError('zero page dimensions');

  // Partition the page into an exact grid: column boundaries and row boundaries
  // are computed from the page dimensions so no cell is degenerate (a naive
  // ceil(H/cell) can leave a 1-px final row).
  const cell = Math.ceil(W / COLS);
  const rows = Math.max(1, Math.round(H / cell));
  const colEdge = c => Math.round((c * W) / COLS);
  const rowEdge = r => Math.round((r * H) / rows);
  const oid = doc + '.' + pageKey;

  // Cached tiles are only valid for the grid they were fetched with. If the
  // grid changed (page size correction, algorithm change), wipe the cache so
  // we never stitch tiles cropped from a different partition.
  const sig = `${W}x${H}-${COLS}-${rows}`;
  const sigFile = path.join(workDir, '.grid');
  let prevSig = '';
  try { prevSig = fs.readFileSync(sigFile, 'utf8').trim(); } catch (e) {}
  if (prevSig !== sig) {
    for (const f of fs.readdirSync(workDir)) {
      if (/^tile-\d+-\d+\.jpg$/.test(f) || f === 'page.jpg') {
        try { fs.unlinkSync(path.join(workDir, f)); } catch (e) {}
      }
    }
    fs.writeFileSync(sigFile, sig);
  }

  const tiles = [];
  const rowHeights = [];
  for (let r = 0; r < rows; r++) {
    const y = rowEdge(r), y2 = rowEdge(r + 1), ch = y2 - y;
    const rowTiles = [];
    for (let c = 0; c < COLS; c++) {
      const x = colEdge(c), x2 = colEdge(c + 1), cw = x2 - x;
      if (cw <= 0 || ch <= 0) throw new Error('bad grid cell');
      const file = path.join(workDir, `tile-${r}-${c}.jpg`);
      const tw = TILE;
      const u = 'https://newspapers.library.in.gov/?a=is&type=pagetileimage' +
        '&crth=' + encodeURIComponent(token.crth) +
        '&vac=' + encodeURIComponent(token.vac) +
        '&oid=' + encodeURIComponent(oid) +
        '&width=' + TILE + '&crop=' + [x, y, cw, ch].join(',');
      if (!fs.existsSync(file)) {
        await getJpeg(u, file, 'https://newspapers.library.in.gov/?a=d&d=' + oid + E);
        await sleep(400);
      }
      let real = ffprobeSize(file);
      if (real.w < 8 || real.h < 8) {
        // A stale or truncated tile; drop it and fetch once more.
        try { fs.unlinkSync(file); } catch (e) {}
        await sleep(600);
        await getJpeg(u, file, 'https://newspapers.library.in.gov/?a=d&d=' + oid + E);
        await sleep(400);
        real = ffprobeSize(file);
      }
      if (real.w < 8 || real.h < 8) throw new Error('degenerate tile ' + real.w + 'x' + real.h);
      // Keep each tile's own aspect ratio at 256 px wide. Column widths differ
      // by a pixel or two after rounding, so heights differ too; the row is
      // padded to its tallest tile before hstack (white padding only).
      const th = Math.max(2, 2 * Math.round((TILE * real.h / real.w) / 2));
      rowTiles.push({ file, tw, th });
    }
    const rowH = rowTiles.reduce((m, t) => Math.max(m, t.th), 0);
    for (const t of rowTiles) { t.padH = rowH; tiles.push(t); }
    rowHeights.push(rowH);
  }

  const outW = TILE * COLS;
  const outH = rowHeights.reduce((n, h) => n + h, 0);
  const outFile = path.join(workDir, 'page.jpg');
  const inputs = [];
  const filters = [];
  tiles.forEach((t, i) => {
    inputs.push('-i', t.file);
    filters.push(`[${i}:v]scale=${t.tw}:${t.th},pad=${TILE}:${t.padH}:0:0:color=white[t${i}]`);
  });
  const rowLabels = [];
  for (let r = 0; r < rows; r++) {
    const labels = [];
    for (let c = 0; c < COLS; c++) labels.push(`[t${r * COLS + c}]`);
    filters.push(labels.join('') + `hstack=${COLS}[r${r}]`);
    rowLabels.push(`[r${r}]`);
  }
  filters.push(rowLabels.join('') + `vstack=${rows}[g]`);
  filters.push(`[g]crop=${outW}:${outH}:0:0[out]`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filters.join(';'),
    '-map', '[out]', '-q:v', '3', outFile], { stdio: 'pipe' });

  const dims = ffprobeSize(outFile);
  return { file: outFile, dims, source: { w: W, h: H }, tiles: tiles.length };
}

function issueDate(doc) {
  const m = doc.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

// ---------- main ----------
(async () => {
  const child = await launchBrowser();
  let done = 0, failedDocs = 0, unavailable = 0;

  for (let di = 0; di < docList.length; di++) {
    const d = docList[di];
    const tag = `[${di + 1}/${docList.length}] ${d.doc}`;
    let loaded;
    try {
      await sleep(800);
      loaded = await loadDocument(d.doc);
      await refreshHttpIdentity(loaded.tab);
    } catch (e) {
      console.log(`${tag}  LOAD FAIL  ${e.message}`);
      failedDocs++;
      continue;
    }

    if (!loaded.token) {
      console.log(`${tag}  no tile token (challenge or no viewer)  title="${(loaded.title || '').slice(0, 60)}"`);
      failedDocs++;
      for (const [section, list] of d.sections) {
        for (const x of list) {
          ledger.items[x.hn + '|' + x.url] = {
            hn_id: x.hn, provider: PROVIDER, status: 'failed', cited_section: section,
            page_url: x.url, error: 'no viewer access token', acquired_at: new Date().toISOString(),
          };
        }
      }
      fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
      await loaded.tab.close().catch(() => {});
      continue;
    }

    const sizes = (loaded.viewer && loaded.viewer.pageImageSizes) || {};
    const paper = decodeEntities((loaded.title || '').split(/\s+[\u2014-]\s+/)[0] || '').trim();
    const resolved = new Map(); // section -> { pageId, area } | { error, challenge }

    for (const [section, list] of d.sections) {
      let info = resolved.get(section);
      if (!info) {
        try {
          await sleep(400);
          info = await resolveSectionPage(d.doc, section);
        } catch (e) {
          info = { error: e.message, challenge: e instanceof ChallengeError };
        }
        resolved.set(section, info);
      }

      if (info.error || !sizes[info.pageId]) {
        const reason = info.error || 'page not in viewer pageImageSizes';
        console.log(`${tag}  section ${section} -> ${info.pageId || '?'}  UNAVAILABLE (${reason})`);
        unavailable += list.length;
        for (const x of list) {
          ledger.items[x.hn + '|' + x.url] = {
            hn_id: x.hn, provider: PROVIDER, status: 'page_unavailable',
            page_url: x.url, cited_section: section, page_key: info.pageId || null,
            error: reason, acquired_at: new Date().toISOString(),
          };
        }
        fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
        if (info.challenge) { failedDocs++; break; }
        continue;
      }

      const pageKey = info.pageId;
      for (const x of list) {
        const base = `hn-${x.hn.replace('HN-', '')}-in-${d.doc}-s${section.replace(/\./g, '-')}-p${pageKey.replace('.', '-')}-page`;
        const outName = base + '.jpg';
        const outPath = path.join(IMG_DIR, outName);
        const workDir = path.join(TMP, base);
        fs.mkdirSync(workDir, { recursive: true });
        const seq = Number((pageKey.split('.')[1] || pageKey.split('.')[0]));
        const entry = {
          hn_id: x.hn, provider: PROVIDER, status: 'pending', page_url: x.url,
          newspaper: paper, issue_date: issueDate(d.doc), page: seq,
          sequence: seq, document_oid: d.doc, page_key: pageKey, cited_section: section,
          section_area: info.area ? [info.area.x, info.area.y, info.area.w, info.area.h] : null,
          full_page_asset: null, full_page_dimensions: null, source_dimensions: null,
          mosaic_method: 'openseadragon_tiles_256', tile_count: 0, error: null, acquired_at: null,
        };
        try {
          const res = await renderPage(d.doc, pageKey, loaded.token, loaded.viewer, workDir);
          fs.copyFileSync(res.file, outPath);
          entry.full_page_asset = 'assets/images/' + outName;
          entry.full_page_dimensions = `${res.dims.w}x${res.dims.h}`;
          entry.source_dimensions = `${res.source.w}x${res.source.h}`;
          entry.tile_count = res.tiles;
          entry.status = 'page_mosaic_acquired';
          entry.acquired_at = new Date().toISOString();
          done++;
          console.log(`${tag}  section ${section} -> page ${pageKey}  OK  ${res.dims.w}x${res.dims.h} from ${res.source.w}x${res.source.h}  tiles=${res.tiles}  ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
        } catch (e) {
          entry.status = e instanceof UnavailableError ? 'page_unavailable' : 'failed';
          entry.error = e.message;
          console.log(`${tag}  section ${section} -> page ${pageKey}  FAIL  ${e.message}`);
          if (e instanceof ChallengeError) {
            // Cookies went stale mid-document; stop this document and move on.
            ledger.items[x.hn + '|' + x.url] = entry;
            fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
            failedDocs++;
            break;
          }
        }
        ledger.items[x.hn + '|' + x.url] = entry;
        ledger.generated_at = new Date().toISOString();
        fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
      }
    }
    await loaded.tab.close().catch(() => {});
  }

  await browser.close().catch(() => {});
  child.kill();

  const imgs = buildImages();
  console.log(`\nPages acquired: ${done}   Unavailable: ${unavailable}   Doc failures: ${failedDocs}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
  console.log('Wrote docs/INDIANA_MOSAIC_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
