// Download the Chicago Defender page scans exposed by the Emmett Till Project
// (cited by HN-605 and HN-606) and store them as additional cited article page
// images. The stored files are the project's own scans; nothing is cropped,
// retouched, or generated. OCR was used only to verify content, never stored.
const fs = require('fs');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const IMG_DIR = 'D:/news/site/assets/images';
const LEDGER = 'D:/news/docs/OTHER_IMAGE_ACQUISITION_LEDGER.json';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode';

const PAGE_URL = 'https://www.emmetttillproject.com/chicagodefender';
const PROVIDER = 'Emmett Till Project (Chicago Defender page scans)';

const JOBS = [
  {
    hn: 'HN-605', issue_date: '1955-09-17',
    image_url: 'https://images.squarespace-cdn.com/content/v1/55bbe8c4e4b07309dc53b00f/1503884700023-TWLPHKIET603T985AWUT/Chicago+Defender+_+Sept+17+_+Front+Page.jpg',
    out: 'hn-605-chicago-defender-19550917-p1-page.jpg',
    note: 'Chicago Defender front page, 17 September 1955, Till case coverage ("Threat to Till\'s Uncle"; trial date set)',
  },
  {
    hn: 'HN-606', issue_date: '1955-09-24',
    image_url: 'https://images.squarespace-cdn.com/content/v1/55bbe8c4e4b07309dc53b00f/1503886436618-10NCD4Z6W8GQNNG650BS/Chicago+Defender+_+Sept+24+front+page.jpg',
    out: 'hn-606-chicago-defender-19550924-p1-page.jpg',
    note: 'Chicago Defender front page, 24 September 1955, Till murder-trial coverage (jury selection; prosecution witnesses)',
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

(async () => {
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};
  for (const job of JOBS) {
    const key = job.hn + '|' + PAGE_URL;
    const entry = {
      hn_id: job.hn, provider: PROVIDER, status: 'pending', page_url: PAGE_URL,
      newspaper: 'Chicago Defender', issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const r = await fetch(job.image_url, { headers: { 'User-Agent': UA, Referer: PAGE_URL }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
      const buf = Buffer.from(await r.arrayBuffer());
      const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8;
      const isWebp = buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP';
      if (!isJpeg && !isWebp) throw new Error('not a JPEG/WebP (HTTP ' + r.status + ', ' + buf.length + ' bytes, magic=' + JSON.stringify(buf.slice(0, 4).toString('latin1')) + ')');
      const outPath = IMG_DIR + '/' + job.out;
      if (isJpeg) {
        fs.writeFileSync(outPath, buf);
      } else {
        const webp = TMP + '/' + job.out.replace(/\.jpg$/, '.webp');
        fs.writeFileSync(webp, buf);
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', webp, '-q:v', '2', outPath]);
      }
      const dims = ffprobeSize(outPath);
      const gs = grayStats(outPath);
      if (dims.w < 300 || dims.h < 300) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = dims.w + 'x' + dims.h;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = 'archive_page_image';
      entry.page_selection = 'archive_page_scan';
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log(job.hn + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min);
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
