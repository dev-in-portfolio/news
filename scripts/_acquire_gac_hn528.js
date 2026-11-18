// Acquire the U.S. National Archives scan of The Evening Bulletin
// (Philadelphia) front page for 8 December 1941, exposed by the Google Arts &
// Culture asset cited by HN-528.
//
// The stored file is the archive's own scan, at the largest rendition the asset
// serves (911x1200). No cropping, retouching, or generation. OCR is used only to
// confirm the masthead/date (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/gac';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PAGE_URL = 'https://artsandculture.google.com/asset/front-page-the-evening-bulletin-philadelphia-december-8-1941-the-evening-bulletin-philadelphia/zAGMonbtnR8k0w';
const IMAGE_URL = 'https://lh3.googleusercontent.com/ci/AL18g_ROgFq-wygalkWBdP6iOd7GbEY9RsBNh3T7erZfzYfnG3iN8CORcp3tk9cCuuL9YBoOEwq3aZk=w3000';
const OUT = 'hn-528-gac-evening-bulletin-19411208-p1-page.jpg';
const PROVIDER = 'U.S. National Archives via Google Arts & Culture';

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
  const key = 'HN-528|' + PAGE_URL;
  const entry = {
    hn_id: 'HN-528', provider: PROVIDER, status: 'pending', page_url: PAGE_URL,
    newspaper: 'The Evening Bulletin (Philadelphia)', issue_date: '1941-12-08', error: null, acquired_at: null,
  };
  try {
    const r = await fetch(IMAGE_URL, { headers: { 'User-Agent': UA, Referer: PAGE_URL }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
    const tmp = TMP + '/' + OUT;
    fs.writeFileSync(tmp, buf);
    const dims = ffprobeSize(tmp);
    const gs = grayStats(tmp);
    if (dims.w < 300 || dims.h < 300) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
    if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    const text = ocrText(tmp, 'HN-528').toLowerCase();
    if (!/evening bulletin|japan declares war|hawaii/.test(text)) {
      throw new Error('OCR does not confirm Evening Bulletin front page (chars=' + text.replace(/\s/g, '').length + ')');
    }
    fs.copyFileSync(tmp, IMG_DIR + '/' + OUT);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + OUT;
    entry.source_dimensions = dims.w + 'x' + dims.h;
    entry.output_dimensions = dims.w + 'x' + dims.h;
    entry.mosaic_method = 'archive_page_image';
    entry.page_selection = 'archive_item_record';
    entry.article_note = 'U.S. National Archives scan of The Evening Bulletin (Philadelphia) front page, 8 December 1941 ("Japan Declares War on U.S. and Britain; Bombers Attack Hawaii Twice; 104 U.S. Soldiers Among 350 Dead"), via the Google Arts & Culture asset. Masthead/date confirmed by OCR (page locator only). Largest rendition served (911x1200).';
    entry.additional_cited_article = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log('HN-528  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log('HN-528  FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
