// Acquire page images for records whose cited source is a newspaper issue PDF
// hosted by the archive that digitised it.
//
// Many small historical societies and university archives publish a whole issue
// as a PDF. We download that PDF, use its own text layer to pick the page that
// best matches the record's headline, and rasterise only that page. The stored
// JPEG is a rendition of the archive's own scan (one rasterisation, no
// retouching, no cropping).
//
// Page selection is a text match against the record heading. When a PDF has no
// text layer, or no page matches well enough, we render page 1 and record that
// fact honestly in the ledger and on the page card.
//
// Usage:
//   node scripts/acquire_pdf_images.js [--only HN-472,HN-510] [--dry] [--retry-failed]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const CACHE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/pdf-cache';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');
const RETRY = args.includes('--retry-failed');

// One entry per (record, issue PDF). Several records may cite the same issue;
// several issues may be cited by one record.
const JOBS = [
  {
    hn: 'HN-472', url: 'https://www.marxists.org/history/usa/pubs/dailyworker/1931/v08-n166-NY-jul-11-1931-DW-LOC.pdf',
    newspaper: 'Daily Worker', provider: 'Marxists Internet Archive (Daily Worker, Library of Congress scan)',
    issue_date: '1931-07-11',
  },
  {
    hn: 'HN-472', url: 'https://www.themilitant.com/1931/0414/MIL0414.pdf',
    newspaper: 'The Militant', provider: 'The Militant archive',
    issue_date: '1931-07-11',
  },
  {
    hn: 'HN-510', url: 'https://rijha.org/wp-content/uploads/voiceandherald/1938/1938-3-18.pdf',
    newspaper: 'Rhode Island Jewish Herald', provider: 'Rhode Island Jewish Historical Association',
    issue_date: '1938-03-18',
  },
  {
    hn: 'HN-622', url: 'https://richesmi.cah.ucf.edu/sanford_herald/files/original/b8fffd3ae26e05aa5b7c92d4ddf35f3a.pdf',
    newspaper: 'The Sanford Herald', provider: 'University of Central Florida (Sanford Herald)',
    issue_date: '1958-03-13',
  },
  {
    hn: 'HN-683', url: 'https://cdn.manchesterhistory.org/News/Manchester%20Evening%20Hearld_1971-09-15.pdf',
    newspaper: 'Manchester Evening Herald', provider: 'Manchester Historical Society',
    issue_date: '1971-09-15',
  },
  {
    hn: 'HN-683', url: 'https://archives.nd.edu/Observer/v06/1971-09-20_v06_007.pdf',
    newspaper: 'The Observer (Notre Dame)', provider: 'University of Notre Dame Archives',
    issue_date: '1971-09-20',
  },
  {
    hn: 'HN-701', url: 'https://archives.nd.edu/observer/1974-09-09_v09_008.pdf',
    newspaper: 'The Observer (Notre Dame)', provider: 'University of Notre Dame Archives',
    issue_date: '1974-09-09',
  },
  {
    hn: 'HN-704', url: 'https://ecms.newportbeachca.gov/Web/0/edoc/1229551/1975-03-31%20-%20Orange%20Coast%20Pilot.pdf',
    newspaper: 'Orange Coast Pilot', provider: 'Newport Beach Public Library',
    issue_date: '1975-03-31',
  },
  {
    hn: 'HN-743', url: 'https://www.themilitant.com/1983/4742/MIL4742.pdf',
    newspaper: 'The Militant', provider: 'The Militant archive',
    issue_date: '1983-11-12',
  },
  {
    hn: 'HN-757', url: 'https://ecms.newportbeachca.gov/Web/0/edoc/1295653/1985-11-22%20-%20Orange%20Coast%20Pilot.pdf',
    newspaper: 'Orange Coast Pilot', provider: 'Newport Beach Public Library',
    issue_date: '1985-11-22',
  },
  {
    hn: 'HN-841', url: 'https://rijha.org/wp-content/uploads/voiceandherald/1998/1998-12-17.pdf',
    newspaper: 'Rhode Island Jewish Herald', provider: 'Rhode Island Jewish Historical Association',
    issue_date: '1998-12-17',
  },
];

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'to', 'for', 'on', 'after', 'with',
  'from', 'by', 'at', 'as', 'is', 'are', 'was', 'were', 'its', 'his', 'her', 'their',
  'this', 'that', 'not', 'but', 'or', 'how', 'why', 'what', 'when', 'who']);

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}
function keywordList(text) {
  return String(text).toLowerCase().split(/\W+/)
    .filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

const records = readJsonIf(path.join(ROOT, 'site', 'data', 'records.json'));
const recArr = Array.isArray(records) ? records : (records.records || Object.values(records));
const recByHn = {};
for (const r of recArr) recByHn[r.hn_id] = r;

const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

function keyOf(job) { return job.hn + '|' + job.url; }

const jobs = JOBS.filter(j => {
  if (ONLY && !ONLY.has(j.hn)) return false;
  if (!ONLY && !RETRY) {
    const e = ledger.items[keyOf(j)];
    if (e && e.status === 'image_acquired') return false;
  }
  return true;
});

console.log(`PDF jobs: ${jobs.length}  records=${new Set(jobs.map(j => j.hn)).size}`);
if (DRY) { jobs.forEach(j => console.log('  ' + j.hn + '  ' + j.newspaper + '  ' + j.url)); process.exit(0); }

let pdfjs = null;
async function getPdfjs() {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}
let pdfToImg = null;
async function getPdfToImg() {
  if (!pdfToImg) pdfToImg = await import('pdf-to-img');
  return pdfToImg;
}

async function downloadPdf(url) {
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
  const dest = path.join(CACHE, hash + '.pdf');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100000) return dest;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
    redirect: 'follow', signal: AbortSignal.timeout(300000),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.slice(0, 5).toString() !== '%PDF-') throw new Error('not a PDF (' + (r.headers.get('content-type') || '') + ')');
  fs.writeFileSync(dest, buf);
  return dest;
}

