// Download the Library of Virginia "Titanic in Black and White" exhibit's own
// scans of the dated newspaper pages cited by HN-382 (17 April 1912) and
// HN-383 (19 April 1912). Each stored file is the exhibit's own page scan;
// nothing is cropped, retouched, or generated. OCR is used only to confirm the
// page is Titanic coverage (no OCR text is stored).
const fs = require('fs');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const IMG_DIR = 'D:/news/site/assets/images';
const LEDGER = 'D:/news/docs/OTHER_IMAGE_ACQUISITION_LEDGER.json';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode';
const PAGE_URL = 'https://www.lva.virginia.gov/events/exhibitions/titanic/newspaper_coverage.php';
const PROVIDER = 'Library of Virginia (Titanic in Black and White exhibit)';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';

const JOBS = [
  {
    hn: 'HN-382',
    newspaper: 'The Times-Dispatch (Richmond, VA)',
    issue_date: '1912-04-17',
    image_url: 'https://www.lva.virginia.gov/events/exhibitions/titanic/img/newspaper_coverage/newspaper_4.jpg',
    out: 'hn-382-lva-timesdispatch-19120417-p1-page.jpg',
    note: 'Exhibit caption: Times-Dispatch (Richmond, VA), 17 April 1912; first-day Titanic survivor/death reports.',
  },
  {
    hn: 'HN-383',
    newspaper: 'Bottineau Courant',
    issue_date: '1912-04-19',
    image_url: 'https://www.lva.virginia.gov/events/exhibitions/titanic/img/newspaper_coverage/newspaper_18.jpg',
    out: 'hn-383-lva-bottineau-courant-19120419-p1-page.jpg',
    note: 'Exhibit caption: Bottineau Courant, 19 April 1912; updated Titanic toll and lifeboat reporting.',
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
  // Windows OCR handles moderate-size JPEGs; upscale small scans to ~1400 px.
  const dim = ffprobeSize(jpeg);
  const png = TMP + '/' + tag + '-ocr.png';
  const vf = dim.w < 1100 ? 'scale=iw*2:ih*2,format=rgb24' : 'format=rgb24';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', jpeg, '-vf', vf, png]);
  try {
    return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 180000 });
  } catch (e) { return ''; }
}

(async () => {
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  for (const job of JOBS) {
    const key = job.hn + '|' + PAGE_URL;
    const entry = {
      hn_id: job.hn, provider: PROVIDER, status: 'pending', page_url: PAGE_URL,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const r = await fetch(job.image_url, { headers: { 'User-Agent': UA, Referer: PAGE_URL }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
      const tmp = TMP + '/' + job.out;
      fs.writeFileSync(tmp, buf);
      const dims = ffprobeSize(tmp);
      const gs = grayStats(tmp);
      if (dims.w < 300 || dims.h < 300) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      const text = ocrText(tmp, job.hn);
      const low = text.toLowerCase();
      const onTopic = /titanic|lost vessel|appalling disaster|more than 1300 drowned|atlantic disaster/.test(low);
      if (!onTopic) throw new Error('OCR does not confirm Titanic coverage (chars=' + text.replace(/\s/g, '').length + ')');
      fs.copyFileSync(tmp, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = dims.w + 'x' + dims.h;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = 'archive_page_image';
      entry.page_selection = 'archive_exhibit_caption';
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log(job.hn + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  titanic=' + (low.split('titanic').length - 1));
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
