// Acquire cited-collection newspaper scans:
//   HN-515  hhrcmaine.org Bangor Daily News fronts, 11 and 14 Nov 1938
//           (Maine newspaper reaction to Kristallnacht).
//   HN-630  eisenhowerfoundation.net Washington Post article scan, 12 May 1960
//           ("U.S. Heard Russians Chasing U-2").
//
// Each cited page exposes its own scan of the newspaper. Stored unmodified
// (format-converted only where the CDN serves WebP) as archive_page_image /
// archive_clipping_image with the cited collection named as provider. No
// cropping, retouching, or generation. OCR is used only to confirm identity (no
// OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/batch7';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const JOBS = [
  {
    hn: 'HN-515',
    provider: 'Holocaust Human Rights Center of Maine (Bangor Daily News scans)',
    page_url: 'https://www.hhrcmaine.org/blog/blog/on-this-day-maine-newspapers-react-to-kristallnacht-violent-nazi-anti-jewish-campaign',
    image_url: 'https://images.squarespace-cdn.com/content/v1/60f05c47a2b81a0e86cdf4fa/1629130308445-1410O0EAW1SWBJH6U85U/BDN-Nov-11-1.jpg?format=1500w',
    newspaper: 'Bangor Daily News',
    issue_date: '1938-11-11',
    out: 'hn-515-hhrcmaine-bangor-daily-news-19381111-p1-page.jpg',
    method: 'archive_page_image',
    selection: 'archive_collection_page',
    need: [/anti-jewish|jew|nazi/i, /munich|berlin|riot/i],
    note: 'Holocaust Human Rights Center of Maine scan of the Bangor Daily News, 11 November 1938: "Anti-Jewish Riots Closed In Munich Streets" (Kristallnacht). Identity confirmed by OCR (page locator only).',
  },
  {
    hn: 'HN-515',
    provider: 'Holocaust Human Rights Center of Maine (Bangor Daily News scans)',
    page_url: 'https://www.hhrcmaine.org/blog/blog/on-this-day-maine-newspapers-react-to-kristallnacht-violent-nazi-anti-jewish-campaign',
    image_url: 'https://static1.squarespace.com/static/60f05c47a2b81a0e86cdf4fa/611a8e0d4307ed290343d607/611a8e1e4307ed290343d869/1658612386924/BDN-Nov-14-1.jpg?format=1500w',
    newspaper: 'Bangor Daily News',
    issue_date: '1938-11-14',
    out: 'hn-515-hhrcmaine-bangor-daily-news-19381114-clipping.jpg',
    method: 'archive_clipping_image',
    selection: 'archive_collection_clipping',
    need: [/bangor|maine/i, /nazi|jew|kristall|pogrom|refugee/i],
    note: 'Holocaust Human Rights Center of Maine scan of a Bangor Daily News item, 14 November 1938, on the Kristallnacht aftermath. Identity confirmed by OCR (page locator only).',
  },
  {
    hn: 'HN-630',
    provider: 'Eisenhower Foundation (Washington Post article scan)',
    page_url: 'https://eisenhowerfoundation.net/primary-source-library/washington-post-article-us-heard-russians-chasing-u-2/',
    image_url: 'https://eisenhowerfoundation.net/wp-content/uploads/2026/07/U225.Article_WashPost_May12_1960-1.png',
    newspaper: 'The Washington Post',
    issue_date: '1960-05-12',
    out: 'hn-630-eisenhower-foundation-washington-post-19600512-clipping.jpg',
    method: 'archive_clipping_image',
    selection: 'archive_item_record',
    need: [/washington post/i, /u-2|russians|sverdlovsk/i],
    note: 'Eisenhower Foundation scan of the Washington Post article of 12 May 1960, "U.S. Heard Russians Chasing U-2" (Jack Anderson), on the U-2 incident. Identity confirmed by OCR (page locator only).',
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
    const key = job.hn + '|' + job.page_url + '|' + job.out;
    const entry = {
      hn_id: job.hn, provider: job.provider, status: 'pending', page_url: job.page_url,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const r = await fetch(job.image_url, { headers: { 'User-Agent': UA, Referer: job.page_url }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
      const buf = Buffer.from(await r.arrayBuffer());
      const magic = buf.slice(0, 4).toString('hex');
      if (!/^ffd8ff|^89504e47|^52494646/.test(magic)) throw new Error('unexpected format (HTTP ' + r.status + ', ' + buf.length + ' bytes, magic ' + magic + ')');
      const rawFile = TMP + '/raw-' + job.out.replace(/\.jpg$/i, '') + (/^52494646/.test(magic) ? '.webp' : /^89504e47/.test(magic) ? '.png' : '.jpg');
      fs.writeFileSync(rawFile, buf);
      const tmp = TMP + '/' + job.out;
      if (/^52494646/.test(magic) || /^89504e47/.test(magic)) {
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', rawFile, '-q:v', '2', tmp]);
      } else {
        fs.copyFileSync(rawFile, tmp);
      }
      const dims = ffprobeSize(tmp);
      const gs = grayStats(tmp);
      if (dims.w < 150 || dims.h < 120) throw new Error('degenerate image ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      const text = ocrText(tmp, job.out).toLowerCase();
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
      console.log(job.hn + '  FAIL  ' + job.out + '  ' + e.message);
    }
    ledger.items[key] = entry;
  }

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
