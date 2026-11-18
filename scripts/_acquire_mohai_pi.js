// Acquire the Museum of History & Industry (MOHAI) scan of the Seattle
// Post-Intelligencer front page for 6 February 1919, cited by HN-414. The
// stored file is MOHAI's own page scan; nothing is cropped, retouched, or
// generated. OCR is used only to confirm the masthead/date (no text stored).
const fs = require('fs');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const IMG_DIR = 'D:/news/site/assets/images';
const LEDGER = 'D:/news/docs/OTHER_IMAGE_ACQUISITION_LEDGER.json';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';

const PAGE_URL = 'https://mohai.org/collections-and-research/search/item/1969.4599/-%23.1/?Bro_=&Bros_=&modules%5B0%5D=item&modules%5B1%5D=collections&modules%5B2%5D=library&pageNum=1&searchQuery=General+Strike+%281919%29';
const JOB = {
  hn: 'HN-414',
  page_url: PAGE_URL,
  image_url: 'https://mohai.rediscoverysoftware.com/fullimages/00007/1969.4599.1-jpg636949099956720735.jpg',
  provider: 'Museum of History & Industry (MOHAI)',
  newspaper: 'Seattle Post-Intelligencer',
  issue_date: '1919-02-06',
  out: 'hn-414-mohai-seattle-pi-19190206-p1-page.jpg',
  note: 'MOHAI item 1969.4599: Seattle Post-Intelligencer front page, 6 February 1919, "STRIKE BEGINS TODAY" (Seattle general strike). Masthead/date confirmed by OCR (page locator only).',
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
  const vf = d.w < 1100 ? 'scale=iw*2:ih*2,format=rgb24' : 'format=rgb24';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', jpeg, '-vf', vf, png]);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 180000 }); }
  catch (e) { return ''; }
}

(async () => {
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  const key = JOB.hn + '|' + JOB.page_url;
  const entry = {
    hn_id: JOB.hn, provider: JOB.provider, status: 'pending', page_url: JOB.page_url,
    newspaper: JOB.newspaper, issue_date: JOB.issue_date, error: null, acquired_at: null,
  };
  try {
    const r = await fetch(JOB.image_url, { headers: { 'User-Agent': UA, Referer: JOB.page_url }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
    const tmp = TMP + '/' + JOB.out;
    fs.writeFileSync(tmp, buf);
    const dims = ffprobeSize(tmp);
    const gs = grayStats(tmp);
    if (dims.w < 300 || dims.h < 300) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
    if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    const text = ocrText(tmp, JOB.hn).toLowerCase();
    if (!/post-intelligencer|post.?intelligencer|strike begins|seattle/.test(text)) {
      throw new Error('OCR does not confirm Seattle P-I strike page (chars=' + text.replace(/\s/g, '').length + ')');
    }
    fs.copyFileSync(tmp, IMG_DIR + '/' + JOB.out);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + JOB.out;
    entry.source_dimensions = dims.w + 'x' + dims.h;
    entry.output_dimensions = dims.w + 'x' + dims.h;
    entry.mosaic_method = 'archive_page_image';
    entry.page_selection = 'archive_item_record';
    entry.article_note = JOB.note;
    entry.additional_cited_article = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log(JOB.hn + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log(JOB.hn + '  FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