// Score every page against the record heading using the PDF's text layer.
async function scorePages(file, heading) {
  const { getDocument } = await getPdfjs();
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const words = keywordList(heading);
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const text = tc.items.map(i => i.str).join(' ').toLowerCase();
    let score = 0, hits = 0;
    for (const w of words) {
      const c = (text.match(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      if (c) score++;
      hits += Math.min(c, 5);
    }
    pages.push({ page: p, score, hits, chars: text.length, width_pt: vp.width, height_pt: vp.height });
  }
  return { numPages: doc.numPages, words, pages };
}

function choosePage(scored) {
  const words = scored.words.length;
  const sorted = [...scored.pages].sort((a, b) =>
    b.score - a.score || b.hits - a.hits || a.page - b.page);
  const best = sorted[0];
  const minScore = Math.max(2, Math.ceil(words * 0.4));
  if (!best || best.score === 0 || best.score < minScore) {
    const first = scored.pages[0];
    return { ...first, selection: 'first_page_fallback', best_score: best ? best.score : 0, word_count: words };
  }
  return { ...best, selection: 'text_match', best_score: best.score, word_count: words };
}

async function renderPage(file, pageNo, widthPt, outFile) {
  const { pdf } = await getPdfToImg();
  const targetWidth = 1500;
  const scale = Math.min(2.6, Math.max(1.2, targetWidth / widthPt));
  const doc = await pdf(file, { scale, format: 'jpeg' });
  try {
    const buf = await doc.getPage(pageNo);
    if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('rasteriser did not return JPEG');
    fs.writeFileSync(outFile, buf);
  } finally {
    await doc.destroy().catch(() => {});
  }
  return ffprobeSize(outFile);
}

(async () => {
  let ok = 0, fail = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const tag = `[${i + 1}/${jobs.length}] ${job.hn} ${job.newspaper}`;
    const entry = {
      hn_id: job.hn, provider: job.provider, status: 'pending', page_url: job.url,
      newspaper: job.newspaper, issue_date: job.issue_date,
      error: null, acquired_at: null,
    };
    try {
      await sleep(400);
      const rec = recByHn[job.hn] || {};
      const pdfFile = await downloadPdf(job.url);
      const scored = await scorePages(pdfFile, rec.heading || '');
      const pick = choosePage(scored);

      const outName = `hn-${job.hn.replace('HN-', '')}-${slug(job.newspaper)}-${job.issue_date.replace(/-/g, '')}-p${pick.page}.jpg`;
      const outPath = path.join(IMG_DIR, outName);
      const dims = await renderPage(pdfFile, pick.page, pick.width_pt, outPath);

      entry.full_page_asset = 'assets/images/' + outName;
      entry.source_dimensions = `${Math.round(pick.width_pt)}x${Math.round(pick.height_pt)}pt`;
      entry.output_dimensions = `${dims.w}x${dims.h}`;
      entry.mosaic_method = 'archive_pdf_page_rendition';
      entry.pdf_page = pick.page;
      entry.pdf_pages = scored.numPages;
      entry.page_selection = pick.selection;
      entry.match_score = pick.best_score + '/' + pick.word_count;
      entry.status = 'image_acquired';
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(`${tag}  OK  p${pick.page}/${scored.numPages}  ${dims.w}x${dims.h}  ` +
        `${pick.selection} ${pick.best_score}/${pick.word_count}  ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      fail++;
      console.log(`${tag}  FAIL  ${e.message}`);
    }
    ledger.items[keyOf(job)] = entry;
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  }
  const imgs = buildImages();
  console.log(`\nAcquired: ${ok}   Failed: ${fail}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
})().catch(e => { console.error(e); process.exit(1); });
