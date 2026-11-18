// Acquire the cited article page from Baylor University's Quartex digital
// collections (Poage Legislative Library historic newspaper collection).
//
// Each document is a full issue whose pages are exposed through the collection's
// IIIF image service (level2). This script renders every page at a modest width,
// runs the built-in Windows OCR engine over each page ONLY AS A LOCATOR, and
// scores each page against the record's own cited article text. The page with
// the best score is then downloaded at full native resolution and stored.
//
// The stored file is the archive's own IIIF page image; no OCR text is stored or
// republished, and nothing is generated, retouched, or re-cropped.
//
// Usage:
//   node scripts/acquire_baylor_images.js [--only HN-645] [--dry] [--rescore]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const OCR_PS1 = path.join(ROOT, 'scripts', '_ocr_windows.ps1');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/baylor';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PROVIDER = 'Baylor University Poage Legislative Library (Quartex)';
const MIN_SCORE = 0.10;

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');
const RESCORE = args.includes('--rescore');

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

function readJson(p) { let raw = fs.readFileSync(p, 'utf8'); if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); return JSON.parse(raw); }
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
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
function normaliseText(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function trigrams(s) {
  const set = new Set();
  const t = normaliseText(s);
  for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3));
  return set;
}
function cosine(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const g of small) if (big.has(g)) inter++;
  return inter / Math.sqrt(a.size * b.size);
}
function ocrPage(file) {
  const cache = file.replace(/\.jpg$/i, '.txt');
  if (fs.existsSync(cache)) {
    const t = fs.readFileSync(cache, 'utf8');
    if (t.length > 0) return t;
  }
  const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', OCR_PS1, '-Path', file], { encoding: 'utf8', timeout: 240000, maxBuffer: 16 << 20 });
  fs.writeFileSync(cache, out);
  return out;
}

const JOBS = [
  {
    hn: 'HN-645',
    manifest: 'https://iiif.quartexcollections.com/digitalcollections-baylor/iiif/dc37b535-e546-40af-be9e-8b511db782ab/manifest',
    page_url: 'https://digitalcollections-baylor.quartexcollections.com/Documents/Detail/the-dallas-times-herald-final-edition-november-23-1963/678201',
    newspaper: 'The Dallas Times Herald (final edition)',
    issue_date: '1963-11-23',
  },
  {
    hn: 'HN-700',
    manifest: 'https://iiif.quartexcollections.com/digitalcollections-baylor/iiif/ae233d90-1d37-47af-9adc-098938d0f2d8/manifest',
    page_url: 'https://digitalcollections-baylor.quartexcollections.com/Documents/Detail/washington-dc-star-news-august-8-1974/673927',
    newspaper: 'Washington [DC] Star-News',
    issue_date: '1974-08-08',
  },
];

function canvases(manifest) {
  const list = manifest.sequences ? manifest.sequences[0].canvases : manifest.items;
  return (list || []).map((c, i) => {
    const label = c.label && (c.label.en ? c.label.en : c.label);
    const res = c.images ? c.images[0].resource : (c.items[0].items[0].body);
    const svc = Array.isArray(res.service) ? res.service[0] : res.service;
    return {
      index: i,
      label: typeof label === 'string' ? label : JSON.stringify(label),
      width: c.width, height: c.height,
      service: svc && svc['@id'] ? svc['@id'] : (svc && svc.id),
    };
  });
}

async function fetchManifest(url) {
  const cache = path.join(TMP, slug(url.split('/iiif/')[1] || url) + '-manifest.json');
  if (fs.existsSync(cache) && fs.statSync(cache).size > 1000) return readJson(cache);
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('manifest HTTP ' + r.status);
  const j = await r.json();
  fs.writeFileSync(cache, JSON.stringify(j));
  return j;
}

async function fetchImage(service, size, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 20000) return dest;
  const url = `${service}/full/${size}/0/default.jpg`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('image HTTP ' + r.status + ' ' + url);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG from ' + url);
  fs.writeFileSync(dest, buf);
  return dest;
}

const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

