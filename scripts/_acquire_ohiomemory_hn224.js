// Download the Ohio Memory (Ohio History Connection) IIIF scan of the Daily Ohio
// State Journal page cited by HN-224 and register it as an additional cited
// article scan.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const OUT = 'D:/news/site/assets/images/hn-224-ohio-memory-daily-ohio-state-journal-18730523-p1-page.jpg';
const URL = 'https://ohiomemory.org/iiif/2/p16007coll22:53922/full/full/0/default.jpg';
const LEDGER = 'D:/news/docs/OTHER_IMAGE_ACQUISITION_LEDGER.json';

function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}
function grayStats(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=64:64,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  let sum = 0, sum2 = 0, min = 255;
  for (const v of raw) { sum += v; sum2 += v * v; if (v < min) min = v; }
  const n = raw.length, mean = sum / n;
  return { mean, sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), min };
}

(async () => {
  const r = await fetch(URL, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(300000) });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log('HTTP ' + r.status + '  bytes=' + buf.length + '  magic=' + buf.slice(0, 3).toString('latin1'));
  if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG');
  fs.writeFileSync(OUT, buf);
  const d = ffprobeSize(OUT);
  const gs = grayStats(OUT);
  console.log('dims=' + d.w + 'x' + d.h + '  gray sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + ' mean=' + gs.mean.toFixed(1));
  if (d.w < 500 || d.h < 500) throw new Error('degenerate page');
  if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank');

  let s = fs.readFileSync(LEDGER, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  const l = JSON.parse(s);
  const items = l.items || {};
  const key = 'HN-224|https://ohiomemory.org/digital/collection/p16007coll22/id/53921/';
  items[key] = {
    hn_id: 'HN-224',
    provider: 'Ohio History Connection (Ohio Memory)',
    status: 'image_acquired',
    page_url: 'https://ohiomemory.org/digital/collection/p16007coll22/id/53921/',
    newspaper: 'Daily Ohio State Journal (Columbus, Ohio)',
    issue_date: '1873-05-23',
    error: null,
    acquired_at: new Date().toISOString(),
    full_page_asset: 'assets/images/' + path.basename(OUT),
    source_dimensions: d.w + 'x' + d.h,
    output_dimensions: d.w + 'x' + d.h,
    mosaic_method: 'archive_iiif_image',
    page_selection: 'front_page',
    article_note: 'Front page contrasting the Polaris captains Tyson and Budington (a related contemporaneous report cited by the record, not the Hall-poisoning dispatch)',
    additional_cited_article: true,
    gray_stats: { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) },
  };
  l.items = items;
  l.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 1));
  console.log('registered ' + key);
  const imgs = buildImages();
  console.log('records with images: ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
