// Acquire the cited page from the Carnegie Mellon University Libraries scans of
// *The American Jewish Outlook* (Pittsburgh).
//
// Each record cites a CMU IIIF PDF of the full issue. The PDF carries a text
// layer; the page carrying the cited item was located by scoring every page's
// own text against the item's terms. The stored file is a rasterisation of the
// archive's own scanned PDF page; nothing is cropped, retouched, or generated.
//
// Usage:
//   node scripts/acquire_cmu_images.js [--only HN-503] [--dry] [--force]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'CMU_IMAGE_LEDGER.json');
const CACHE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/cmu';
const PROVIDER = 'Carnegie Mellon University Libraries (The American Jewish Outlook)';
const NEWSPAPER = 'The American Jewish Outlook';
const TARGET_WIDTH = 1600;

const JOBS = [
  {
    hn: 'HN-503', pdf: 'OUT_1936_004_011_08211936.pdf', issue_date: '1936-08-21',
    page_url: 'https://iiif.library.cmu.edu/file/OUT_1936_004_011_08211936/OUT_1936_004_011_08211936.pdf',
    page: 1, note: 'Vets Ask for Games Pledge (Olympic fair-treatment resolution)',
  },
  {
    hn: 'HN-510', pdf: 'OUT_1938_007_015_03181938.pdf', issue_date: '1938-03-18',
    page_url: 'https://iiif.library.cmu.edu/file/OUT_1938_007_015_03181938/OUT_1938_007_015_03181938.pdf',
    page: 3, note: 'And Now Austria (Anschluss report)',
  },
  {
    hn: 'HN-516', pdf: 'OUT_1938_008_025_11251938.pdf', issue_date: '1938-11-25',
    page_url: 'https://iiif.library.cmu.edu/file/OUT_1938_008_025_11251938/OUT_1938_008_025_11251938.pdf',
    page: 6, note: 'Father Coughlin radio rhetoric editorial',
  },
];

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');

fs.mkdirSync(IMG_DIR, { recursive: true });

function readJsonIf(p) { try { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); } catch (e) { return null; } }
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

async function renderPage(file, pageNo, outFile) {
  const { pdf } = await import('pdf-to-img');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(file));
  const doc0 = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false, disableFontFace: true }).promise;
  const vp = (await doc0.getPage(pageNo)).getViewport({ scale: 1 });
  const scale = Math.min(2.6, Math.max(1.2, TARGET_WIDTH / vp.width));
  const doc = await pdf(file, { scale, format: 'jpeg' });
  try {
    const buf = await doc.getPage(pageNo);
    if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('rasteriser did not return JPEG');
    fs.writeFileSync(outFile, buf);
  } finally {
    await doc.destroy().catch(() => {});
  }
  return { dims: ffprobeSize(outFile), width_pt: vp.width, height_pt: vp.height, scale };
}

(async () => {
  const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
  if (!ledger.items) ledger.items = {};
  const jobs = JOBS.filter(j => !ONLY || ONLY.has(j.hn));
  console.log(`CMU jobs: ${jobs.length}`);
  if (DRY) { jobs.forEach(j => console.log('  ' + j.hn + '  ' + j.pdf + '  p' + j.page)); process.exit(0); }

  let ok = 0, fail = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const tag = `[${i + 1}/${jobs.length}] ${job.hn}`;
    const key = job.hn + '|' + job.page_url;
    const prev = ledger.items[key];
    if (!FORCE && prev && prev.status === 'image_acquired') { console.log(`${tag}  skip (already acquired)`); continue; }
    const pdfFile = path.join(CACHE, job.pdf);
    if (!fs.existsSync(pdfFile)) { console.log(`${tag}  FAIL missing cached PDF`); fail++; continue; }
    const entry = {
      hn_id: job.hn, provider: PROVIDER, status: 'pending', page_url: job.page_url,
      newspaper: NEWSPAPER, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const outName = `hn-${job.hn.replace('HN-', '')}-american-jewish-outlook-${job.issue_date.replace(/-/g, '')}-p${job.page}-page.jpg`;
      const outPath = path.join(IMG_DIR, outName);
      const r = await renderPage(pdfFile, job.page, outPath);
      const gs = grayStats(outPath);
      if (r.dims.w < 300 || r.dims.h < 300) throw new Error('degenerate page ' + r.dims.w + 'x' + r.dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + outName;
      entry.mosaic_method = 'archive_pdf_page_rendition';
      entry.page_selection = 'text_match';
      entry.pdf_page = job.page;
      entry.article_note = job.note;
      entry.source_dimensions = `${Math.round(r.width_pt)}x${Math.round(r.height_pt)}pt`;
      entry.output_dimensions = `${r.dims.w}x${r.dims.h}`;
      entry.render_scale = Number(r.scale.toFixed(2));
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.additional_cited_article = true;
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(`${tag}  OK  p${job.page}  ${r.dims.w}x${r.dims.h}  ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
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
  console.log(`\nAcquired: ${ok}   Failed: ${fail}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
  console.log('Wrote docs/CMU_IMAGE_LEDGER.json');
})().catch(e => { console.error(e); process.exit(1); });
