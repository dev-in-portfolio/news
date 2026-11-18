// Acquire two scanned newspaper front pages from the W.J. Cash collection's
// Cuban Missile Crisis coverage page, cited by HN-640 and HN-641.
//
// The cited page (10-25-62-pages.htm) is a private collection that exposes its
// own scans of newspaper front pages (PDF, image-only). Following the LaMartin
// precedent, one front page per record is stored as a rendition of the
// collection's own scan: no cropping, no retouching, no generation. OCR is used
// only to confirm the page carries the cited crisis (no OCR text stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/wjcash';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PAGE_URL = 'https://www.wjcash.org/WJCash9/Charlotte.News.Articles/10-25-62-pages.htm';
const BASE = 'https://www.wjcash.org/WJCash9/Charlotte.News.Articles/';
const PROVIDER = 'W.J. Cash collection (Cuban Missile Crisis newspaper front pages)';

const JOBS = [
  {
    hn: 'HN-640',
    pdf: 'GettysburgTimes-10-23-62.pdf',
    newspaper: 'The Gettysburg Times',
    issue_date: '1962-10-23',
    out: 'hn-640-wjcash-gettysburg-times-19621023-p1-page.jpg',
    note: 'W.J. Cash collection scan of The Gettysburg Times front page, 23 October 1962 ("Kennedy Orders Arms Blockade Of Cuba"). Date/subject confirmed by OCR (page locator only).',
  },
  {
    hn: 'HN-641',
    pdf: 'OaklandTrib-10-29-62.pdf',
    newspaper: 'Oakland Tribune',
    issue_date: '1962-10-29',
    out: 'hn-641-wjcash-oakland-tribune-19621029-p1-page.jpg',
    note: 'W.J. Cash collection scan of the Oakland Tribune front page, 29 October 1962 ("Pressed To Speed Cuba Missile Pullout"). Date/subject confirmed by OCR (page locator only).',
  },
];

function readJson(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
function ffprobeSize(f) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number); return { w, h };
}
function grayStats(f) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=64:64,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  let sum = 0, sum2 = 0, min = 255;
  for (const v of raw) { sum += v; sum2 += v * v; if (v < min) min = v; }
  const n = raw.length, mean = sum / n;
  return { sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), min, mean };
}
function winPath(p) { return p.split('/').join('\\'); }
function ocrText(jpeg, tag) {
  const d = ffprobeSize(jpeg);
  const png = TMP + '/' + tag + '-ocr.png';
  const vf = d.w < 1100 ? 'scale=iw*2:ih*2,format=rgb24' : 'format=rgb24';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', jpeg, '-vf', vf, png]);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 240000 }); }
  catch (e) { return ''; }
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const { pdf } = await import('pdf-to-img');
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};

  for (const job of JOBS) {
    const key = job.hn + '|' + PAGE_URL;
    const entry = {
      hn_id: job.hn, provider: PROVIDER, status: 'pending', page_url: PAGE_URL,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const pdfUrl = BASE + job.pdf;
      const r = await fetch(pdfUrl, { headers: { 'User-Agent': UA, Referer: PAGE_URL }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.slice(0, 5).toString() !== '%PDF-') throw new Error('not a PDF (HTTP ' + r.status + ')');
      const pdfFile = TMP + '/' + job.pdf;
      fs.writeFileSync(pdfFile, buf);

      const outTmp = TMP + '/' + job.out;
      const doc = await pdf(pdfFile, { scale: 1.6, format: 'jpeg' });
      let pages = 0, first = null;
      for await (const page of doc) { pages++; if (pages === 1) first = page; }
      await doc.destroy().catch(() => {});
      if (!first) throw new Error('no rendered page');
      fs.writeFileSync(outTmp, first);

      const dims = ffprobeSize(outTmp);
      const gs = grayStats(outTmp);
      if (dims.w < 300 || dims.h < 300) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');

      const text = ocrText(outTmp, job.hn).toLowerCase();
      if (!/cuba|missile|khrush|soviet/.test(text)) {
        throw new Error('OCR does not confirm Cuban missile crisis page (chars=' + text.replace(/\s/g, '').length + ')');
      }

      fs.copyFileSync(outTmp, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = dims.w + 'x' + dims.h;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = 'archive_pdf_page_rendition';
      entry.pdf_page = 1;
      entry.pdf_pages = pages;
      entry.page_selection = 'archive_collection_front_page';
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log(job.hn + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  pages=' + pages);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      console.log(job.hn + '  FAIL  ' + e.message);
    }
    ledger.items[key] = entry;
  }

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
