// Acquire reduced-size full-page images for Virginia Chronicle records from the
// archive's own OpenSeadragon tile service.
//
// Virginia Chronicle runs the same Veridian viewer as Hoosier State Chronicles.
// Plain HTTP gets a Cloudflare 403, but a real Chrome page load issues the
// per-document tile tokens, after which tiles are public:
//   /?a=is&type=pagetileimage&crth=…&vac=…&oid=<doc>.<page>&width=256&crop=x,y,w,h
//
// Tiles are the archive's own pixels, stitched into a ~1024-px-wide rendition
// with white padding only. Nothing is generated, retouched, or upscaled.
//
// Usage:
//   node scripts/acquire_virginia_chronicle.js [--only HN-536,HN-597] [--limit N] [--dry]
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'VIRGINIA_CHRONICLE_MOSAIC_LEDGER.json');
const SESSION_PATH = 'C:/Users/dtoro/AppData/Local/Temp/opencode/vc-session.json';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/vc-mosaics';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/vc-profile';
const PORT = 9362;
const E = '&e=-------en-20--1--txt-txIN-------';
const PROVIDER = 'Virginia Chronicle (Library of Virginia)';
const HOST = 'https://www.virginiachronicle.com';
const TILE = 256;
const COLS = 4;

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const LIMIT = argVal('--limit') ? Number(argVal('--limit')) : Infinity;
const DRY = args.includes('--dry');

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

function readJson(p) { let raw = fs.readFileSync(p, 'utf8'); if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); return JSON.parse(raw); }
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const decodeEntities = v => String(v).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// ---------- work list ----------
const hnUrls = readJsonIf(path.join(ROOT, 'scripts', 'hn_urls.json')) || {};
const images = readJsonIf(path.join(ROOT, 'site', 'data', 'images.json')) || {};
const records = readJsonIf(path.join(ROOT, 'site', 'data', 'records.json'));
const recArr = Array.isArray(records) ? records : (records.records || Object.values(records));
const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

function coveredByStoredImage(hn, key) {
  for (const i of images[hn] || []) {
    const pu = String(i.page_url || '').replace(/&amp;/g, '&');
    if (pu.includes(key)) return true;
  }
  return false;
}

const RE = /virginiachronicle\.com\/\?a=d&d=([A-Za-z0-9]+?-?\d{8}(?:-\d+)?)\.(\d+)\.(\d+)/;
const docs = new Map(); // doc -> { doc, sections: Map(section -> [{hn,url}]) }
for (const r of recArr) {
  if (ONLY && !ONLY.has(r.hn_id)) continue;
  for (const raw of hnUrls[r.hn_id] || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    const m = u.match(RE);
    if (!m) continue;
    const doc = m[1], section = m[2] + '.' + m[3];
    if (coveredByStoredImage(r.hn_id, doc + '.' + section)) continue;
    if (!docs.has(doc)) docs.set(doc, { doc, sections: new Map() });
    const secs = docs.get(doc).sections;
    if (!secs.has(section)) secs.set(section, []);
    const list = secs.get(section);
    if (!list.some(x => x.hn === r.hn_id)) list.push({ hn: r.hn_id, url: u });
  }
}
let docList = [...docs.values()].sort((a, b) => a.doc.localeCompare(b.doc));
if (LIMIT !== Infinity) docList = docList.slice(0, LIMIT);
const recTotal = new Set([...docs.values()].flatMap(d => [...d.sections.values()].flat().map(x => x.hn))).size;
console.log(`Cited records with Virginia Chronicle page URLs: ${recTotal}`);
console.log(`Documents to load: ${docList.length}   cited sections to resolve: ${docList.reduce((n, d) => n + d.sections.size, 0)}`);
if (DRY) {
  for (const d of docList.slice(0, 30)) console.log('  ' + d.doc + '  ' + [...d.sections.keys()].join(' '));
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
    if (buf[0] === 0xFF && buf[1] === 0xD8) { fs.writeFileSync(dest, buf); return buf.length; }
    const head = buf.slice(0, 400).toString('utf8');
    if (/Just a moment|security verification|Attention Required/i.test(head)) lastErr = new ChallengeError('cloudflare challenge on tile');
    else if (buf.slice(0, 3).toString() === 'GIF') lastErr = new Error('blank 1x1 GIF tile (token rejected)');
    else lastErr = new Error('not a JPEG: ' + (head.replace(/\s+/g, ' ').slice(0, 80) || buf.length + 'B'));
    await sleep(1200);
  }
  throw lastErr;
}

// Virginia Chronicle's cf_clearance is tied to Chrome's TLS fingerprint, so a
// Node fetch is challenged even with the right cookies. Fetch each tile from
// inside the page instead and return it as base64.
async function getTileViaBrowser(tab, url, dest) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await tab.evaluate(async (u) => {
      try {
        const r = await fetch(u, { credentials: 'include' });
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (!(bytes[0] === 0xFF && bytes[1] === 0xD8)) {
          let head = '';
          try { head = new TextDecoder().decode(bytes.slice(0, 200)); } catch (e) {}
          return { ok: false, status: r.status, head };
        }
        let bin = '';
        const CH = 0x8000;
        for (let i = 0; i < bytes.length; i += CH) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        }
        return { ok: true, status: r.status, b64: btoa(bin) };
      } catch (e) { return { ok: false, status: 0, head: String(e) }; }
    }, url);
    if (res && res.ok) {
      const buf = Buffer.from(res.b64, 'base64');
      if (buf[0] === 0xFF && buf[1] === 0xD8) { fs.writeFileSync(dest, buf); return buf.length; }
      lastErr = new Error('tile not a JPEG after decode');
    } else {
      const head = String((res && res.head) || '').replace(/\s+/g, ' ').slice(0, 90);
      lastErr = new Error('tile fetch status ' + ((res && res.status) || 0) + ' ' + head);
    }
    await sleep(1200);
  }
  throw lastErr;
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
  const list = await ctx.cookies(HOST);
  cookies.cookieHeader = list.map(c => c.name + '=' + c.value).join('; ');
  let ua = '';
  for (let i = 0; i < 6 && !ua; i++) {
    try { ua = await tab.evaluate(() => navigator.userAgent); } catch (e) { await sleep(1200); }
  }
  if (ua) cookies.ua = ua;
  try { fs.writeFileSync(SESSION_PATH, JSON.stringify(cookies)); } catch (e) {}
}

