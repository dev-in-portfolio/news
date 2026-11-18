// HN-677 cites the Flickr photo page
//   https://www.flickr.com/photos/vax80/49786877458/
// which displays the contributor's own scan of The Melbourne Herald,
// Saturday 18 April 1970, page 1 (Apollo 13 splashdown coverage).
//
// Store the scan unmodified as archive_page_image / additional_cited_article
// alongside the record's primary Mail-Journal page. OCR is used only to
// confirm the masthead/date identity (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/flickr-hn677';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE = 'https://www.flickr.com/photos/vax80/49786877458/';
const ORIGINAL = 'https://live.staticflickr.com/65535/49786877458_9861d976ae_o.jpg';

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
  const args = ['-v', 'error', '-y', '-i', jpeg, '-pix_fmt', 'rgb24', png];
  execFileSync('ffmpeg', args);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 240000 }); }
  catch (e) { return ''; }
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  const out = 'hn-677-flickr-melbourne-herald-19700418-p1-page.jpg';
  const key = 'HN-677|' + PAGE + '|' + out;
  const entry = {
    hn_id: 'HN-677',
    provider: 'Vax80 Flickr collection (Melbourne Herald page scan)',
    status: 'pending',
    page_url: PAGE,
    newspaper: 'The Melbourne Herald',
    issue_date: '1970-04-18',
    error: null,
    acquired_at: null,
  };
  try {
    let buf = null;
    for (let a = 1; a <= 4; a++) {
      try {
        const r = await fetch(ORIGINAL, { headers: { 'User-Agent': UA, Referer: PAGE }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
        const b = Buffer.from(await r.arrayBuffer());
        if (r.status === 200 && b[0] === 0xFF && b[1] === 0xD8) { buf = b; break; }
      } catch (e) { /* retry */ }
      await new Promise(res => setTimeout(res, 1500 * a));
    }
    if (!buf) throw new Error('could not fetch the original scan');
    const f = TMP + '/original.jpg';
    fs.writeFileSync(f, buf);
    const d = ffprobeSize(f);
    const gs = grayStats(f);
    if (d.w < 1200 || d.h < 1600) throw new Error('degenerate image ' + d.w + 'x' + d.h);
    if (gs.sd < 8 || gs.min > 210) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    const t = ocrText(f, 'hn677').replace(/\s+/g, ' ');
    const hasDate = /MELBOURNE.{0,40}APRIL 18.{0,10}1970/i.test(t);
    const hasApollo = /Apollo|Lovell|Haise|Swigert|Iwo Jima|recovery/i.test(t);
    console.log('OCR: ' + t.slice(0, 300));
    console.log('masthead/date=' + hasDate + '  Apollo=' + hasApollo);
    if (!hasDate) throw new Error('masthead/date not confirmed by OCR');
    fs.copyFileSync(f, IMG_DIR + '/' + out);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + out;
    entry.source_dimensions = d.w + 'x' + d.h;
    entry.output_dimensions = d.w + 'x' + d.h;
    entry.mosaic_method = 'archive_page_image';
    entry.page_selection = 'archive_collection_scan';
    entry.article_note = 'Front page of The Melbourne Herald, Saturday 18 April 1970, from the cited Flickr collection\'s own newspaper page scan. Its Apollo 13 splashdown report ("Hello, world — it\'s great to be here") is a related contemporaneous report accompanying HN-677\'s primary Mail-Journal account. Masthead and date confirmed by OCR (page locator only; no OCR text stored).';
    entry.additional_cited_article = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log('HN-677 OK  ' + d.w + 'x' + d.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + out);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log('HN-677 FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
