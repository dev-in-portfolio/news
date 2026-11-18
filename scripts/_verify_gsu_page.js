// Verify the GSU "Jackson State Slaughter" page (730x1058) is legible and
// on-topic, using Windows OCR only as a content check (no text is stored).
const fs = require('fs');
const { execFileSync } = require('child_process');

const F = 'C:/Users/dtoro/AppData/Local/Temp/opencode/probe-files/exhibits/GSB-1970-05-25-1.jpg';
const OCR = 'D:/news/scripts/_ocr_windows.ps1';

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

  // Upscale 2x and convert to a plain RGB PNG, which Windows OCR handles.
  const png = F.replace(/\.jpg$/, '-2x.png');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', F, '-vf', 'scale=iw*2:ih*2,format=rgb24', png]);
  let text = '';
  try { text = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', png], { encoding: 'utf8', timeout: 180000 }); } catch (e) { console.log('OCR ERROR ' + e.message); }
  const low = text.toLowerCase();
  console.log('hits: jackson=' + (low.split('jackson').length - 1) + '  state=' + (low.split('state').length - 1) + '  slaughter=' + (low.split('slaughter').length - 1) + '  police=' + (low.split('police').length - 1) + '  nixon=' + (low.split('nixon').length - 1));
  console.log('text: ' + text.replace(/\s+/g, ' ').slice(0, 700));
})().catch(e => { console.error(e); process.exit(1); });
