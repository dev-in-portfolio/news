// Acquire two cited-collection newspaper scans:
//   HN-666  johnkeel.com scan of The Athens Messenger front page, 17 Dec 1967
//           ("Bridge Toll Still Unknown" — Silver Bridge collapse).
//   HN-277  legendsofkansas.com scan of the Frontenac mine-explosion newspaper
//           report ("Ninety-Six Found … The Terrible Mine Explosion").
//
// Each cited page exposes its own scan of a newspaper page. Following the
// LaMartin / W.J. Cash precedent, the image is stored unmodified with the cited
// collection named as provider. No cropping, retouching, or generation. OCR is
// used only to confirm identity (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/batch4';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const JOBS = [
  {
    hn: 'HN-666',
    provider: 'John Keel collection (The Athens Messenger scans)',
    page_url: 'https://www.johnkeel.com/?p=6008',
    image_url: 'https://www.johnkeel.com/wp-content/uploads/2025/12/MESSENGER1A.jpg',
    newspaper: 'The Athens Messenger',
    issue_date: '1967-12-17',
    out: 'hn-666-johnkeel-athens-messenger-19671217-p1-page.jpg',
    method: 'archive_page_image',
    selection: 'archive_collection_page',
    need: [/athens/i, /bridge|silver/i],
    note: 'John Keel collection scan of The Athens Messenger front page, 17 December 1967 ("Bridge Toll Still Unknown" — Silver Bridge collapse). Masthead/date confirmed by OCR (page locator only).',
  },
  {
    hn: 'HN-277',
    provider: 'Legends of Kansas (Frontenac mine-explosion newspaper scan)',
    page_url: 'https://legendsofkansas.com/frontenac-kansas/',
    image_url: 'https://legendsofkansas.com/wp-content/uploads/2022/04/Frontenac-kansas-mine-explosionnewspaper.jpg',
    newspaper: 'Frontenac mine-explosion report (newspaper clipping)',
    issue_date: '1888-11-15',
    out: 'hn-277-legendsofkansas-frontenac-mine-explosion-clipping.jpg',
    method: 'archive_clipping_image',
    selection: 'archive_collection_clipping',
    need: [/frontenac|mine/i, /explosion|victims|ninety/i],
    note: 'Legends of Kansas scan of a newspaper clipping on the Frontenac, Kansas mine explosion ("Ninety-Six Found … The Terrible Mine Explosion", dateline Pittsburg, Kan., Nov. 10). Clipping identity confirmed by OCR (page locator only).',
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
    const key = job.hn + '|' + job.page_url;
    const entry = {
      hn_id: job.hn, provider: job.provider, status: 'pending', page_url: job.page_url,
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
      const text = ocrText(tmp, job.hn).toLowerCase();
      const ok = job.need.every(re => re.test(text));
      if (!ok) throw new Error('OCR does not confirm identity (chars=' + text.replace(/\s/g, '').length + ')');
      fs.copyFileSync(tmp, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = dims.w + 'x' + dims.h;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = job.method;
      entry.page_selection = job.selection;
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log(job.hn + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min);
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
