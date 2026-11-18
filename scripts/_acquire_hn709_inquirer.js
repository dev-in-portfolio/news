// HN-709 cites The Philadelphia Inquirer's own history page
//   https://www.inquirer.com/history/legionnaires-outbreak-philadelphia-1976-name-20260801.html
// which displays the Inquirer's own scan of its 3 August 1976 edition.
// Acquire that single archive-owned page scan, unmodified, as
// archive_page_image / additional_cited_article. The eight
// img.newspapers.com clipping re-uploads on the page are commercial and are
// excluded; the remaining resizer images are photographs (no OCR text).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/inquirer-hn709';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE = 'https://www.inquirer.com/history/legionnaires-outbreak-philadelphia-1976-name-20260801.html';
const IMAGE = 'https://www.inquirer.com/resizer/v2/JLPZJ4CD7FHCFDGOLINKVTVG2Q.jpg?auth=f6769bbeeaca0292d81ce3873c1f0da91464f16de836d836f47caa124aaeca9a&width=3000&height=2000&smart=true';

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
  const png = TMP + '/' + tag + '-ocr.png';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', jpeg, '-vf', 'scale=1800:-1', '-pix_fmt', 'rgb24', png]);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', png.split('/').join('\\')], { encoding: 'utf8', timeout: 300000 }); }
  catch (e) { return ''; }
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  const out = 'hn-709-inquirer-legionnaires-19760803-page.jpg';
  const key = 'HN-709|' + PAGE + '|' + out;
  const entry = {
    hn_id: 'HN-709',
    provider: 'The Philadelphia Inquirer (inquirer.com history archive)',
    status: 'pending',
    page_url: PAGE,
    newspaper: 'The Philadelphia Inquirer',
    issue_date: '1976-08-03',
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
    if (d.w < 1200 || d.h < 700) throw new Error('degenerate image ' + d.w + 'x' + d.h);
    if (gs.sd < 8 || gs.min > 210) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
    const t = ocrText(f, 'hn709').replace(/\s+/g, ' ');
    const hasHeadline = /Mysterious Disease Kills 16/i.test(t);
    const hasMasthead = /Philadelphia/i.test(t);
    console.log('OCR full: ' + t.slice(0, 700));
    console.log('headline=' + hasHeadline + '  masthead=' + hasMasthead);
    if (!hasHeadline || !hasMasthead) throw new Error('OCR identity not confirmed');
    fs.copyFileSync(f, IMG_DIR + '/' + out);
    entry.status = 'image_acquired';
    entry.full_page_asset = 'assets/images/' + out;
    entry.source_dimensions = d.w + 'x' + d.h;
    entry.output_dimensions = d.w + 'x' + d.h;
    entry.mosaic_method = 'archive_page_image';
    entry.page_selection = 'archive_exhibit_scan';
    entry.article_note = 'The Inquirer\'s own scan of its 3 August 1976 edition, displayed by the cited Philadelphia Inquirer history page, carrying the contemporaneous report "Mysterious Disease Kills 16 Who Attended Meeting Here" on the outbreak later named Legionnaires\' disease. A related contemporaneous report accompanying HN-709\'s primary Independent-News editorial. Masthead and headline confirmed by OCR (page locator only; no OCR text stored). The eight img.newspapers.com clipping re-uploads on the same page are commercial and were not stored.';
    entry.additional_cited_article = true;
    entry.distinct_asset = true;
    entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
    entry.acquired_at = new Date().toISOString();
    console.log('HN-709 OK  ' + d.w + 'x' + d.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + out);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log('HN-709 FAIL  ' + e.message);
  }
  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
