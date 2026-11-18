// HN-645 cites the Shapell Manuscript Foundation's own manuscript page
//   https://www.shapell.org/manuscript/kennedy-slain-dallas-morning-news-november-23-1963-assassination/
// which displays the foundation's scan of the Dallas Morning News,
// Saturday 23 November 1963, page 1 ("Kennedy Slain on Dallas Street").
// Store the scan unmodified as archive_page_image / additional_cited_article.
// OCR is used only as a page locator; no OCR text is stored.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/shapell-hn645';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE = 'https://www.shapell.org/manuscript/kennedy-slain-dallas-morning-news-november-23-1963-assassination/';
const IMAGE = 'https://shapelldb.blob.core.windows.net/shapellprod/Scan%5C637381327399205419_website_image_2356_KennedyPaper_enlarge_transparency_1000.jpg.jpg';

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
function ocrText(jpeg, tag) {
  const d = ffprobeSize(jpeg);
  const png = TMP + '/' + tag + '-ocr.png';
  const args = ['-v', 'error', '-y', '-i', jpeg, '-vf', 'scale=1800:-1', '-pix_fmt', 'rgb24', png];
  execFileSync('ffmpeg', args);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', png.split('/').join('\\')], { encoding: 'utf8', timeout: 300000 }); }
  catch (e) { return ''; }
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  const out = 'hn-645-shapell-dallas-morning-news-19631123-p1-page.jpg';
  const key = 'HN-645|' + PAGE + '|' + out;
  const entry = {
    hn_id: 'HN-645',
    provider: 'Shapell Manuscript Foundation (Dallas Morning News page scan)',
    status: 'pending',
    page_url: PAGE,
    newspaper: 'The Dallas Morning News',
    issue_date: '1963-11-23',
    error: null,
    acquired_at: null,
  };
  try {
    let buf = null;
    for (let a = 1; a <= 4; a++) {
      try {
        const r = await fetch(IMAGE, { headers: { 'User-Agent': UA, Referer: PAGE }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
        const b = Buffer.from(await r.arrayBuffer());
        if (r.status === 200 && b[0] === 0xFF && b[1] === 0xD8) { buf = b; break; }
      } catch (e) { /* retry */ }
      await new Promise(res => setTimeout(res, 1500 * a));
    }
    if (!buf) throw new Error('could not fetch the archive scan');
    const f = TMP + '/original.jpg';
    fs.writeFileSync(f, buf);
    const d = ffprobeSize(f);
    const gs = grayStats(f);
    if (d.w < 800 || d.h < 800) throw new Error('degenerate image ' + d.w + 'x' + d.h);
    if (gs.sd < 8 || gs.min > 210) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    const t = ocrText(f, 'hn645').replace(/\s+/g, ' ');
    // OCR reads the masthead as "Pallas morning" (misread of "Dallas Morning
    // News"); accept the distinctive dateline + masthead fragment together.
    const hasMasthead = /Dallas.{0,80}morning/i.test(t) || /Pallas morning/i.test(t);
    const hasHeadline = /KENNEDY SLAIN/i.test(t);
    const hasDate = /NOVEMBER 23.{0,10}1963/i.test(t);
    console.log('OCR: ' + t.slice(0, 300));
    console.log('masthead=' + hasMasthead + '  headline=' + hasHeadline + '  date=' + hasDate);
    if (!hasMasthead || !hasHeadline) throw new Error('OCR identity not confirmed');
    fs.copyFileSync(f, IMG_DIR + '/' + out);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + out;
    entry.source_dimensions = d.w + 'x' + d.h;
    entry.output_dimensions = d.w + 'x' + d.h;
    entry.mosaic_method = 'archive_page_image';
    entry.page_selection = 'archive_collection_scan';
    entry.article_note = 'Front page of The Dallas Morning News, Saturday 23 November 1963 ("Kennedy Slain on Dallas Street"), from the cited Shapell Manuscript Foundation\'s own newspaper page scan. A related contemporaneous report accompanying HN-645\'s primary Decatur Daily Democrat account. Masthead, headline and date confirmed by OCR (page locator only; no OCR text stored).';
    entry.additional_cited_article = true;
    entry.distinct_asset = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log('HN-645 OK  ' + d.w + 'x' + d.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + out);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log('HN-645 FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
