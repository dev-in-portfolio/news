// Acquire the front page of the Michigan State University *State News*,
// 2 August 1966, cited by HN-657 (UT Tower sniper). The scan is hosted by the
// MSU Library digital collections; stored unmodified as
// archive_pdf_page_rendition / additional_cited_article (a contemporaneous
// report from another newspaper, cited in hn_urls.json, alongside the
// record's primary Indiana page). No cropping, retouching, or generation.
// OCR is used only to confirm identity (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/statnews-acquire';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const JOB = {
  hn_id: 'HN-657',
  provider: 'Michigan State University Libraries (State News digital collection)',
  page_url: 'https://sanweb.lib.msu.edu/DMC/state_news/1966/1966_July01_1966_December09/state_news_19660802.pdf',
  image_url: 'https://sanweb.lib.msu.edu/DMC/state_news/1966/1966_July01_1966_December09/state_news_19660802.pdf',
  newspaper: 'Michigan State News (East Lansing, Michigan)',
  issue_date: '1966-08-02',
  out: 'hn-657-msu-state-news-19660802-p1.jpg',
  pdf_page: 1,
  scale: 2.0,
  need: [/slays|sniper|austin|texas/i, /state news|michigan|east lansing/i],
  note: 'Front page of the Michigan State News, 2 August 1966: "Slays 16, Wounds 33" (University of Texas Tower sniper), as digitised by the MSU Libraries. Contemporaneous coverage cited by HN-657 alongside its primary Indiana page. Identity confirmed by OCR (page locator only).',
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
  const { pdf } = await import('pdf-to-img');
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  const key = JOB.hn_id + '|' + JOB.page_url + '|' + JOB.out;
  const entry = {
    hn_id: JOB.hn_id, provider: JOB.provider, status: 'pending', page_url: JOB.page_url,
    newspaper: JOB.newspaper, issue_date: JOB.issue_date, error: null, acquired_at: null,
  };
  try {
    const r = await fetch(JOB.image_url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(240000) });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.slice(0, 4).toString() !== '%PDF') throw new Error('not a PDF (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
    const pdfPath = TMP + '/' + JOB.out.replace(/\.jpg$/i, '.pdf');
    fs.writeFileSync(pdfPath, buf);
    const doc = await pdf(pdfPath, { scale: JOB.scale });
    const total = doc.length;
    let n = 0, png = null;
    for await (const page of doc) {
      n++;
      if (n === JOB.pdf_page) { png = page; break; }
    }
    if (!png) throw new Error('page ' + JOB.pdf_page + ' not found (pages=' + total + ')');
    const pngPath = TMP + '/' + JOB.out.replace(/\.jpg$/i, '.png');
    fs.writeFileSync(pngPath, png);
    const jpgPath = TMP + '/' + JOB.out;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', pngPath, '-q:v', '2', jpgPath]);
    const dims = ffprobeSize(jpgPath);
    const gs = grayStats(jpgPath);
    if (dims.w < 150 || dims.h < 120) throw new Error('degenerate image ' + dims.w + 'x' + dims.h);
    if (gs.sd < 3 || gs.min > 220) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    const text = ocrText(jpgPath, 'hn-657-sn').toLowerCase();
    const ok = JOB.need.every(re => re.test(text));
    if (!ok) throw new Error('OCR does not confirm identity (chars=' + text.replace(/\s/g, '').length + ')');
    fs.copyFileSync(jpgPath, IMG_DIR + '/' + JOB.out);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + JOB.out;
    entry.source_dimensions = 'pdf page ' + JOB.pdf_page + '/' + total;
    entry.output_dimensions = dims.w + 'x' + dims.h;
    entry.mosaic_method = 'archive_pdf_page_rendition';
    entry.pdf_page = JOB.pdf_page;
    entry.pdf_pages = total;
    entry.page_selection = 'archive_collection_front_page';
    entry.article_note = JOB.note;
    entry.additional_cited_article = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log(JOB.hn_id + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + JOB.out);
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
