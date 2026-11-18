// Download the LaMartin Okeechobee collection's own scan of the Tampa Morning
// Tribune front page of 1928-09-19, cited by HN-458 alongside the Indianapolis
// Times page. The stored file is a rasterisation of the collection's scanned
// PDF page; nothing is cropped, retouched, or generated.
const fs = require('fs');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const IMG_DIR = 'D:/news/site/assets/images';
const LEDGER = 'D:/news/docs/OTHER_IMAGE_ACQUISITION_LEDGER.json';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode';

const JOB = {
  hn: 'HN-458',
  page_url: 'https://www.lamartin.com/OldNewspapersOkeechobeeInfo.aspx',
  pdf_url: 'https://www.lamartin.com/OldnewspapersOkeechobeeInfo/' + encodeURIComponent('List of Okeechobee Dead Tampa Tribune September 19, 1928 page 1 col 7.pdf'),
  provider: 'LaMartin Okeechobee newspaper collection (Tampa Morning Tribune)',
  newspaper: 'Tampa Morning Tribune',
  issue_date: '1928-09-19',
  out: 'hn-458-tampa-morning-tribune-19280919-p1-page.jpg',
  note: 'Front page, "250 Known Storm Dead" (additional cited article)',
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

(async () => {
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  const key = JOB.hn + '|' + JOB.page_url;
  const entry = {
    hn_id: JOB.hn, provider: JOB.provider, status: 'pending', page_url: JOB.page_url,
    newspaper: JOB.newspaper, issue_date: JOB.issue_date, error: null, acquired_at: null,
  };
  try {
    const r = await fetch(JOB.pdf_url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!(buf[0] === 0x25 && buf[1] === 0x50)) throw new Error('not a PDF (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
    const pdf = TMP + '/hn-458-lamartin.pdf';
    fs.writeFileSync(pdf, buf);
    const { pdf: raster } = await import('pdf-to-img');
    const doc = await raster(pdf, { scale: 1.35, format: 'jpeg' });
    let page;
    try { page = await doc.getPage(1); } finally { await doc.destroy().catch(() => {}); }
    const outPath = IMG_DIR + '/' + JOB.out;
    fs.writeFileSync(outPath, page);
    const dims = ffprobeSize(outPath);
    const gs = grayStats(outPath);
    if (dims.w < 300 || dims.h < 300) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
    if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + JOB.out;
    entry.source_dimensions = dims.w + 'x' + dims.h;
    entry.output_dimensions = dims.w + 'x' + dims.h;
    entry.mosaic_method = 'archive_pdf_page_rendition';
    entry.page_selection = 'archive_clipping_file';
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
