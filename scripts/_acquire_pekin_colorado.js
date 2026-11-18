// Acquire two cited-collection newspaper scans:
//   HN-513  Pekin Public Library scan of the Pekin Daily Times, 31 Oct 1938
//           ("Pekinites Alarmed" about the War of the Worlds broadcast).
//   HN-248  Colorado Virtual Library excerpt of the Rocky Mountain News,
//           1 Nov 1880 ("The Country's Boiling Indignation Over Garfield's
//           Declaration in Favor of Chinese").
//
// Each cited page exposes its own scan of a newspaper page/clipping. Following
// the LaMartin / W.J. Cash precedent, the image is stored unmodified as
// archive_clipping_image with the cited collection named as provider. No
// cropping, retouching, or generation. OCR is used only to confirm identity
// (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/collections';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const JOBS = [
  {
    hn: 'HN-513',
    provider: 'Pekin Public Library (Pekin Daily Times scan)',
    page_url: 'https://pekinpubliclibrary.org/pekinites-alarmed-in-1938-war-of-the-worlds-radio-panic/',
    image_url: 'https://pekinpubliclibrary.org/wp-content/uploads/2019/10/war-of-the-worlds-pdt-10.31.1938.jpg',
    newspaper: 'Pekin Daily Times',
    issue_date: '1938-10-31',
    out: 'hn-513-pekin-public-library-pekin-daily-times-19381031-clipping.jpg',
    need: [/pekin/i, /war|mars|martian|worms/i],
    note: 'Pekin Public Library scan of the Pekin Daily Times, 31 October 1938: "Pekinites Alarmed" (War of the Worlds broadcast reaction). Clipping identity confirmed by OCR (page locator only).',
  },
  {
    hn: 'HN-248',
    provider: 'Colorado Virtual Library (Rocky Mountain News scan)',
    page_url: 'https://www.coloradovirtuallibrary.org/digital-colorado/colorado-historic-newspapers-collection/chinatown-is-now-a-mass-of-ruins-how-the-racial-violence-of-1880-was-reported-in-denver/',
    image_url: 'https://www.coloradovirtuallibrary.org/wp-content/uploads/Rocky-Mountain-News-Daily-Volume-21-November-1-1880.jpg',
    newspaper: 'Rocky Mountain News',
    issue_date: '1880-11-01',
    out: 'hn-248-colorado-virtual-library-rocky-mountain-news-18801101-clipping.jpg',
    need: [/garfield|morey/i, /chinese|china/i],
    note: 'Colorado Virtual Library excerpt of the Rocky Mountain News, 1 November 1880: "The Country\'s Boiling Indignation Over Garfield\'s Declaration in Favor of Chinese — Its Authenticity Sustained by Expert Evidence" (the Morey letter). Excerpt identity confirmed by OCR (page locator only).',
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
      if (dims.w < 150 || dims.h < 120) throw new Error('degenerate excerpt ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('excerpt looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      const text = ocrText(tmp, job.hn);
      const low = text.toLowerCase();
      const ok = job.need.every(re => re.test(low));
      if (!ok) throw new Error('OCR does not confirm clipping identity (chars=' + low.replace(/\s/g, '').length + ')');
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
