// Download the Glendale Evening News pages cited by HN-416 and HN-442 from the
// Internet Archive items behind the cited Wikimedia PDFs. Page identity comes
// from each item's own _djvu.xml page objects; the stored file is the archive's
// own page image, unmodified.
const fs = require('fs');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const IMG_DIR = 'D:/news/site/assets/images';
const LEDGER = 'D:/news/docs/OTHER_IMAGE_ACQUISITION_LEDGER.json';

const JOBS = [
  {
    hn: 'HN-416', item: 'cgl_003835', pageIndex: 0, width: 2400, issue_date: '1919-08-01',
    page_url: 'https://archive.org/details/cgl_003835',
    provider: 'Internet Archive (Glendale Evening News)',
    newspaper: 'The Glendale Evening News',
    out: 'hn-416-glendale-evening-news-19190801-p1-page.jpg',
    note: 'Front page: "Subsidence of Race Riots — One More Added to Death List Makes Total of 34 — Chicago Now Quiet"',
  },
  {
    hn: 'HN-442', item: 'cgl_005599', pageIndex: 16, width: 2400, issue_date: '1925-04-18',
    page_url: 'https://archive.org/details/cgl_005599',
    provider: 'Internet Archive (Glendale Evening News)',
    newspaper: 'The Glendale Evening News',
    out: 'hn-442-glendale-evening-news-19250418-p17-page.jpg',
    note: 'Page 17: Madge Oberholtzer / D. C. Stephenson trial report',
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
  let ok = 0, fail = 0;
  for (const job of JOBS) {
    const key = job.hn + '|' + job.page_url;
    const entry = {
      hn_id: job.hn, provider: job.provider, status: 'pending', page_url: job.page_url,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const url = `https://archive.org/download/${job.item}/page/n${job.pageIndex}_w${job.width}.jpg`;
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(300000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
      const outPath = IMG_DIR + '/' + job.out;
      fs.writeFileSync(outPath, buf);
      const dims = ffprobeSize(outPath);
      const gs = grayStats(outPath);
      if (dims.w < 300 || dims.h < 300) throw new Error('degenerate page ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = dims.w + 'x' + dims.h;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = 'archive_page_image';
      entry.page_selection = 'djvu_page_object';
      entry.pdf_page = job.pageIndex + 1;
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(job.hn + '  OK  n' + job.pageIndex + '  ' + dims.w + 'x' + dims.h + '  ' + (buf.length / 1024).toFixed(0) + 'KB  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      fail++;
      console.log(job.hn + '  FAIL  ' + e.message);
    }
    ledger.items[key] = entry;
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  }
  const imgs = buildImages();
  console.log(`\nAcquired: ${ok}   Failed: ${fail}`);
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
