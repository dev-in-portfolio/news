// Verify HN-231's stored article (from section 2.4) is actually the cited
// Schiller wreck report. The image is 823x5369 (too tall for one OCR pass),
// so slice it into overlapping horizontal bands and OCR each sequentially.
const { execFileSync } = require('child_process');
const fs = require('fs');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/hn231';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const SRC = 'D:/news/site/assets/images/hn-231-in-JPRP18750514-p1-s4-article.jpg';
fs.mkdirSync(TMP, { recursive: true });
const dim = execFileSync('ffprobe', ['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0', SRC], { encoding:'utf8' }).trim();
const [w,h] = dim.split(',').map(Number);
console.log('source ' + w + 'x' + h);
const band = 1400, step = 1200;
let i = 0;
for (let y = 0; y < h; y += step) {
  const oh = Math.min(band, h - y);
  if (oh < 200) break;
  i++;
  const png = TMP + '/band-' + i + '.png';
  execFileSync('ffmpeg', ['-v','error','-y','-i',SRC,'-vf','crop='+w+':'+oh+':0:'+y+',scale=1400:-1','-pix_fmt','rgb24',png]);
  let t = '';
  try { t = execFileSync('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-File',OCR,'-Path',png.split('/').join('\\')], { encoding:'utf8', timeout:300000 }); }
  catch(e) { t = ''; }
  t = t.replace(/\s+/g,' ').trim();
  console.log('\n--- band ' + i + ' (y=' + y + ') chars=' + t.replace(/\s/g,'').length + ' ---');
  console.log(t.slice(0, 700));
  // Stop once we've seen the headline region (top of article)
  if (/Schiller|wreck|Jasper|1875|survivor/i.test(t)) {
    console.log('\n>>> IDENTIFIED in band ' + i);
    break;
  }
}
