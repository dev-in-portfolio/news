// Acquire the full-page rendition for a Texas A&M (Open ONI) citation.
//
// The page HTML and IIIF server reject non-browser clients, but a real Chrome
// page load succeeds. The page's og:image names the IIIF identifier; the image
// is then fetched from inside the page as a single JPEG rendition of the
// archive's own scan (no retouching).
//
// Usage: node scripts/acquire_tamu_iiif.js [--only HN-582] [--dry]
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'TAMU_IIIF_LEDGER.json');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/tamu-profile';
const PORT = 9377;
const HOST = 'newspaper.library.tamu.edu';
const PROVIDER = 'Texas A&M University Libraries (Open ONI)';
const WIDTH = 1200;

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
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

const PAGE_RE = /newspaper\.library\.tamu\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)/;
const work = [];
for (const r of recArr) {
  if (ONLY && !ONLY.has(r.hn_id)) continue;
  for (const raw of hnUrls[r.hn_id] || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    if (!u.includes(HOST)) continue;
    const m = u.match(PAGE_RE);
    if (!m) continue;
    const covered = (images[r.hn_id] || []).some(i => String(i.page_url || '').includes(HOST));
    if (covered) continue;
    work.push({ hn: r.hn_id, url: u, lccn: m[1], date: m[2], seq: m[4], key: r.hn_id + '|' + u });
  }
}
console.log(`TAMU work items: ${work.length}  records=${new Set(work.map(w => w.hn)).size}`);
if (DRY) { work.forEach(w => console.log('  ' + w.hn + '  ' + w.url)); process.exit(0); }

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
  for (let i = 0; i < work.length; i++) {
    const w = work[i];
    const tag = `[${i + 1}/${work.length}] ${w.hn} seq-${w.seq}`;
    const entry = { hn_id: w.hn, provider: PROVIDER, status: 'pending', page_url: w.url, error: null, acquired_at: null };
    const tab = await ctx.newPage();
    tab.setDefaultTimeout(120000);
    try {
      await tab.goto(w.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(2500);
      const og = await tab.evaluate(() => {
        const m = document.querySelector('meta[property="og:image"]');
        return m ? m.getAttribute('content') : null;
      }).catch(() => null);
      if (!og) throw new Error('no og:image IIIF URL');
      const idMatch = og.match(/^(https:\/\/[^/]+\/images\/iiif\/)(.+?)\/full\/[^/]+\/0\/default\.jpg$/);
      if (!idMatch) throw new Error('unexpected IIIF URL: ' + og.slice(0, 120));
      const imgUrl = idMatch[1] + idMatch[2] + '/full/' + WIDTH + ',/0/default.jpg';
      const res = await tab.evaluate(async (url) => {
        try {
          const r = await fetch(url, { credentials: 'include' });
          const b = new Uint8Array(await r.arrayBuffer());
          if (!(b[0] === 0xFF && b[1] === 0xD8)) return { ok: false, status: r.status, len: b.length };
          let s = ''; const CH = 0x8000;
          for (let i = 0; i < b.length; i += CH) s += String.fromCharCode.apply(null, b.subarray(i, i + CH));
          return { ok: true, status: r.status, b64: btoa(s) };
        } catch (e) { return { ok: false, err: String(e) }; }
      }, imgUrl);
      if (!res || !res.ok) throw new Error('image fetch failed ' + JSON.stringify(res).slice(0, 120));
      const buf = Buffer.from(res.b64, 'base64');
      const base = `hn-${w.hn.replace('HN-', '')}-tamu-${w.lccn}-${w.date.replace(/-/g, '')}-seq${w.seq}-page`;
      const outName = base + '.jpg';
      const outPath = path.join(IMG_DIR, outName);
      fs.writeFileSync(outPath, buf);
      const dims = ffprobeSize(outPath);
      const rec = recByHn[w.hn] || {};
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + outName;
      entry.newspaper = rec.newspaper || '';
      entry.issue_date = w.date;
      entry.sequence = Number(w.seq);
      entry.page = Number(w.seq);
      entry.iiif_id = idMatch[2];
      entry.image_url = imgUrl;
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
  console.log('Wrote docs/TAMU_IIIF_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
