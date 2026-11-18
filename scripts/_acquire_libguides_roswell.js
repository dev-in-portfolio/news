// Acquire newspaper clippings exposed by the New Mexico State Library LibGuide
// page cited by HN-565 (Roswell, July 1947):
//   Clovis News Journal, 9 July 1947, p. 1 (front-page strip)
//   Corsicana (Texas) paper, "Disk Craze Continues / Army Discounts New Mexico
//   Find As Weather Gear"
// Both are the library's own scans. Stored unmodified as archive_clipping_image
// with the cited collection named as provider. No cropping, retouching, or
// generation. OCR is used only to confirm identity (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/libguides';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PAGE_URL = 'https://libguides.nmstatelibrary.org/c.php?g=1380278&p=10206077';
const PROVIDER = 'New Mexico State Library LibGuide (Roswell newspaper scans)';

const JOBS = [
  {
    image_url: 'https://libapps.s3.amazonaws.com/accounts/358946/images/Clovis-News-Journal-Jul_09-1947-p-1.jpeg',
    newspaper: 'Clovis News Journal',
    issue_date: '1947-07-09',
    out: 'hn-565-nmsl-clovis-news-journal-19470709-p1-clipping.jpg',
    need: [/clovis|new mexico/i, /disc|saucer|roswell|balloon/i],
    note: 'New Mexico State Library scan of the Clovis News Journal front page (strip), 9 July 1947: "New Mexico Rancher Is Surprised … Excitement Created By His \'Disc\' Discovery" and the Army weather-balloon retraction. Identity confirmed by OCR (page locator only).',
  },
  {
    image_url: 'https://libapps.s3.amazonaws.com/accounts/358946/images/Corsicana.jpg',
    newspaper: 'Corsicana Daily Sun (Texas)',
    issue_date: '1947-07-09',
    out: 'hn-565-nmsl-corsicana-19470709-clipping.jpg',
    need: [/disk craze|new mexico/i, /weather gear|army|balloon/i],
    note: 'New Mexico State Library scan of a Corsicana (Texas) newspaper clipping, July 1947: "Disk Craze Continues — Army Discounts New Mexico Find As Weather Gear". Identity confirmed by OCR (page locator only).',
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
async function fetchJpeg(url, attempts) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: PAGE_URL }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf[0] === 0xFF && buf[1] === 0xD8) return buf;
      last = new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
    } catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 2500));
  }
  throw last;
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};

  for (const job of JOBS) {
    const key = 'HN-565|' + PAGE_URL + '|' + job.out;
    const entry = {
      hn_id: 'HN-565', provider: PROVIDER, status: 'pending', page_url: PAGE_URL,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const buf = await fetchJpeg(job.image_url, 3);
      const tmp = TMP + '/' + job.out;
      fs.writeFileSync(tmp, buf);
      const dims = ffprobeSize(tmp);
      const gs = grayStats(tmp);
      if (dims.w < 150 || dims.h < 120) throw new Error('degenerate clipping ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('clipping looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      const text = ocrText(tmp, job.out).toLowerCase();
      const ok = job.need.every(re => re.test(text));
      if (!ok) throw new Error('OCR does not confirm identity (chars=' + text.replace(/\s/g, '').length + ')');
      fs.copyFileSync(tmp, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = dims.w + 'x' + dims.h;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = 'archive_clipping_image';
      entry.page_selection = 'archive_collection_clipping';
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log('HN-565  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + job.out);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      console.log('HN-565  FAIL  ' + job.out + '  ' + e.message);
    }
    ledger.items[key] = entry;
  }

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
