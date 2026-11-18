// Acquire the Vorarlberger Tagblatt excerpt that HN-510 cites via the
// "Crossing the Border" exhibit (indexprev3_en.php?id=3):
//   3c_Vorarlberger_Tagblatt_1938_3_18_b.jpg
//
// The exhibit's own caption identifies it as an excerpt from the Vorarlberger
// Tagblatt of 18 March 1938, credited to the Austrian Newspaper Online
// (Austrian National Library). It is a rendition of the archive's own scan,
// hosted by the cited exhibit. Stored unmodified as archive_clipping_image /
// additional_cited_article (a contemporaneous report from another newspaper
// cited in hn_urls.json, alongside the record's primary Jewish Post page).
// No cropping, retouching, or generation. OCR is used only to confirm it is a
// newspaper page (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/crossborder-acquire';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const JOB = {
  hn_id: 'HN-510',
  provider: 'Crossing the Border exhibit (Austrian National Library scan of the Vorarlberger Tagblatt)',
  page_url: 'https://crossing-the-border.info/indexprev3_en.php?id=3',
  image_url: 'https://crossing-the-border.info/img_slider/3c_Vorarlberger_Tagblatt_1938_3_18_b.jpg',
  newspaper: 'Vorarlberger Tagblatt',
  issue_date: '1938-03-18',
  out: 'hn-510-vorarlberger-tagblatt-19380318-clipping.jpg',
  note: 'Excerpt from the Vorarlberger Tagblatt, 18 March 1938, reproduced by the "Crossing the Border" exhibit and credited there to the Austrian Newspaper Online (Austrian National Library). Contemporaneous Austrian report on the Anschluss, cited by HN-510 alongside its primary Jewish Post page. Identity taken from the exhibit caption; OCR used only to confirm it is a printed newspaper page.',
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

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  const key = JOB.hn_id + '|' + JOB.page_url + '|' + JOB.out;
  const entry = {
    hn_id: JOB.hn_id, provider: JOB.provider, status: 'pending', page_url: JOB.page_url,
    newspaper: JOB.newspaper, issue_date: JOB.issue_date, error: null, acquired_at: null,
  };
  try {
    const r = await fetch(JOB.image_url, { headers: { 'User-Agent': UA, Referer: JOB.page_url }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
    const tmp = TMP + '/' + JOB.out;
    fs.writeFileSync(tmp, buf);
    const dims = ffprobeSize(tmp);
    const gs = grayStats(tmp);
    if (dims.w < 150 || dims.h < 120) throw new Error('degenerate image ' + dims.w + 'x' + dims.h);
    if (gs.sd < 3 || gs.min > 220) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    const text = ocrText(tmp, 'hn-510-vt');
    const chars = text.replace(/\s/g, '').length;
    if (chars < 200) throw new Error('OCR does not confirm a newspaper page (chars=' + chars + ')');
    fs.copyFileSync(tmp, IMG_DIR + '/' + JOB.out);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + JOB.out;
    entry.source_dimensions = dims.w + 'x' + dims.h;
    entry.output_dimensions = dims.w + 'x' + dims.h;
    entry.mosaic_method = 'archive_clipping_image';
    entry.page_selection = 'archive_exhibit_caption';
    entry.article_note = JOB.note;
    entry.additional_cited_article = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log(JOB.hn_id + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  chars=' + chars + '  ' + JOB.out);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log(JOB.hn_id + '  FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
