// Acquire the newspaper page scan reproduced in NARA's Prologue article
// "Jitterbugs and Crack-pots" (HN-513 and HN-514 both cite that article):
//   war-of-worlds-newspaper-headline.jpg - Chicago Daily News, 31 Oct 1938,
//   "RADIO FAKE SCARES".
//
// NARA hosts its own scan of the newspaper page. Stored unmodified as
// archive_clipping_image / additional_cited_article with NARA named as
// provider. No cropping, retouching, or generation. OCR is used only to
// confirm identity (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/nara-acquire';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PROVIDER = 'U.S. National Archives (Prologue magazine scan)';

const JOBS = [
  {
    hn_id: 'HN-513',
    page_url: 'https://www.archives.gov/publications/prologue/2003/fall/war-of-worlds.html',
    image_url: 'https://www.archives.gov/files/publications/prologue/2003/fall/war-of-worlds-newspaper-headline.jpg',
    newspaper: 'Chicago Daily News',
    issue_date: '1938-10-31',
    out: 'hn-513-nara-chicago-daily-news-19381031-clipping.jpg',
    need: [/radio/i, /scare|mars|panic/i],
    note: 'U.S. National Archives scan of the Chicago Daily News front page, 31 October 1938: "Radio Fake Scares." Reproduced in the NARA Prologue article "Jitterbugs and Crack-pots," which HN-513 cites. Identity confirmed by OCR (page locator only).',
  },
  {
    hn_id: 'HN-514',
    page_url: 'https://www.archives.gov/publications/prologue/2003/fall/war-of-worlds.html',
    image_url: 'https://www.archives.gov/files/publications/prologue/2003/fall/war-of-worlds-newspaper-headline.jpg',
    newspaper: 'Chicago Daily News',
    issue_date: '1938-10-31',
    out: 'hn-514-nara-chicago-daily-news-19381031-clipping.jpg',
    need: [/radio/i, /scare|mars|panic/i],
    note: 'U.S. National Archives scan of the Chicago Daily News front page, 31 October 1938: "Radio Fake Scares." Reproduced in the NARA Prologue article "Jitterbugs and Crack-pots," which HN-514 cites. Identity confirmed by OCR (page locator only).',
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
      entry.page_selection = 'archive_article_illustration';
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
