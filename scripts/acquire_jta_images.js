// Acquire the cited article page from Jewish Telegraphic Agency (JTA) archive
// bulletins.
//
// Each JTA archive article page links to a scanned bulletin PDF
// (http://pdfs.jta.org/<year>/<date>_<n>.pdf). The PDF has no text layer, no
// outline, no page labels, and no annotations, so the only way to find the
// cited article inside the bulletin is to read the scanned pages.
//
// This script renders every page of the bulletin, runs the built-in Windows OCR
// engine over each page ONLY AS A LOCATOR, and scores each page against the
// archive's own article title and summary (from the article page). The page
// with the best score is stored. The stored file is a rasterisation of the
// archive's own scanned PDF page; no OCR text is stored or republished, and no
// content is generated, retouched, or re-cropped.
//
// Usage:
//   node scripts/acquire_jta_images.js [--only HN-503] [--dry] [--rescore]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'JTA_IMAGE_LEDGER.json');
const URLS_PATH = path.join(ROOT, 'scripts', 'hn_urls.json');
const OCR_PS1 = path.join(ROOT, 'scripts', '_ocr_windows.ps1');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/jta-acquire';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PROVIDER = 'Jewish Telegraphic Agency Archive';
const NEWSPAPER = 'Jewish Telegraphic Agency Bulletin';
const SCALE = 3.0;
const MIN_SCORE = 0.12;

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

