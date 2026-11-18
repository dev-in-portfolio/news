// Acquire full-page renditions for supporting citations on additional Veridian
// viewer hosts that the Indiana / Virginia Chronicle scripts do not cover.
//
// Each host runs the same Veridian/OpenSeadragon viewer but sits behind a bot
// challenge (AWS WAF or Cloudflare). Plain HTTP is challenged, so the page is
// loaded in real Chrome to obtain the viewer payload, and each tile is fetched
// from inside the page context (credentials: 'include') so the challenge cookie
// is honoured. Tiles are the archive's own pixels, stitched into a ~1024-px-wide
// rendition with white padding only — nothing generated or retouched.
//
// Usage:
//   node scripts/acquire_veridian_support.js [--only HN-412,HN-453] [--limit N] [--dry]
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'SUPPORTING_VERIDIAN_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/veridian-support';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/veridian-support-profile';
const PORT = 9372;
const TILE = 256;
const COLS = 4;

// Host registry. `idPrefix` names the output file; `base` is the origin.
const HOSTS = {
  'news.hrvh.org': {
    idPrefix: 'hrvh',
    base: 'https://news.hrvh.org',
    provider: 'HRVH Historical Newspapers (Southeastern NY Library Resources Council)',
    tileBase: '/veridian/cgi-bin/senylrc-larc?a=is&type=pagetileimage',
    needsToken: false,
  },
  'cdnc.ucr.edu': {
    idPrefix: 'cdnc',
    base: 'https://cdnc.ucr.edu',
    provider: 'California Digital Newspaper Collection (UC Riverside)',
    tileBase: '/?a=is&type=pagetileimage',
    needsToken: true,
    tokenParam: 'grrh',
  },
};

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
const hostOf = u => { try { return new URL(String(u).replace(/&amp;/g, '&')).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

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

const DOC_RE = /[?&]a=d&d=([A-Za-z0-9]+?-?\d{8}(?:-\d+)?)\.(\d+)\.(\d+)/;
const work = new Map(); // host -> Map(doc -> { doc, host, sections: Map(section -> [{hn,url}]) })
for (const r of recArr) {
  if (ONLY && !ONLY.has(r.hn_id)) continue;
  for (const raw of hnUrls[r.hn_id] || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    const h = hostOf(u);
    if (!HOSTS[h]) continue;
    const m = u.match(DOC_RE);
    if (!m) continue;
    const doc = m[1], section = m[2] + '.' + m[3];
    if (coveredByStoredImage(r.hn_id, doc + '.' + section)) continue;
    if (!work.has(h)) work.set(h, new Map());
    const docs = work.get(h);
    if (!docs.has(doc)) docs.set(doc, { doc, host: h, sections: new Map() });
    const secs = docs.get(doc).sections;
    if (!secs.has(section)) secs.set(section, []);
    const list = secs.get(section);
    if (!list.some(x => x.hn === r.hn_id)) list.push({ hn: r.hn_id, url: u });
  }
}

const jobs = [];
for (const [h, docs] of work) for (const d of docs.values()) jobs.push(d);
jobs.sort((a, b) => (a.host + a.doc).localeCompare(b.host + b.doc));
const limited = LIMIT === Infinity ? jobs : jobs.slice(0, LIMIT);
const recTotal = new Set(jobs.flatMap(d => [...d.sections.values()].flat().map(x => x.hn))).size;
console.log(`Cited records with supporting Veridian pages: ${recTotal}`);
console.log(`Documents to load: ${limited.length}   cited sections: ${limited.reduce((n, d) => n + d.sections.size, 0)}`);
if (DRY) {
  for (const d of limited) console.log('  ' + d.host + '  ' + d.doc + '  ' + [...d.sections.keys()].join(' '));
  process.exit(0);
}

// ---------- helpers ----------
function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}

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

// Load one cited page in its own tab, capture the per-document tile token (when
// the host uses one) and the viewer payload.
async function loadPage(url, cfgNeedsToken) {
  const tab = await ctx.newPage();
  tab.setDefaultTimeout(120000);
  let token = null;
  const onResponse = async (resp) => {
    if (token) return;
    if (!/command=getViewerAccessCode/.test(resp.url())) return;
    try {
      const t = await resp.text();
      // Some Veridian hosts name the token CAPTCHAResponseTokenHashed, others
      // GRecaptchaResponseHashed; both pair with ViewerAccessCode.
      const c = (t.match(/<(?:CAPTCHAResponseTokenHashed|GRecaptchaResponseHashed)[^>]*>([^<]*)</) || [])[1];
      const v = (t.match(/<ViewerAccessCode[^>]*>([^<]*)</) || [])[1];
      if (c && v) token = { crth: decodeEntities(c), vac: decodeEntities(v) };
    } catch (e) {}
  };
  const onRequest = (req) => {
    if (token) return;
    const u = req.url();
    if (!/type=pagetileimage/.test(u)) return;
    try {
      const q = new URL(u).searchParams;
      const c = q.get('crth') || q.get('grrh'), v = q.get('vac');
      if (c && v) token = { crth: c, vac: v };
    } catch (e) {}
  };
  tab.on('response', onResponse);
  tab.on('request', onRequest);

  await tab.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const started = Date.now();
  let lastReload = 0;
  let viewer = null;
  while (Date.now() - started < 120000) {
    viewer = await tab.evaluate(() => {
      try {
        const el = document.querySelector('#oseadinitialviewerdata');
        if (!el) return null;
        return JSON.parse(el.getAttribute('data-viewer-data-base-json'));
      } catch (e) { return null; }
    }).catch(() => null);
    if (viewer) break;
    const title = await tab.title().catch(() => '');
    if (/just a moment|verification|attention required/i.test(title)) await tab.bringToFront().catch(() => {});
    else if (/^loading/i.test(title) && Date.now() - lastReload > 25000) {
      lastReload = Date.now();
      await tab.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await sleep(1500);
  }
  // The tile token is issued asynchronously after the viewer initialises, so
  // when the host requires one, wait for it before detaching the listeners.
  if (cfgNeedsToken && !token) {
    const t0 = Date.now();
    while (!token && Date.now() - t0 < 45000) await sleep(1000);
  }
  tab.off('response', onResponse);
  tab.off('request', onRequest);
  const pageTitle = await tab.title().catch(() => '');
  return { token, viewer, tab, title: pageTitle };
}

// Fetch a tile from inside the page so the challenge cookie/TLS fingerprint is
// the browser's own. Returns a JPEG buffer.
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

class UnavailableError extends Error {}

// ---------- one page ----------
async function renderPage(tab, cfg, doc, pageKey, token, viewer, workDir) {
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

  const tileUrl = (x, y, cw, ch) => {
    let u = cfg.base + cfg.tileBase +
      '&oid=' + encodeURIComponent(oid) +
      '&width=' + TILE + '&crop=' + [x, y, cw, ch].join(',');
    if (cfg.needsToken) {
      if (!token) throw new Error('host requires tile token but none captured');
      u += '&' + (cfg.tokenParam || 'crth') + '=' + encodeURIComponent(token.crth) +
        '&vac=' + encodeURIComponent(token.vac);
    }
    return u;
  };

  const tiles = [];
  const rowHeights = [];
  for (let r = 0; r < rows; r++) {
    const y = rowEdge(r), y2 = rowEdge(r + 1), ch = y2 - y;
    const rowTiles = [];
    for (let c = 0; c < COLS; c++) {
      const x = colEdge(c), x2 = colEdge(c + 1), cw = x2 - x;
      if (cw <= 0 || ch <= 0) throw new Error('bad grid cell');
      const file = path.join(workDir, `tile-${r}-${c}.jpg`);
      const u = tileUrl(x, y, cw, ch);
      if (!fs.existsSync(file)) {
        await getTileViaBrowser(tab, u, file);
        await sleep(350);
      }
      let real = ffprobeSize(file);
      if (real.w < 8 || real.h < 8) {
        try { fs.unlinkSync(file); } catch (e) {}
        await sleep(500);
        await getTileViaBrowser(tab, u, file);
        await sleep(350);
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

  for (let di = 0; di < limited.length; di++) {
    const d = limited[di];
    const cfg = HOSTS[d.host];
    const tag = `[${di + 1}/${limited.length}] ${d.host} ${d.doc}`;
    const first = [...d.sections.values()][0][0];
    let loaded;
    try {
      await sleep(800);
      loaded = await loadPage(first.url, cfg.needsToken);
    } catch (e) {
      console.log(`${tag}  LOAD FAIL  ${e.message}`);
      failedDocs++;
      continue;
    }

    if (!loaded.viewer) {
      console.log(`${tag}  no viewer payload (challenge)  title="${(loaded.title || '').slice(0, 60)}"`);
      failedDocs++;
      for (const [section, list] of d.sections) {
        for (const x of list) {
          ledger.items[x.hn + '|' + x.url] = {
            hn_id: x.hn, provider: cfg.provider, status: 'failed', cited_section: section,
            page_url: x.url, error: 'no viewer payload', acquired_at: new Date().toISOString(),
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
      const pageKey = area && area.pageID ? area.pageID : section;
      if (!sizes[pageKey]) {
        console.log(`${tag}  section ${section} -> ${pageKey}  UNAVAILABLE`);
        unavailable += list.length;
        for (const x of list) {
          ledger.items[x.hn + '|' + x.url] = {
            hn_id: x.hn, provider: cfg.provider, status: 'page_unavailable',
            page_url: x.url, cited_section: section, page_key: pageKey,
            error: 'page not in viewer pageImageSizes', acquired_at: new Date().toISOString(),
          };
        }
        fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
        continue;
      }

      for (const x of list) {
        const base = `hn-${x.hn.replace('HN-', '')}-${cfg.idPrefix}-${d.doc}-p${pageKey.replace(/\./g, '-')}-page`;
        const outName = base + '.jpg';
        const outPath = path.join(IMG_DIR, outName);
        const workDir = path.join(TMP, base);
        fs.mkdirSync(workDir, { recursive: true });
        const seq = Number(pageKey.split('.')[1] || pageKey.split('.')[0]);
        const entry = {
          hn_id: x.hn, provider: cfg.provider, status: 'pending', page_url: x.url,
          newspaper: paper, issue_date: issueDate(d.doc), page: seq, sequence: seq,
          document_oid: d.doc, page_key: pageKey, cited_section: section,
          section_area: area ? [area.x, area.y, area.w, area.h] : null,
          full_page_asset: null, full_page_dimensions: null, source_dimensions: null,
          mosaic_method: 'openseadragon_tiles_256', tile_count: 0, error: null, acquired_at: null,
        };
        try {
          const res = await renderPage(loaded.tab, cfg, d.doc, pageKey, loaded.token, loaded.viewer, workDir);
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
  console.log('Wrote docs/SUPPORTING_VERIDIAN_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
