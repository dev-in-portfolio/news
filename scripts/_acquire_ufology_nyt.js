// Acquire the scan of the New York Times article of 11 March 1950 exposed by the
// ufology.patrickgross.org page cited by HN-578.
//
// The stored file is the collection's own scan of the article (a single-column
// excerpt of the newspaper page). No cropping, retouching, or generation. OCR is
// used only to confirm the article identity (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/ufology';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PAGE_URL = 'https://www.ufology.patrickgross.org/press/nyt11mar50.htm';
const IMAGE_URL = 'https://www.ufology.patrickgross.org/press/pics/nyt11mar50.jpg';
const OUT = 'hn-578-ufology-nyt-19500311-clipping.jpg';
const PROVIDER = 'ufology.patrickgross.org (New York Times press-scan collection)';

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
  const key = 'HN-578|' + PAGE_URL;
  const entry = {
    hn_id: 'HN-578', provider: PROVIDER, status: 'pending', page_url: PAGE_URL,
    newspaper: 'The New York Times', issue_date: '1950-03-11', error: null, acquired_at: null,
  };
  try {
    const r = await fetch(IMAGE_URL, { headers: { 'User-Agent': UA, Referer: PAGE_URL }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
    const tmp = TMP + '/' + OUT;
    fs.writeFileSync(tmp, buf);
    const dims = ffprobeSize(tmp);
    const gs = grayStats(tmp);
    if (dims.w < 150 || dims.h < 120) throw new Error('degenerate clipping ' + dims.w + 'x' + dims.h);
    if (gs.sd < 3 || gs.min > 220) throw new Error('clipping looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    const text = ocrText(tmp, 'HN-578').toLowerCase();
    if (!/flying saucers|americans again|defen[cs]e department/.test(text)) {
      throw new Error('OCR does not confirm NYT flying-saucer article (chars=' + text.replace(/\s/g, '').length + ')');
    }
    fs.copyFileSync(tmp, IMG_DIR + '/' + OUT);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + OUT;
    entry.source_dimensions = dims.w + 'x' + dims.h;
    entry.output_dimensions = dims.w + 'x' + dims.h;
    entry.mosaic_method = 'archive_clipping_image';
    entry.page_selection = 'archive_collection_clipping';
    entry.article_note = 'ufology.patrickgross.org scan of a New York Times article, 11 March 1950: "Americans Again See Visions — Little Men in Flying Saucers" (Defence Department denial). Article identity confirmed by OCR (page locator only).';
    entry.additional_cited_article = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log('HN-578  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log('HN-578  FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
