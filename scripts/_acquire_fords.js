// Acquire two cited-collection newspaper scans from Ford's Theatre
// "Remembering Lincoln" (both cited by HN-197):
//   node/673  The Morning Bulletin (Memphis), 17 April 1865, front page
//   node/192  "Glorious News. Lincoln and Seward Assassinated!" (Demopolis
//             Herald reprint, 21 April 1865) — the false early claim HN-197
//             documents.
//
// Each cited page exposes its own scan of the newspaper. Stored unmodified as
// archive_page_image / archive_clipping_image with the cited collection named as
// provider. No cropping, retouching, or generation. OCR is used only to confirm
// identity (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/fords';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const JOBS = [
  {
    hn: 'HN-197',
    provider: "Ford's Theatre, Remembering Lincoln (The Morning Bulletin scan)",
    page_url: 'https://rememberinglincoln.fords.org/node/673',
    image_url: 'https://rememberinglincoln.fords.org/sites/default/files/HN-1865-011090_wm.jpg',
    newspaper: 'The Morning Bulletin (Memphis, Tenn.)',
    issue_date: '1865-04-17',
    out: 'hn-197-fords-morning-bulletin-18650417-p1-page.jpg',
    method: 'archive_page_image',
    selection: 'archive_item_record',
    need: [/memphis|morning/i, /lincoln|seward|assassin/i],
    note: "Ford's Theatre \"Remembering Lincoln\" scan of The Morning Bulletin (Memphis, Tenn.) front page, 17 April 1865, covering the Lincoln assassination and the attack on Secretary Seward. Masthead/date confirmed by OCR (page locator only).",
  },
  {
    hn: 'HN-197',
    provider: "Ford's Theatre, Remembering Lincoln (Demopolis Herald reprint scan)",
    page_url: 'https://rememberinglincoln.fords.org/node/192',
    image_url: 'https://rememberinglincoln.fords.org/sites/default/files/13-Glorious%20News.jpg',
    newspaper: 'Demopolis Herald (reprint)',
    issue_date: '1865-04-21',
    out: 'hn-197-fords-glorious-news-clipping.jpg',
    method: 'archive_clipping_image',
    selection: 'archive_item_record',
    need: [/glorious news/i, /lincoln|seward/i],
    note: "Ford's Theatre \"Remembering Lincoln\" scan of the clipping \"Glorious News. Lincoln and Seward Assassinated!\" (erroneous dispatch from the Demopolis Herald, 19 April, reprinted 21 April 1865) — the false early claim documented by HN-197. Identity confirmed by OCR (page locator only).",
  },
];

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

  for (const job of JOBS) {
    const key = job.hn + '|' + job.page_url;
    const entry = {
      hn_id: job.hn, provider: job.provider, status: 'pending', page_url: job.page_url,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const r = await fetch(job.image_url, { headers: { 'User-Agent': UA, Referer: job.page_url }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
      const tmp = TMP + '/' + job.out;
      fs.writeFileSync(tmp, buf);
      const dims = ffprobeSize(tmp);
      const gs = grayStats(tmp);
      if (dims.w < 300 || dims.h < 300) throw new Error('degenerate image ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      const text = ocrText(tmp, job.hn).toLowerCase();
      const ok = job.need.every(re => re.test(text));
      if (!ok) throw new Error('OCR does not confirm identity (chars=' + text.replace(/\s/g, '').length + ')');
      fs.copyFileSync(tmp, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = dims.w + 'x' + dims.h;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = job.method;
      entry.page_selection = job.selection;
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log(job.hn + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + job.out);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      console.log(job.hn + '  FAIL  ' + e.message);
    }
    ledger.items[key] = entry;
  }

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