function decodeEntities(s) {
  return String(s)
    .replace(/&#8217;|&#8216;|&rsquo;|&lsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)));
}
function stripTags(s) { return decodeEntities(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }

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

async function fetchArticle(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('article HTTP ' + r.status);
  const html = await r.text();
  const h1 = html.match(/<h1[^>]*itemprop=["']headline["'][^>]*>([\s\S]*?)<\/h1>/i);
  const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  const pdfs = [...new Set([...html.matchAll(/https?:\/\/pdfs\.jta\.org\/[^"'\s<>]+\.pdf/gi)].map(x => x[0]))];
  const dateM = html.match(/post-pdf__date[^>]*>\s*([A-Za-z]+)\s+(\d{1,2}),\s*<span>(\d{4})<\/span>/i);
  let issueDate = '';
  if (dateM) {
    const months = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
    const mm = months[dateM[1].toLowerCase()];
    if (mm) issueDate = `${dateM[3]}-${mm}-${String(dateM[2]).padStart(2, '0')}`;
  }
  return {
    title: h1 ? stripTags(h1[1]) : '',
    summary: og ? decodeEntities(og[1]) : '',
    pdfs,
    issueDate,
  };
}

async function downloadPdf(url) {
  const base = path.basename(new URL(url).pathname);
  const dest = path.join(TMP, base);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 50000) return dest;
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(240000) });
  if (!r.ok) throw new Error('pdf HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) throw new Error('not a PDF');
  fs.writeFileSync(dest, buf);
  return dest;
}

async function renderPages(pdfFile) {
  const { pdf } = await import('pdf-to-img');
  const dir = path.join(TMP, path.basename(pdfFile, '.pdf') + '-pages');
  fs.mkdirSync(dir, { recursive: true });
  const doc = await pdf(pdfFile, { scale: SCALE, format: 'jpeg' });
  const pages = [];
  for (let p = 1; p <= doc.length; p++) {
    const dest = path.join(dir, 'p' + p + '.jpg');
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 5000) {
      const buf = await doc.getPage(p);
      fs.writeFileSync(dest, buf);
    }
    pages.push(dest);
  }
  await doc.destroy().catch(() => {});
  return pages;
}

function ocrPage(file) {
  const cache = file.replace(/\.jpg$/i, '.txt');
  if (fs.existsSync(cache)) {
    const t = fs.readFileSync(cache, 'utf8');
    if (t.length > 0) return t;
  }
  const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', OCR_PS1, '-Path', file], { encoding: 'utf8', timeout: 180000, maxBuffer: 16 << 20 });
  fs.writeFileSync(cache, out);
  return out;
}

const hnUrls = readJson(URLS_PATH);
const records = readJson(path.join(ROOT, 'site', 'data', 'records.json'));
const recArr = Array.isArray(records) ? records : (records.records || Object.values(records));
const recByHn = {};
for (const r of recArr) recByHn[r.hn_id] = r;

const JOBS = [];
for (const [hn, urls] of Object.entries(hnUrls)) {
  if (ONLY && !ONLY.has(hn)) continue;
  for (const url of urls || []) {
    if (!/^https?:\/\/(www\.)?jta\.org\//i.test(url)) continue;
    if (JOBS.some(j => j.hn === hn && j.url === url)) continue;
    JOBS.push({ hn, url });
  }
}

const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

(async () => {
  console.log(`JTA jobs: ${JOBS.length}  records=${new Set(JOBS.map(j => j.hn)).size}`);
  if (DRY) { JOBS.forEach(j => console.log('  ' + j.hn + '  ' + j.url)); process.exit(0); }

  let ok = 0, noMatch = 0, noPdf = 0, fail = 0;
  for (let i = 0; i < JOBS.length; i++) {
    const job = JOBS[i];
    const tag = `[${i + 1}/${JOBS.length}] ${job.hn}`;
    const key = job.hn + '|' + job.url;
    const prev = ledger.items[key];
    if (!RESCORE && prev && prev.status === 'image_acquired') {
      console.log(`${tag}  skip (already acquired)`);
      continue;
    }
    const entry = {
      hn_id: job.hn, provider: PROVIDER, status: 'pending', page_url: job.url,
      newspaper: NEWSPAPER, issue_date: '', error: null, acquired_at: null,
    };
    try {
      const art = await fetchArticle(job.url);
      entry.archive_article_title = art.title;
      entry.article_summary = art.summary.slice(0, 400);
      entry.issue_date = art.issueDate;
      if (!art.pdfs.length) {
        entry.status = 'no_pdf';
        entry.error = 'JTA article page links no scanned bulletin PDF';
        noPdf++;
        console.log(`${tag}  NO PDF  ${art.title.slice(0, 60)}`);
        ledger.items[key] = entry;
        continue;
      }
      const pdfUrl = art.pdfs[0];
      entry.pdf_url = pdfUrl;
      const pdfFile = await downloadPdf(pdfUrl);
      const pages = await renderPages(pdfFile);
      entry.pdf_pages = pages.length;

      const query = trigrams(art.title + ' ' + art.title + ' ' + art.summary);
      const scored = [];
      for (let p = 0; p < pages.length; p++) {
        const text = ocrPage(pages[p]);
        scored.push({ page: p + 1, file: pages[p], score: cosine(query, trigrams(text)), ocr_chars: text.length });
      }
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      entry.page_scores = scored.map(s => ({ page: s.page, score: Number(s.score.toFixed(3)), ocr_chars: s.ocr_chars }));
      if (!best || best.score < MIN_SCORE) {
        entry.status = 'no_confident_match';
        entry.error = 'best OCR similarity ' + (best ? best.score.toFixed(3) : '0') + ' below ' + MIN_SCORE;
        noMatch++;
        console.log(`${tag}  NO MATCH  best=${best ? best.score.toFixed(3) : 0}  ${art.title.slice(0, 50)}`);
        ledger.items[key] = entry;
        continue;
      }
      const dims = ffprobeSize(best.file);
      const base = `hn-${job.hn.replace('HN-', '')}-jta-${slug(path.basename(pdfUrl, '.pdf'))}-p${best.page}`;
      const outName = base + '-page.jpg';
      const outPath = path.join(IMG_DIR, outName);
      fs.copyFileSync(best.file, outPath);
      const gs = grayStats(outPath);
      if (dims.w < 300 || dims.h < 300) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + outName;
      entry.mosaic_method = 'archive_pdf_page_rendition';
      entry.page_selection = 'ocr_locator';
      entry.ocr_match_score = Number(best.score.toFixed(3));
      entry.pdf_page = best.page;
      entry.source_dimensions = `${dims.w}x${dims.h}`;
      entry.output_dimensions = `${dims.w}x${dims.h}`;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.additional_cited_article = true;
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(`${tag}  OK  p${best.page}/${pages.length}  ${dims.w}x${dims.h}  score=${best.score.toFixed(3)}  ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
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
  console.log(`\nAcquired: ${ok}   No match: ${noMatch}   No PDF: ${noPdf}   Failed: ${fail}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
  console.log('Wrote docs/JTA_IMAGE_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
