// Acquire full-page scans from The Spectator archive.
//
// Each article page embeds a `fullImages` map of the issue's page scans, with a
// per-page token:
//
//   fullImages = {"1":"http://archive-images.spectator.co.uk/issues/
//                   <date>/<page>.jpg?size=x&token=<token>"}
//
// The stored JPEG is the archive's own page scan (no retouching or cropping).
//
// Usage: node scripts/acquire_spectator_images.js [--only HN-208] [--dry]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'SPECTATOR_IMAGE_LEDGER.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PROVIDER = 'The Spectator Archive';

const JOBS = [
  {
    hn: 'HN-208', url: 'https://archive.spectator.co.uk/article/14th-december-1867/1/news-of-the-week',
    newspaper: 'The Spectator', issue_date: '1867-12-14', page: 1,
  },
  {
    hn: 'HN-233', url: 'https://archive.spectator.co.uk/article/18th-december-1875/1/a-crime-the-like-of-which-the-world-has-probably',
    newspaper: 'The Spectator', issue_date: '1875-12-18', page: 1,
  },
];

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');

fs.mkdirSync(IMG_DIR, { recursive: true });

function readJson(p) { let raw = fs.readFileSync(p, 'utf8'); if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); return JSON.parse(raw); }
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}
function grayStats(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=64:64,format=gray',
    '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  let sum = 0, sum2 = 0, min = 255;
  for (const v of raw) { sum += v; sum2 += v * v; if (v < min) min = v; }
  const n = raw.length;
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return { mean, sd, min, n };
}

const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

(async () => {
  const jobs = ONLY ? JOBS.filter(j => ONLY.has(j.hn)) : JOBS;
  console.log(`Spectator jobs: ${jobs.length}`);
  if (DRY) { jobs.forEach(j => console.log('  ' + j.hn + '  ' + j.url)); process.exit(0); }

  let ok = 0, fail = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const tag = `[${i + 1}/${jobs.length}] ${job.hn}`;
    const entry = {
      hn_id: job.hn, provider: PROVIDER, status: 'pending', page_url: job.url,
      newspaper: job.newspaper, issue_date: job.issue_date, page: job.page,
      error: null, acquired_at: null,
    };
    try {
      const r = await fetch(job.url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      const m = html.match(/fullImages\s*=\s*(\{[\s\S]*?\});/);
      if (!m) throw new Error('no fullImages map');
      const map = JSON.parse(m[1]);
      const raw = map[String(job.page)];
      if (!raw) throw new Error('cited page not in fullImages map');
      const imgUrl = raw.replace(/\\\//g, '/');
      const ir = await fetch(imgUrl, { headers: { 'User-Agent': UA, Referer: job.url }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
      if (!ir.ok) throw new Error('image HTTP ' + ir.status);
      const buf = Buffer.from(await ir.arrayBuffer());
      if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('page image is not JPEG');
      const outName = `hn-${job.hn.replace('HN-', '')}-spectator-${job.issue_date.replace(/-/g, '')}-p${job.page}-page.jpg`;
      const outPath = path.join(IMG_DIR, outName);
      fs.writeFileSync(outPath, buf);
      const dims = ffprobeSize(outPath);
      if (dims.w < 300 || dims.h < 300) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
      const gs = grayStats(outPath);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      entry.status = 'image_acquired';
      entry.image_url = imgUrl;
      entry.full_page_asset = 'assets/images/' + outName;
      entry.mosaic_method = 'archive_page_rendition';
      entry.source_dimensions = `${dims.w}x${dims.h}`;
      entry.output_dimensions = `${dims.w}x${dims.h}`;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(`${tag}  OK  ${dims.w}x${dims.h}  sd=${gs.sd.toFixed(1)}  ${(buf.length / 1024).toFixed(0)}KB`);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      fail++;
      console.log(`${tag}  FAIL  ${e.message}`);
    }
    ledger.items[job.hn + '|' + job.url] = entry;
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  }

  const imgs = buildImages();
  console.log(`\nAcquired: ${ok}   Failed: ${fail}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
  console.log('Wrote docs/SPECTATOR_IMAGE_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
