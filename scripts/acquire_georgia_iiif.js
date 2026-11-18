// Acquire full-page renditions from Georgia Historic Newspapers (Open ONI).
//
// The page HTML is blocked for non-browser clients, but the underlying IIIF
// image server (iiif-ha.galib.uga.edu) is open. A real Chrome page load reveals
// the page's IIIF identifier; the image itself is then fetched over plain HTTP
// as a single JPEG rendition of the archive's own scan (no retouching).
//
// Usage:
//   node scripts/acquire_georgia_iiif.js [--only HN-546] [--limit N] [--dry]
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'GEORGIA_IIIF_LEDGER.json');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/georgia-profile';
const PORT = 9374;
const HOST = 'gahistoricnewspapers.galileo.usg.edu';
const PROVIDER = 'Georgia Historic Newspapers (Digital Library of Georgia)';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const WIDTH = 1200;

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const LIMIT = argVal('--limit') ? Number(argVal('--limit')) : Infinity;
const DRY = args.includes('--dry');

fs.mkdirSync(IMG_DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
function readJson(p) { let raw = fs.readFileSync(p, 'utf8'); if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); return JSON.parse(raw); }
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}

const hnUrls = readJsonIf(path.join(ROOT, 'scripts', 'hn_urls.json')) || {};
const images = readJsonIf(path.join(ROOT, 'site', 'data', 'images.json')) || {};
const records = readJsonIf(path.join(ROOT, 'site', 'data', 'records.json'));
const recArr = Array.isArray(records) ? records : (records.records || Object.values(records));
const recByHn = Object.fromEntries(recArr.map(r => [r.hn_id, r]));
const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

const PAGE_RE = /gahistoricnewspapers\.galileo\.usg\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)/;

const work = [];
for (const r of recArr) {
  if (ONLY && !ONLY.has(r.hn_id)) continue;
  for (const raw of hnUrls[r.hn_id] || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    if (!u.includes(HOST)) continue;
    const m = u.match(PAGE_RE);
    if (!m) continue;
    const covered = (images[r.hn_id] || []).some(i => {
      const pu = String(i.page_url || '').replace(/&amp;/g, '&');
      return pu.includes(HOST) && pu.includes(`/seq-${m[4]}/`);
    });
    if (covered) continue;
    if (ledger.items[r.hn_id + '|' + u] && ledger.items[r.hn_id + '|' + u].status === 'image_acquired') continue;
    work.push({ hn: r.hn_id, url: u, lccn: m[1], date: m[2], seq: m[4], key: r.hn_id + '|' + u });
  }
}
const limited = LIMIT === Infinity ? work : work.slice(0, LIMIT);
console.log(`Georgia work items: ${limited.length}  records=${new Set(limited.map(w => w.hn)).size}`);
if (DRY) { limited.forEach(w => console.log('  ' + w.hn + '  ' + w.url)); process.exit(0); }

(async () => {
  const child = spawn(CHROME, [
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    await sleep(500);
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(2000) }); if (r.ok) { up = true; break; } } catch (e) {}
  }
  if (!up) { child.kill(); throw new Error('Chrome CDP did not start'); }
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  const ctx = browser.contexts()[0];

  let ok = 0, fail = 0;
  for (let i = 0; i < limited.length; i++) {
    const w = limited[i];
    const tag = `[${i + 1}/${limited.length}] ${w.hn} seq-${w.seq}`;
    const entry = { hn_id: w.hn, provider: PROVIDER, status: 'pending', page_url: w.url, error: null, acquired_at: null };
    const tab = await ctx.newPage();
    tab.setDefaultTimeout(120000);
    let infoUrl = null;
    tab.on('request', (req) => {
      const u = req.url();
      if (!infoUrl && /iiif-ha\.galib\.uga\.edu\/iiif\/2\/.*\.jp2\/info\.json/.test(u)) infoUrl = u;
    });
    try {
      await tab.goto(w.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const t0 = Date.now();
      while (!infoUrl && Date.now() - t0 < 60000) await sleep(1500);
      if (!infoUrl) throw new Error('no IIIF info.json request captured');
      const id = infoUrl.replace(/\/info\.json$/, '');
      const imgUrl = id + '/full/' + WIDTH + ',/0/default.jpg';
      const r = await fetch(imgUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(180000) });
      if (!r.ok) throw new Error('IIIF HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('IIIF response is not JPEG');
      const base = `hn-${w.hn.replace('HN-', '')}-ga-${w.lccn}-${w.date.replace(/-/g, '')}-seq${w.seq}-page`;
      const outName = base + '.jpg';
      const outPath = path.join(IMG_DIR, outName);
      fs.writeFileSync(outPath, buf);
      const dims = ffprobeSize(outPath);
      const rec = recByHn[w.hn] || {};
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + outName;
      entry.newspaper = (rec.newspaper || '');
      entry.issue_date = w.date;
      entry.sequence = Number(w.seq);
      entry.page = Number(w.seq);
      entry.iiif_id = id;
      entry.image_url = imgUrl;
      entry.source_dimensions = null;
      entry.output_dimensions = `${dims.w}x${dims.h}`;
      entry.mosaic_method = 'iiif_image_api';
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(`${tag}  OK  ${dims.w}x${dims.h}  ${(buf.length / 1024).toFixed(0)}KB`);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      fail++;
      console.log(`${tag}  FAIL  ${e.message}`);
    }
    ledger.items[w.key] = entry;
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
    await tab.close().catch(() => {});
  }

  await browser.close().catch(() => {});
  child.kill();
  const imgs = buildImages();
  console.log(`\nAcquired: ${ok}   Failed: ${fail}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
  console.log('Wrote docs/GEORGIA_IIIF_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
