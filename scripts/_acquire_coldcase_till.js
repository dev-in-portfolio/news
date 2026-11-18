// Acquire two newspaper-page scans exposed by the Civil Rights Cold Case
// Records Review Board's Emmett Till case file page cited by HN-607:
//   uploads/emmett-till/newspaperp.3.pdf     - newspaper clipping scan
//   uploads/emmett-till/peoplesworldp.1.pdf  - People's World front page,
//                                              Monday, September 12, 1955
//
// Both PDFs are image-only (no font objects) - i.e. scans, not typescripts.
// The stored assets are rasterisations of the archive's own scanned pages; no
// cropping, retouching, or generation. OCR is used only to confirm identity
// (no OCR text is stored). Stored as additional_cited_article alongside the
// record's primary Indianapolis Recorder page.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/coldcase';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE = 'https://www.coldcaserecords.gov/content/cases/1955-08-28-emmett-till/';

const JOBS = [
  {
    url: 'https://www.coldcaserecords.gov/uploads/emmett-till/newspaperp.3.pdf',
    out: 'hn-607-coldcase-till-newspaper-clipping.jpg',
    method: 'archive_clipping_image',
    newspaper: 'Newspaper clipping (Emmett Till case file)',
    issue_date: '',
    need: [/till/i, /evidence|murder|fbi|grand jury/i],
    note: 'Newspaper clipping scan from the Civil Rights Cold Case Records Review Board\'s Emmett Till case file (cited by HN-607): "FBI Given New Evidence on Murder of Till". Contemporaneous Till-case newspaper coverage. Identity confirmed by OCR (page locator only).',
  },
  {
    url: 'https://www.coldcaserecords.gov/uploads/emmett-till/peoplesworldp.1.pdf',
    out: 'hn-607-coldcase-peoples-world-19550912-p1.jpg',
    method: 'archive_pdf_page_rendition',
    newspaper: "People's World",
    issue_date: '1955-09-12',
    need: [/peoples world|people's world|los angeles/i, /1955|september/i],
    note: 'Front page of People\'s World, Monday, 12 September 1955, from the Civil Rights Cold Case Records Review Board\'s Emmett Till case file (cited by HN-607). Contemporaneous Till-case newspaper coverage. Identity confirmed by OCR (page locator only).',
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
function ocrText(png, tag) {
  const d = ffprobeSize(png);
  const up = TMP + '/' + tag + '-ocr.png';
  const args = ['-v', 'error', '-y', '-i', png];
  if (d.w > 1400) args.push('-vf', 'scale=1300:-1');
  else if (d.w < 1100) args.push('-vf', 'scale=iw*2:ih*2');
  args.push('-pix_fmt', 'rgb24', up);
  execFileSync('ffmpeg', args);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(up)], { encoding: 'utf8', timeout: 240000 }); }
  catch (e) { return ''; }
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const { pdf } = await import('pdf-to-img');
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};

  for (const job of JOBS) {
    const key = 'HN-607|' + PAGE + '|' + job.out;
    const entry = {
      hn_id: 'HN-607',
      provider: 'Civil Rights Cold Case Records Review Board (Emmett Till case file)',
      status: 'pending',
      page_url: PAGE,
      newspaper: job.newspaper,
      issue_date: job.issue_date || null,
      error: null,
      acquired_at: null,
    };
    try {
      const r = await fetch(job.url, { headers: { 'User-Agent': UA, Referer: PAGE }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.slice(0, 4).toString() !== '%PDF') throw new Error('not a PDF (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
      const pdfPath = TMP + '/' + job.out.replace(/\.jpg$/i, '.pdf');
      fs.writeFileSync(pdfPath, buf);
      const doc = await pdf(pdfPath, { scale: 2.4 });
      const total = doc.length;
      let png = null;
      for await (const page of doc) { png = page; break; }
      if (!png) throw new Error('no page rendered');
      const pngPath = TMP + '/' + job.out.replace(/\.jpg$/i, '.png');
      fs.writeFileSync(pngPath, png);
      const jpgPath = TMP + '/' + job.out;
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', pngPath, '-q:v', '2', '-pix_fmt', 'yuvj420p', jpgPath]);
      const dims = ffprobeSize(jpgPath);
      const gs = grayStats(jpgPath);
      if (dims.w < 400 || dims.h < 500) throw new Error('degenerate image ' + dims.w + 'x' + dims.h);
      if (gs.sd < 5 || gs.min > 200) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      const text = ocrText(pngPath, job.out.replace(/\W+/g, '-')).toLowerCase();
      const ok = job.need.every(re => re.test(text));
      if (!ok) throw new Error('OCR does not confirm identity (chars=' + text.replace(/\s/g, '').length + ')');
      fs.copyFileSync(jpgPath, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = 'pdf page 1/' + total;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = job.method;
      entry.pdf_page = 1;
      entry.pdf_pages = total;
      entry.page_selection = 'archive_case_file_document';
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log('HN-607  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + job.out);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      console.log('HN-607  FAIL  ' + e.message);
    }
    ledger.items[key] = entry;
  }

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
