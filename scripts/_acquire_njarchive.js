// Acquire the page of The New-Jersey Gazette, 26 July 1784 carrying the
// upas/poison-tree introduction cited by HN-014 (cited as the preceding
// installment of the 2 August 1784 story).
//
// The New Jersey Archive exposes its own page scans through a IIIF level0 tile
// service (512 px tiles). The issue PDF endpoint returns HTTP 500, so the page
// is assembled from the archive's own tiles at native resolution (white
// padding only, no retouching). Page selection uses OCR only as a locator (no
// OCR text is stored). Stored as archive_page_image / additional_cited_article
// alongside the record's primary LOC page of 2 August 1784.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/njarchive';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE = 'https://www.njarchive.org/periodicals/NJA-P-P1125X6S/1784-07-26?view=transcript';
const BASE = 'https://tiles.njarchive.org/NJA-P-P1125X6S/1784/07/26/ed-1/derivatives/page-';
const SIZES = [
  { w: 2577, h: 4000 },
  { w: 2582, h: 4000 },
  { w: 2590, h: 4000 },
  { w: 2572, h: 4000 },
];
const TILE = 512;

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
function ocrPng(png, tag) {
  const d = ffprobeSize(png);
  const up = TMP + '/' + tag + '-ocr.png';
  const args = ['-v', 'error', '-y', '-i', png];
  if (d.w > 1400) args.push('-vf', 'scale=1300:-1');
  args.push('-pix_fmt', 'rgb24', up);
  execFileSync('ffmpeg', args);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(up)], { encoding: 'utf8', timeout: 240000 }); }
  catch (e) { return ''; }
}

async function fetchTile(url) {
  for (let a = 1; a <= 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: PAGE }, redirect: 'follow', signal: AbortSignal.timeout(90000) });
      const b = Buffer.from(await r.arrayBuffer());
      if (r.status === 200 && b[0] === 0xFF && b[1] === 0xD8) return b;
    } catch (e) { /* retry */ }
    await new Promise(res => setTimeout(res, 1200 * a));
  }
  return null;
}

async function buildPage(n) {
  const { w, h } = SIZES[n - 1];
  const cols = Math.ceil(w / TILE), rows = Math.ceil(h / TILE);
  const dir = TMP + '/p' + n;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let idx = 0, failed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * TILE, y = r * TILE;
      const tw = Math.min(TILE, w - x), th = Math.min(TILE, h - y);
      const url = BASE + '0' + n + '.jpg/' + x + ',' + y + ',' + tw + ',' + th + '/' + tw + ',' + th + '/0/default.jpg';
      const buf = await fetchTile(url);
      const tag = String(idx).padStart(3, '0');
      if (!buf) { failed++; idx++; continue; }
      const raw = dir + '/raw' + tag + '.jpg';
      fs.writeFileSync(raw, buf);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-vf', 'pad=512:512:0:0:white', '-q:v', '1', dir + '/t' + tag + '.jpg']);
      idx++;
    }
  }
  if (failed) console.log('  page ' + n + ': ' + failed + ' tile(s) failed');
  const out = TMP + '/page-0' + n + '.jpg';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', dir + '/t%03d.jpg', '-vf', 'tile=' + cols + 'x' + rows + ':nb_frames=' + (cols * rows), '-frames:v', '1', '-q:v', '1', out]);
  return out;
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};

  let best = null;
  for (let n = 1; n <= 4; n++) {
    const f = await buildPage(n);
    const d = ffprobeSize(f);
    const t = ocrPng(f, 'njg-p' + n).toLowerCase();
    const score = (t.includes('upas') ? 4 : 0) + (t.includes('foersch') ? 4 : 0) + (t.includes('java') ? 2 : 0) + (t.includes('poison') ? 2 : 0);
    console.log('page ' + n + '  ' + d.w + 'x' + d.h + '  chars=' + t.replace(/\s/g, '').length + '  score=' + score);
    console.log('   ' + t.replace(/\s+/g, ' ').slice(0, 240));
    if (!best || score > best.score) best = { n, score, f, d };
  }

  const out = 'hn-014-njarchive-new-jersey-gazette-17840726-p' + best.n + '-page.jpg';
  const key = 'HN-014|' + PAGE + '|' + out;
  const entry = {
    hn_id: 'HN-014',
    provider: 'New Jersey Archive (New-Jersey Gazette IIIF page scan)',
    status: 'pending',
    page_url: PAGE,
    newspaper: 'The New-Jersey Gazette',
    issue_date: '1784-07-26',
    error: null,
    acquired_at: null,
  };
  try {
    if (!best || best.score < 5) throw new Error('no confident page (best score=' + (best && best.score) + ')');
    const gs = grayStats(best.f);
    if (best.d.w < 400 || best.d.h < 500) throw new Error('degenerate image ' + best.d.w + 'x' + best.d.h);
    if (gs.sd < 5 || gs.min > 200) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    fs.copyFileSync(best.f, IMG_DIR + '/' + out);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + out;
    entry.source_dimensions = 'iiif tiles, ' + best.d.w + 'x' + best.d.h;
    entry.output_dimensions = best.d.w + 'x' + best.d.h;
    entry.mosaic_method = 'openseadragon_tiles_256';
    entry.page_selection = 'ocr_locator';
    entry.article_note = 'Page ' + best.n + ' of The New-Jersey Gazette, 26 July 1784, assembled from the New Jersey Archive\'s own IIIF page tiles. Carries the introduction to the Java upas-tree account that HN-014 cites as the preceding installment of the 2 August 1784 story. Page located by OCR (page locator only; no OCR text stored).';
    entry.additional_cited_article = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log('HN-014  OK  page ' + best.n + '  ' + best.d.w + 'x' + best.d.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + out);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log('HN-014  FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
