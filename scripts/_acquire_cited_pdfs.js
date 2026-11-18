// Acquire newspaper-page scans exposed by two cited coverage collections:
//   HN-663 jcfa.org "Newspaper Coverage of the Six-Day War"
//     - Washington Post, 6 June 1967, front page
//     - New York Times, 11 June 1967, front page
//   HN-682 genocidebangladesh.org "Newspaper reports"
//     - New York Times, 28 March 1971, single-page clipping
//
// These are the cited pages' own newspaper scans. Stored unmodified as
// archive_pdf_page_rendition / additional_cited_article (contemporaneous
// reports from other newspapers, cited in hn_urls.json, alongside each
// record's primary Indiana page). No cropping, retouching, or generation.
// OCR is used only to confirm identity (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/cited-pdfs';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const JOBS = [
  {
    hn_id: 'HN-663',
    provider: 'JCFA (jcfa.org) newspaper coverage collection',
    page_url: 'https://jcfa.org/article/newspaper-coverage-of-the-six-day-war/',
    image_url: 'https://jcfa.org/wp-content/uploads/2011/11/washington_post_june_6.pdf',
    newspaper: 'The Washington Post',
    issue_date: '1967-06-06',
    out: 'hn-663-jcfa-washington-post-19670606-p1.jpg',
    pdf_page: 1,
    scale: 2.4,
    need: [/washington|post/i, /israel|gaza|jordan|arab/i],
    note: 'Front page of The Washington Post, 6 June 1967, as reproduced by the JCFA "Newspaper Coverage of the Six-Day War" collection cited by HN-663. Contemporaneous coverage of the war\'s outbreak. Identity confirmed by OCR (page locator only).',
  },
  {
    hn_id: 'HN-663',
    provider: 'JCFA (jcfa.org) newspaper coverage collection',
    page_url: 'https://jcfa.org/article/newspaper-coverage-of-the-six-day-war/',
    image_url: 'https://jcfa.org/wp-content/uploads/2011/11/new_york_times_june_11.pdf',
    newspaper: 'The New York Times',
    issue_date: '1967-06-11',
    out: 'hn-663-jcfa-new-york-times-19670611-p1.jpg',
    pdf_page: 1,
    scale: 2.4,
    need: [/new york|times/i, /israel|gaza|jordan|arab|nasser/i],
    note: 'Front page of The New York Times, 11 June 1967, as reproduced by the JCFA "Newspaper Coverage of the Six-Day War" collection cited by HN-663. Contemporaneous coverage as the war ended. Identity confirmed by OCR (page locator only).',
  },
  {
    hn_id: 'HN-682',
    provider: 'Bangladesh Genocide Archive (docstrangelove.com newspaper-report scans)',
    page_url: 'https://www.genocidebangladesh.org/newspaper-reports/',
    image_url: 'http://www.docstrangelove.com/uploads/1971/foreign/19710328_nyt_army_expels_35_foreign_newsmen_from_pakistan.pdf',
    newspaper: 'The New York Times',
    issue_date: '1971-03-28',
    out: 'hn-682-bga-new-york-times-19710328-clipping.jpg',
    pdf_page: 1,
    scale: 2.0,
    need: [/army|newsmen|pakistan/i, /dacca|pakistani|foreign/i],
    note: 'New York Times clipping, 28 March 1971: "Army Expels 35 Foreign Newsmen From Pakistan," as reproduced by the Bangladesh Genocide Archive newspaper-reports page cited by HN-682. Contemporaneous coverage of the East Pakistan crisis. Identity confirmed by OCR (page locator only).',
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
  const args = ['-v', 'error', '-y', '-i', jpeg];
  if (d.w < 1100) args.push('-vf', 'scale=iw*2:ih*2');
  args.push('-pix_fmt', 'rgb24', png);
  execFileSync('ffmpeg', args);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 180000 }); }
  catch (e) { return ''; }
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const { pdf } = await import('pdf-to-img');
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};

  for (const job of JOBS) {
    const key = job.hn_id + '|' + job.page_url + '|' + job.out;
    const entry = {
      hn_id: job.hn_id, provider: job.provider, status: 'pending', page_url: job.page_url,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const r = await fetch(job.image_url, { headers: { 'User-Agent': UA, Referer: job.page_url }, redirect: 'follow', signal: AbortSignal.timeout(240000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.slice(0, 4).toString() !== '%PDF') throw new Error('not a PDF (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
      const pdfPath = TMP + '/' + job.out.replace(/\.jpg$/i, '.pdf');
      fs.writeFileSync(pdfPath, buf);
      const doc = await pdf(pdfPath, { scale: job.scale });
      const total = doc.length;
      let n = 0, png = null;
      for await (const page of doc) {
        n++;
        if (n === job.pdf_page) { png = page; break; }
      }
      if (!png) throw new Error('page ' + job.pdf_page + ' not found (pages=' + total + ')');
      const pngPath = TMP + '/' + job.out.replace(/\.jpg$/i, '.png');
      fs.writeFileSync(pngPath, png);
      const jpgPath = TMP + '/' + job.out;
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', pngPath, '-q:v', '2', jpgPath]);
      const dims = ffprobeSize(jpgPath);
      const gs = grayStats(jpgPath);
      if (dims.w < 150 || dims.h < 120) throw new Error('degenerate image ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      const text = ocrText(jpgPath, job.hn_id + '-' + job.out).toLowerCase();
      const ok = job.need.every(re => re.test(text));
      if (!ok) throw new Error('OCR does not confirm identity (chars=' + text.replace(/\s/g, '').length + ')');
      fs.copyFileSync(jpgPath, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = 'pdf page ' + job.pdf_page + '/' + total;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = 'archive_pdf_page_rendition';
      entry.pdf_page = job.pdf_page;
      entry.pdf_pages = total;
      entry.page_selection = 'archive_collection_front_page';
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log(job.hn_id + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + job.out);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      console.log(job.hn_id + '  FAIL  ' + e.message);
    }
    ledger.items[key] = entry;
  }

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
