// Acquire the cited-collection newspaper clippings exposed by the FSU Emmett
// Till Archives LibGuide (HN-606 cites all three media-coverage pages):
//   Clarion_Ledger.jpg   - Clarion-Ledger, 24 Sept 1955
//   Afro-American.jpg    - Baltimore Afro-American, 17 Sept 1955
//   NYT.jpg              - New York Times, 10 Nov 1955
//
// These are the library's own uploads of its newspaper scans (landscape
// clippings, 1640x924). Stored unmodified as archive_clipping_image /
// additional_cited_article with the cited LibGuide named as provider.
// No cropping, retouching, or generation. OCR is used only to confirm identity
// (no OCR text is stored). The Till_Collage.png composite is skipped.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/fsu-acquire';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PROVIDER = 'Florida State University Libraries (Emmett Till Archives LibGuide)';

const JOBS = [
  {
    hn_id: 'HN-606',
    page_url: 'https://guides.lib.fsu.edu/Till/resourceguide/clarionledger',
    image_url: 'https://libapps.s3.amazonaws.com/accounts/221478/images/Clarion_Ledger.jpg',
    newspaper: 'Clarion-Ledger (Jackson, Mississippi)',
    issue_date: '1955-09-24',
    out: 'hn-606-fsu-clarion-ledger-19550924-clipping.jpg',
    need: [/till/i, /jury|defendant|freed/i],
    note: 'FSU Libraries LibGuide scan of the Clarion-Ledger front page, 24 September 1955: "Till Case Defendants Freed By Jury." Library-uploaded clipping of the archive\'s own newspaper scan. Identity confirmed by OCR (page locator only).',
  },
  {
    hn_id: 'HN-606',
    page_url: 'https://guides.lib.fsu.edu/Till/resourceguide/baltimoreafroamerican',
    image_url: 'https://libapps.s3.amazonaws.com/accounts/221478/images/Afro-American.jpg',
    newspaper: 'Baltimore Afro-American',
    issue_date: '1955-09-17',
    out: 'hn-606-fsu-baltimore-afro-19550917-clipping.jpg',
    need: [/till|lynch/i, /trial/i],
    note: 'FSU Libraries LibGuide scan of the Baltimore Afro-American front page, 17 September 1955: "Trial Set In Lynching." Library-uploaded clipping of the archive\'s own newspaper scan. Identity confirmed by OCR (page locator only).',
  },
  {
    hn_id: 'HN-606',
    page_url: 'https://guides.lib.fsu.edu/Till/newyorktimes',
    image_url: 'https://libapps.s3.amazonaws.com/accounts/221478/images/NYT.jpg',
    newspaper: 'The New York Times',
    issue_date: '1955-11-10',
    out: 'hn-606-fsu-nyt-19551110-clipping.jpg',
    need: [/till/i, /indict|kidnap/i],
    note: 'FSU Libraries LibGuide scan of the New York Times front page, 10 November 1955: "Grand Jury in Till Case Fails to Indict Two White Men Accused in Kidnapping." Library-uploaded clipping of the archive\'s own newspaper scan. Identity confirmed by OCR (page locator only).',
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
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 180000 }); }
  catch (e) { return ''; }
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};

  for (const job of JOBS) {
    const key = job.hn_id + '|' + job.page_url + '|' + job.out;
    const entry = {
      hn_id: job.hn_id, provider: PROVIDER, status: 'pending', page_url: job.page_url,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const r = await fetch(job.image_url, { headers: { 'User-Agent': UA, Referer: job.page_url }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
      const tmp = TMP + '/' + job.out;
      fs.writeFileSync(tmp, buf);
      const dims = ffprobeSize(tmp);
      const gs = grayStats(tmp);
      if (dims.w < 150 || dims.h < 120) throw new Error('degenerate image ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      const text = ocrText(tmp, job.hn_id + '-' + job.out).toLowerCase();
      const ok = job.need.every(re => re.test(text));
      if (!ok) throw new Error('OCR does not confirm identity (chars=' + text.replace(/\s/g, '').length + ')');
      fs.copyFileSync(tmp, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = dims.w + 'x' + dims.h;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = 'archive_clipping_image';
      entry.page_selection = 'archive_libguide_image';
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
