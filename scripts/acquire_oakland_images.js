// Acquire the cited article page from Oakland University's digitised *Pontiac
// Press* (scanned from microfilm).
//
// Each record cites an Oakland University DSpace item that holds the full issue
// PDF (with a text layer) and a separate OCR text export. The PDF is the
// archive's own microfilm scan. This script renders the single page that carries
// the cited article; nothing is cropped, retouched, or generated.
//
// Page selection: every page's own text layer is scored against the archive's
// cited headline and the record's report wording, and the best page is chosen.
// The chosen page was also checked by hand against the distinctive terms of the
// cited article.
//
// Usage:
//   node scripts/acquire_oakland_images.js [--only HN-598] [--dry] [--force]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'OAKLAND_IMAGE_LEDGER.json');
const CACHE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/oakland';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PROVIDER = 'Oakland University (The Pontiac Press)';
const NEWSPAPER = 'The Pontiac Press';
const TARGET_WIDTH = 1600;

// Terms used to score each page's own text layer against the cited article.
const JOBS = [
  {
    hn: 'HN-598', item_url: 'https://our.oakland.edu/items/b1f5e586-5d24-429c-ac7d-dd40659d7b91',
    pdf: 'HN-598-thepontiacpress_19540422.pdf', issue_date: '1954-04-22',
    terms: ['mundt', 'mccarthy', 'subcommittee', 'hearings', 'senator', 'army'],
    weight: { mundt: 5, mccarthy: 3, subcommittee: 4, hearings: 2 },
  },
  {
    hn: 'HN-600', item_url: 'https://our.oakland.edu/items/c5a14c7c-42dd-4c05-a76c-7cab5f40ae68',
    pdf: 'HN-600-thepontiacpress_19540610.pdf', issue_date: '1954-06-10',
    terms: ['welch', 'cruel', 'charge', 'mccarthy', 'lawyer', 'applause', 'hearing'],
    weight: { welch: 5, cruel: 4, lawyer: 3, applause: 3, mccarthy: 2 },
  },
  {
    hn: 'HN-601', item_url: 'https://our.oakland.edu/items/5fed8e59-d8eb-4447-986a-08b817265a81',
    pdf: 'HN-601-thepontiacpress_19540923.pdf', issue_date: '1954-09-23',
    terms: ['fisherman', 'radio', 'ash', 'kuboyama', 'japanese', 'dragon', 'hydrogen', 'bikini'],
    weight: { kuboyama: 6, fisherman: 4, dragon: 4, japanese: 2 },
  },
  {
    hn: 'HN-602', item_url: 'https://our.oakland.edu/items/a1f38b29-cf20-4e65-b872-464104198e14',
    pdf: 'HN-602-thepontiacpress_19550412.pdf', issue_date: '1955-04-12',
    terms: ['salk', 'polio', 'vaccine', 'success', 'inoculation', 'paralytic'],
    weight: { salk: 6, polio: 4, vaccine: 4, inoculation: 3 },
  },
];

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');

fs.mkdirSync(IMG_DIR, { recursive: true });

function readJsonIf(p) { try { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); } catch (e) { return null; } }
function norm(s) { return String(s).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
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
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const jobs = JOBS.filter(j => !ONLY || ONLY.has(j.hn));
  console.log(`Oakland jobs: ${jobs.length}  records=${jobs.length}`);
  if (DRY) { jobs.forEach(j => console.log('  ' + j.hn + '  ' + j.pdf + '  ' + j.item_url)); process.exit(0); }

  let ok = 0, fail = 0, noMatch = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const tag = `[${i + 1}/${jobs.length}] ${job.hn}`;
    const key = job.hn + '|' + job.item_url;
    const prev = ledger.items[key];
    if (!FORCE && prev && prev.status === 'image_acquired') { console.log(`${tag}  skip (already acquired)`); continue; }
    const pdfFile = path.join(CACHE, job.pdf);
    if (!fs.existsSync(pdfFile)) { console.log(`${tag}  FAIL missing cached PDF ${pdfFile}`); fail++; continue; }
    const entry = {
      hn_id: job.hn, provider: PROVIDER, status: 'pending', page_url: job.item_url,
      newspaper: NEWSPAPER, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const data = new Uint8Array(fs.readFileSync(pdfFile));
      const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false, disableFontFace: true }).promise;
      entry.pdf_pages = doc.numPages;
      const rows = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        const text = norm(tc.items.map(x => x.str).join(' '));
        let score = 0;
        const hits = [];
        for (const t of job.terms) {
          const n = (text.match(new RegExp('\\b' + t.replace(/ /g, '\\s+') + '\\b', 'g')) || []).length;
          if (n > 0) { hits.push(t + 'x' + n); score += n * (job.weight[t] || 1); }
        }
        rows.push({ page: p, score, hits, chars: text.length });
      }
      rows.sort((a, b) => b.score - a.score || a.page - b.page);
      const best = rows[0];
      entry.page_scores = rows.slice(0, 5);
      if (!best || best.score < 10) {
        entry.status = 'no_confident_match';
        entry.error = 'best page score ' + (best ? best.score : 0) + ' below 10';
        noMatch++;
        console.log(`${tag}  NO MATCH  best=${best ? best.score : 0}`);
        ledger.items[key] = entry;
        continue;
      }
      const outName = `hn-${job.hn.replace('HN-', '')}-pontiac-press-${job.issue_date.replace(/-/g, '')}-p${best.page}-page.jpg`;
      const outPath = path.join(IMG_DIR, outName);
      const r = await renderPage(pdfFile, best.page, outPath);
      const gs = grayStats(outPath);
      if (r.dims.w < 300 || r.dims.h < 300) throw new Error('degenerate page ' + r.dims.w + 'x' + r.dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + outName;
      entry.mosaic_method = 'archive_pdf_page_rendition';
      entry.page_selection = 'text_match';
      entry.pdf_page = best.page;
      entry.best_score = best.score;
      entry.source_dimensions = `${Math.round(r.width_pt)}x${Math.round(r.height_pt)}pt`;
      entry.output_dimensions = `${r.dims.w}x${r.dims.h}`;
      entry.render_scale = Number(r.scale.toFixed(2));
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.additional_cited_article = true;
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(`${tag}  OK  p${best.page}/${doc.numPages}  ${r.dims.w}x${r.dims.h}  score=${best.score}  ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
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
  console.log('Wrote docs/OAKLAND_IMAGE_LEDGER.json');
})().catch(e => { console.error(e); process.exit(1); });
