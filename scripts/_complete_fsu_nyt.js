// Complete the third FSU LibGuide acquisition (NYT) from the cached download.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/fsu-acquire';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const PROVIDER = 'Florida State University Libraries (Emmett Till Archives LibGuide)';

const job = {
  hn_id: 'HN-606',
  page_url: 'https://guides.lib.fsu.edu/Till/newyorktimes',
  newspaper: 'The New York Times',
  issue_date: '1955-11-10',
  out: 'hn-606-fsu-nyt-19551110-clipping.jpg',
  need: [/till/i, /indict|kidnap/i],
  note: 'FSU Libraries LibGuide scan of the New York Times front page, 10 November 1955: "Grand Jury in Till Case Fails to Indict Two White Men Accused in Kidnapping." Library-uploaded clipping of the archive\'s own newspaper scan. Identity confirmed by OCR (page locator only).',
};

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

const tmp = TMP + '/NYT.jpg';
if (!fs.existsSync(tmp)) { console.error('cached NYT.jpg missing'); process.exit(1); }
const dims = ffprobeSize(tmp);
const gs = grayStats(tmp);
if (dims.w < 150 || dims.h < 120) { console.error('degenerate image'); process.exit(1); }
if (gs.sd < 3 || gs.min > 220) { console.error('image looks blank'); process.exit(1); }
const text = ocrText(tmp, 'nyt').toLowerCase();
if (!job.need.every(re => re.test(text))) { console.error('OCR does not confirm identity: ' + text.slice(0, 300)); process.exit(1); }

fs.copyFileSync(tmp, IMG_DIR + '/' + job.out);
const ledger = readJson(LEDGER);
if (!ledger.items) ledger.items = {};
const key = job.hn_id + '|' + job.page_url + '|' + job.out;
ledger.items[key] = {
  hn_id: job.hn_id, provider: PROVIDER, status: 'image_acquired', page_url: job.page_url,
  newspaper: job.newspaper, issue_date: job.issue_date, error: null,
  full_page_asset: 'assets/images/' + job.out,
  source_dimensions: dims.w + 'x' + dims.h,
  output_dimensions: dims.w + 'x' + dims.h,
  mosaic_method: 'archive_clipping_image',
  page_selection: 'archive_libguide_image',
  article_note: job.note,
  additional_cited_article: true,
  gray_stats: { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) },
  acquired_at: new Date().toISOString(),
};
ledger.generated_at = new Date().toISOString();
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
console.log('HN-606  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + job.out);
const imgs = buildImages();
console.log('Records with images (all providers): ' + Object.keys(imgs).length);