// Load one cited page in its own tab and capture the per-document tile tokens
// plus the viewer payload. A fresh tab gets a fresh Turnstile response.
async function loadPage(url) {
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

  await tab.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});

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
  return { token, viewer, tab, title: pageTitle || title };
}

// ---------- one page ----------
async function renderPage(tab, doc, pageKey, token, viewer, workDir) {
  const sizes = viewer && viewer.pageImageSizes;
  if (!sizes || !sizes[pageKey]) throw new UnavailableError('page not in viewer pageImageSizes');
  const W = sizes[pageKey].w, H = sizes[pageKey].h;
  if (!W || !H) throw new UnavailableError('zero page dimensions');

  const cell = Math.ceil(W / COLS);
  const rows = Math.max(1, Math.round(H / cell));
  const colEdge = c => Math.round((c * W) / COLS);
  const rowEdge = r => Math.round((r * H) / rows);
  const oid = doc + '.' + pageKey;

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
      const u = HOST + '/?a=is&type=pagetileimage' +
        '&crth=' + encodeURIComponent(token.crth) +
        '&vac=' + encodeURIComponent(token.vac) +
        '&oid=' + encodeURIComponent(oid) +
        '&width=' + TILE + '&crop=' + [x, y, cw, ch].join(',');
      if (!fs.existsSync(file)) {
        await getTileViaBrowser(tab, u, file);
        await sleep(400);
      }
      let real = ffprobeSize(file);
      if (real.w < 8 || real.h < 8) {
        try { fs.unlinkSync(file); } catch (e) {}
        await sleep(600);
        await getTileViaBrowser(tab, u, file);
        await sleep(400);
        real = ffprobeSize(file);
      }
      if (real.w < 8 || real.h < 8) throw new Error('degenerate tile ' + real.w + 'x' + real.h);
      const th = Math.max(2, 2 * Math.round((TILE * real.h / real.w) / 2));
      rowTiles.push({ file, tw: TILE, th });
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
    const first = [...d.sections.values()][0][0];
    let loaded;
    try {
      await sleep(800);
      loaded = await loadPage(first.url + E);
      await refreshHttpIdentity(loaded.tab);
    } catch (e) {
      console.log(`${tag}  LOAD FAIL  ${e.message}`);
      failedDocs++;
      continue;
    }

    if (!loaded.token || !loaded.viewer) {
      console.log(`${tag}  no tile token / viewer (challenge)  title="${(loaded.title || '').slice(0, 60)}"`);
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

    const sizes = loaded.viewer.pageImageSizes || {};
    const area = loaded.viewer.initialDisplayPageArea || null;
    const paper = decodeEntities((loaded.title || '').split(/\s+[\u2014-]\s+/)[0] || '').trim();

    for (const [section, list] of d.sections) {
      // A page-level citation's viewer already points at its page; an
      // article-level section resolves to the page the viewer places it on.
      const pageKey = area && area.pageID ? area.pageID : section;
      if (!sizes[pageKey]) {
        console.log(`${tag}  section ${section} -> ${pageKey}  UNAVAILABLE (page not in viewer pageImageSizes)`);
        unavailable += list.length;
        for (const x of list) {
          ledger.items[x.hn + '|' + x.url] = {
            hn_id: x.hn, provider: PROVIDER, status: 'page_unavailable',
            page_url: x.url, cited_section: section, page_key: pageKey,
            error: 'page not in viewer pageImageSizes', acquired_at: new Date().toISOString(),
          };
        }
        fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
        continue;
      }

      for (const x of list) {
        const base = `hn-${x.hn.replace('HN-', '')}-vc-${d.doc}-p${pageKey.replace(/\./g, '-')}-page`;
        const outName = base + '.jpg';
        const outPath = path.join(IMG_DIR, outName);
        const workDir = path.join(TMP, base);
        fs.mkdirSync(workDir, { recursive: true });
        const seq = Number(pageKey.split('.')[1] || pageKey.split('.')[0]);
        const entry = {
          hn_id: x.hn, provider: PROVIDER, status: 'pending', page_url: x.url,
          newspaper: paper, issue_date: issueDate(d.doc), page: seq, sequence: seq,
          document_oid: d.doc, page_key: pageKey, cited_section: section,
          section_area: area ? [area.x, area.y, area.w, area.h] : null,
          full_page_asset: null, full_page_dimensions: null, source_dimensions: null,
          mosaic_method: 'openseadragon_tiles_256', tile_count: 0, error: null, acquired_at: null,
        };
        try {
          const res = await renderPage(loaded.tab, d.doc, pageKey, loaded.token, loaded.viewer, workDir);
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
  console.log('Wrote docs/VIRGINIA_CHRONICLE_MOSAIC_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
