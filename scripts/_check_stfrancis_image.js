// Check whether the St. Francis Dam "historical-newspapers.jpg" is a single
// newspaper page scan or a composite montage (verification only; no OCR stored).
const { execFileSync } = require('child_process');
const F = 'C:/Users/dtoro/AppData/Local/Temp/opencode/probe-files/stfrancis/historical-newspapers.jpg';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
function winPath(p) { return p.split('/').join('\\'); }
function grayStats(f) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=64:64,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  let sum = 0, sum2 = 0, min = 255;
  for (const v of raw) { sum += v; sum2 += v * v; if (v < min) min = v; }
  const n = raw.length, mean = sum / n;
  return { sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), min, mean };
}
(async () => {
  const gs = grayStats(F);
  console.log('gray: sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + ' mean=' + gs.mean.toFixed(1));
  const png = 'C:/Users/dtoro/AppData/Local/Temp/opencode/probe-files/stfrancis/historical-newspapers-2x.png';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', F, '-vf', 'scale=iw*2:ih*2,format=rgb24', png]);
  let text = '';
  try { text = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 180000 }); }
  catch (e) { console.log('OCR ERROR ' + e.message); }
  console.log('text: ' + text.replace(/\s+/g, ' ').slice(0, 900));
})().catch(e => { console.error(e); process.exit(1); });
