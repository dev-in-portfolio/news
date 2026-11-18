// HN-450 cites the Dangerous Press digital newspaper archive page
//   https://dangerouspress.org/papers/amsterdam-news/1926-12-29
// which exposes the archive's own page scans of the Amsterdam News,
// 29 December 1926 (pages.dangerouspress.org/.../page_NN.jpg).
//
// Locate the page carrying the Rockmart (Georgia) Southern Railway collision
// follow-up report, then store that page unmodified as archive_page_image /
// additional_cited_article alongside the record's primary Indianapolis Times
// page. OCR is used only as a page locator (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/dangerouspress';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE = 'https://dangerouspress.org/papers/amsterdam-news/1926-12-29';
const BASE = 'https://pages.dangerouspress.org/amsterdam-news/1926/1926-12-29/page_';

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
  if (d.w > 1400) args.push('-vf', 'scale=1300:-1');
  args.push('-pix_fmt', 'rgb24', png);
  execFileSync('ffmpeg', args);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 240000 }); }
  catch (e) { return ''; }
}

async function fetchJpeg(url) {
  for (let a = 1; a <= 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: PAGE }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
      const b = Buffer.from(await r.arrayBuffer());
      if (r.status === 200 && b[0] === 0xFF && b[1] === 0xD8) return b;
    } catch (e) { /* retry */ }
    await new Promise(res => setTimeout(res, 1500 * a));
  }
  return null;
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};

  let best = null;
  for (let n = 1; n <= 19; n++) {
    const nn = String(n).padStart(2, '0');
    const buf = await fetchJpeg(BASE + nn + '.jpg');
    if (!buf) { console.log('page ' + nn + '  FETCH FAILED'); continue; }
    const f = TMP + '/page_' + nn + '.jpg';
    fs.writeFileSync(f, buf);
    const d = ffprobeSize(f);
    const t = ocrText(f, 'dp-p' + nn).toLowerCase();
    const hits = [];
    if (t.includes('rockmart')) hits.push('rockmart');
    if (t.includes('royal palm')) hits.push('royal palm');
    if (t.includes('ponce')) hits.push('ponce');
    if (t.includes('southern railway')) hits.push('southern railway');
    if (t.includes('collision')) hits.push('collision');
    const score = (hits.includes('rockmart') ? 6 : 0) + (hits.includes('royal palm') ? 4 : 0) + (hits.includes('ponce') ? 3 : 0) + (hits.includes('southern railway') ? 2 : 0) + (hits.includes('collision') ? 1 : 0);
    console.log('page ' + nn + '  ' + d.w + 'x' + d.h + '  chars=' + t.replace(/\s/g, '').length + '  score=' + score + '  hits=' + hits.join(','));
    if (score > 0) console.log('   ' + t.replace(/\s+/g, ' ').slice(0, 300));
    if (!best || score > best.score) best = { n, nn, score, f, d };
  }

  const out = 'hn-450-dangerouspress-amsterdam-news-19261229-p' + best.n + '-page.jpg';
  const key = 'HN-450|' + PAGE + '|' + out;
  const entry = {
    hn_id: 'HN-450',
    provider: 'Dangerous Press digital newspaper archive (Amsterdam News page scans)',
    status: 'pending',
    page_url: PAGE,
    newspaper: 'Amsterdam News',
    issue_date: '1926-12-29',
    error: null,
    acquired_at: null,
  };
  try {
    if (!best || best.score < 6) throw new Error('no confident page (best score=' + (best && best.score) + ')');
    const gs = grayStats(best.f);
    if (best.d.w < 400 || best.d.h < 500) throw new Error('degenerate image ' + best.d.w + 'x' + best.d.h);
    if (gs.sd < 5 || gs.min > 200) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    fs.copyFileSync(best.f, IMG_DIR + '/' + out);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + out;
    entry.source_dimensions = best.d.w + 'x' + best.d.h;
    entry.output_dimensions = best.d.w + 'x' + best.d.h;
    entry.mosaic_method = 'archive_page_image';
    entry.page_selection = 'ocr_locator';
    entry.article_note = 'Page ' + best.n + ' of the Amsterdam News, 29 December 1926, from the Dangerous Press digital newspaper archive\'s own page scans. Carries the paper\'s report on the Southern Railway collision near Rockmart, Georgia, cited by HN-450 alongside its primary Indianapolis Times page. Page located by OCR (page locator only; no OCR text stored).';
    entry.additional_cited_article = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log('HN-450  OK  page ' + best.n + '  ' + best.d.w + 'x' + best.d.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + out);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log('HN-450  FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
