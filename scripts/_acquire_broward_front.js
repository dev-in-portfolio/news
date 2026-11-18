// Download the Broward County Library IIIF image of the 1983-11-01
// *Hollywood Sun-Tattler* front page (item 42729) and report dimensions.
const fs = require('fs');
const { execFileSync } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const OUT = 'D:/news/site/assets/images/hn-741-hollywood-sun-tattler-19831101-p1-page.jpg';
const URL = 'https://digitalarchives.broward.org/iiif/2/p16146coll7:42729/full/full/0/default.jpg';

(async () => {
  const r = await fetch(URL, {
    headers: { 'User-Agent': UA, Referer: 'https://digitalarchives.broward.org/digital/collection/p16146coll7/id/42730/' },
    signal: AbortSignal.timeout(300000),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log('HTTP ' + r.status + '  bytes=' + buf.length + '  magic=' + buf.slice(0, 3).toString('latin1'));
  if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG');
  fs.writeFileSync(OUT, buf);
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', OUT], { encoding: 'utf8' }).trim();
  console.log('dims=' + out);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', OUT, '-vf', 'scale=64:64,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  let sum = 0, sum2 = 0, min = 255;
  for (const v of raw) { sum += v; sum2 += v * v; if (v < min) min = v; }
  const n = raw.length, mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  console.log('gray sd=' + sd.toFixed(1) + ' min=' + min + ' mean=' + mean.toFixed(1));
})().catch(e => { console.error(e); process.exit(1); });