(async () => {
  const jobs = JOBS.filter(j => !ONLY || ONLY.has(j.hn));
  console.log(`Baylor jobs: ${jobs.length}`);
  if (DRY) { jobs.forEach(j => console.log('  ' + j.hn + '  ' + j.page_url)); process.exit(0); }

  let ok = 0, noMatch = 0, fail = 0;
  for (let ji = 0; ji < jobs.length; ji++) {
    const job = jobs[ji];
    const tag = `[${ji + 1}/${jobs.length}] ${job.hn}`;
    const key = job.hn + '|' + job.page_url;
    const prev = ledger.items[key];
    if (!RESCORE && prev && prev.status === 'image_acquired') {
      console.log(`${tag}  skip (already acquired)`);
      continue;
    }
    const entry = {
      hn_id: job.hn, provider: PROVIDER, status: 'pending', page_url: job.page_url,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const manifest = await fetchManifest(job.manifest);
      const pages = canvases(manifest);
      entry.manifest_url = job.manifest;
      entry.pdf_pages = pages.length;
      const dir = path.join(TMP, job.hn);
      fs.mkdirSync(dir, { recursive: true });

      // Query: record's own cited headline + quoted report text.
      const rec = readJson(path.join(ROOT, 'site', 'data', 'records.json'));
      const recArr = Array.isArray(rec) ? rec : (rec.records || Object.values(rec));
      const r = recArr.find(x => x.hn_id === job.hn) || {};
      const body = String(r.discovery_body || '').replace(/\*\*/g, ' ');
      const quotes = [...body.matchAll(/[\u201c"]([^\u201d"]{15,120})[\u201d"]/g)].map(m => m[1]).join(' ');
      const query = trigrams((r.heading || '') + ' ' + (r.heading || '') + ' ' + quotes);

      const scored = [];
      for (const p of pages) {
        const thumb = path.join(dir, 'p' + (p.index + 1) + '.jpg');
        await fetchImage(p.service, '1000,', thumb);
        const text = ocrPage(thumb);
        scored.push({ page: p.index + 1, label: p.label, file: thumb, score: cosine(query, trigrams(text)), ocr_chars: text.length });
      }
      scored.sort((a, b) => b.score - a.score || a.page - b.page);
      const best = scored[0];
      entry.page_scores = scored.map(s => ({ page: s.page, label: s.label, score: Number(s.score.toFixed(3)), ocr_chars: s.ocr_chars }));
      if (!best || best.score < MIN_SCORE) {
        entry.status = 'no_confident_match';
        entry.error = 'best OCR similarity ' + (best ? best.score.toFixed(3) : '0') + ' below ' + MIN_SCORE;
        noMatch++;
        console.log(`${tag}  NO MATCH  best=${best ? best.score.toFixed(3) : 0}`);
        ledger.items[key] = entry;
        ledger.generated_at = new Date().toISOString();
        fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
        continue;
      }
      const chosen = pages[best.page - 1];
      const outName = `hn-${job.hn.replace('HN-', '')}-baylor-${slug(job.newspaper)}-${job.issue_date.replace(/-/g, '')}-p${best.page}-page.jpg`;
      const outPath = path.join(IMG_DIR, outName);
      await fetchImage(chosen.service, 'full', outPath);
      const dims = ffprobeSize(outPath);
      if (dims.w < 500 || dims.h < 500) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
      const gs = grayStats(outPath);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + outName;
      entry.mosaic_method = 'archive_iiif_image';
      entry.page_selection = 'ocr_locator';
      entry.ocr_match_score = Number(best.score.toFixed(3));
      entry.pdf_page = best.page;
      entry.page_label = best.label;
      entry.source_dimensions = `${dims.w}x${dims.h}`;
      entry.output_dimensions = `${dims.w}x${dims.h}`;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.additional_cited_article = true;
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(`${tag}  OK  p${best.page}/${pages.length} (${best.label})  ${dims.w}x${dims.h}  score=${best.score.toFixed(3)}  ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      fail++;
      console.log(`${tag}  FAIL  ${e.message}`);
    }
    ledger.items[key] = entry;
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  }

  const imgs = buildImages();
  console.log(`\nAcquired: ${ok}   No match: ${noMatch}   Failed: ${fail}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
  console.log('Wrote docs/OTHER_IMAGE_ACQUISITION_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
