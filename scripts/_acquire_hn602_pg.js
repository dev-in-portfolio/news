// HN-602 cites the Pittsburgh Post-Gazette's own polio-history interactive
//   https://newsinteractive.post-gazette.com/polio/
// which displays newspaper clippings credited "Post-Gazette Archives".
// Acquire the four archive-owned newspaper scans that document the cited
// 12 April 1955 Salk announcement and its immediate aftermath.
// Exclude images credited to newspapers.com (commercial) and AP photographs.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/pg-polio';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE = 'https://newsinteractive.post-gazette.com/polio/';
const BASE = PAGE + 'img/';

const JOBS = [
  {
    file: 'web-suntelly-headlines.jpg',
    out: 'hn-602-pg-suntelly-19550412-masthead-clipping.jpg',
    newspaper: 'Pittsburgh Sun-Telegraph', issue_date: '1955-04-12',
    page_selection: 'archive_exhibit_caption',
    note: 'Pittsburgh Sun-Telegraph masthead headline "SALK VACCINE OK, RATED 80 to 90%" of 12 April 1955, displayed by the cited Pittsburgh Post-Gazette polio history interactive and credited "Post-Gazette Archives". Related contemporaneous report matching HN-602\'s cited 12 April 1955 Salk trial announcement.',
    keywords: /SALK VACCINE OK|RATED 80|FINAL EDITION/i,
  },
  {
    file: 'web-childrens-institute.jpg',
    out: 'hn-602-pg-pittsburgh-press-children-tests-clipping.jpg',
    newspaper: 'The Pittsburgh Press', issue_date: null,
    page_selection: 'archive_exhibit_caption',
    note: 'Pittsburgh Press article publicizing Salk vaccine tests on children with disabilities (April 1955), displayed by the cited Pittsburgh Post-Gazette polio history interactive and credited "Post-Gazette Archives".',
    keywords: /Salk Shots Safe|Whopping Doses|crippled|vaccine/i,
  },
  {
    file: 'web-one-died-pa.jpg',
    out: 'hn-602-pg-pittsburgh-press-19550529-clipping.jpg',
    newspaper: 'The Pittsburgh Press', issue_date: '1955-05-29',
    page_selection: 'archive_exhibit_caption',
    note: 'Pittsburgh Press article of 29 May 1955 on the Cutter manufacturing failure in Pennsylvania, displayed by the cited Pittsburgh Post-Gazette polio history interactive and credited "Post-Gazette Archives".',
    keywords: /State Score|One Polio Case|97,500|Cutter/i,
  },
  {
    file: 'web-enough.jpg',
    out: 'hn-602-pg-pittsburgh-press-19560401-clipping.jpg',
    newspaper: 'The Pittsburgh Press', issue_date: '1956-04-01',
    page_selection: 'archive_exhibit_caption',
    note: 'Pittsburgh Press front page of 1 April 1956 asking whether enough vaccine was on hand, displayed by the cited Pittsburgh Post-Gazette polio history interactive and credited "Post-Gazette Archives".',
    keywords: /enough Salk|Vaccine To Go Around|8 Million Shots/i,
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
  const args = ['-v', 'error', '-y', '-i', jpeg];
  if (d.w < 1400) args.push('-vf', 'scale=iw*2:ih*2');
  args.push('-pix_fmt', 'rgb24', png);
  execFileSync('ffmpeg', args);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 240000 }); }
  catch (e) { return ''; }
}
async function fetchBuf(url) {
  for (let a = 1; a <= 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: PAGE }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
      const b = Buffer.from(await r.arrayBuffer());
      if (r.status === 200 && (b[0] === 0xFF && b[1] === 0xD8)) return b;
    } catch (e) { /* retry */ }
    await new Promise(res => setTimeout(res, 1500 * a));
  }
  return null;
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  for (const job of JOBS) {
    const key = 'HN-602|' + PAGE + '|' + job.out;
    const entry = {
      hn_id: 'HN-602',
      provider: 'Pittsburgh Post-Gazette (polio history interactive, Post-Gazette Archives scans)',
      status: 'pending',
      page_url: PAGE,
      newspaper: job.newspaper,
      issue_date: job.issue_date,
      error: null,
      acquired_at: null,
    };
    try {
      const buf = await fetchBuf(BASE + job.file);
      if (!buf) throw new Error('fetch failed');
      const f = TMP + '/' + job.file;
      fs.writeFileSync(f, buf);
      const d = ffprobeSize(f);
      const gs = grayStats(f);
      if (d.w < 400 || d.h < 300) throw new Error('degenerate image ' + d.w + 'x' + d.h);
      if (gs.sd < 5 || gs.min > 210) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ')');
      const t = ocrText(f, job.out.replace(/\W+/g, '-')).replace(/\s+/g, ' ');
      const ok = job.keywords.test(t);
      console.log(job.file + '  OCR chars=' + t.replace(/\s/g, '').length + '  match=' + ok + '  ' + t.slice(0, 160));
      if (!ok) throw new Error('OCR identity not confirmed');
      fs.copyFileSync(f, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = d.w + 'x' + d.h;
      entry.output_dimensions = d.w + 'x' + d.h;
      entry.mosaic_method = 'archive_clipping_image';
      entry.page_selection = job.page_selection;
      entry.article_note = job.note + ' Identity confirmed by OCR (page locator only; no OCR text stored).';
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log('  OK  ' + d.w + 'x' + d.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      console.log('  FAIL  ' + e.message);
    }
    ledger.items[key] = entry;
  }
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
