// Acquire the My Al Capone Museum's own scan of The Rhinelander Daily News
// clipping "Capone Given 11 Years, $50,000 Fine", cited by HN-474 via the
// museum's "Newspapers Part Four" page.
//
// Following the LaMartin private-collection precedent: the cited page exposes
// its own scan of a newspaper clipping. One clipping is stored as
// archive_clipping_image with the collection named as provider. No cropping,
// retouching, or generation. OCR is used only to confirm the clipping identity
// (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/capone';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PAGE_URL = 'https://www.myalcaponemuseum.com/id145.htm';
const IMAGE_URL = 'https://www.myalcaponemuseum.com/103506a80.jpg';
const OUT = 'hn-474-capone-museum-rhinelander-daily-news-19311024-clipping.jpg';
const PROVIDER = 'My Al Capone Museum (newspaper clipping collection)';

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
  const key = 'HN-474|' + PAGE_URL;
  const entry = {
    hn_id: 'HN-474', provider: PROVIDER, status: 'pending', page_url: PAGE_URL,
    newspaper: 'The Rhinelander Daily News', issue_date: '1931-10-24', error: null, acquired_at: null,
  };
  try {
    const r = await fetch(IMAGE_URL, { headers: { 'User-Agent': UA, Referer: PAGE_URL }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
    const tmp = TMP + '/' + OUT;
    fs.writeFileSync(tmp, buf);
    const dims = ffprobeSize(tmp);
    const gs = grayStats(tmp);
    if (dims.w < 300 || dims.h < 300) throw new Error('degenerate clipping ' + dims.w + 'x' + dims.h);
    if (gs.sd < 3 || gs.min > 220) throw new Error('clipping looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    const text = ocrText(tmp, 'HN-474').toLowerCase();
    if (!/capone/.test(text) || !/(11 years|eleven years|50,000|fifty thousand)/.test(text)) {
      throw new Error('OCR does not confirm Capone 11-year sentence clipping (chars=' + text.replace(/\s/g, '').length + ')');
    }
    fs.copyFileSync(tmp, IMG_DIR + '/' + OUT);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + OUT;
    entry.source_dimensions = dims.w + 'x' + dims.h;
    entry.output_dimensions = dims.w + 'x' + dims.h;
    entry.mosaic_method = 'archive_clipping_image';
    entry.page_selection = 'archive_collection_clipping';
    entry.article_note = 'My Al Capone Museum scan of a The Rhinelander Daily News clipping, 24 October 1931: "Capone Given 11 Years, $50,000 Fine". Clipping identity confirmed by OCR (page locator only).';
    entry.additional_cited_article = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log('HN-474  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log('HN-474  FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
