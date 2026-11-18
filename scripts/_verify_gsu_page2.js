// Re-run Windows OCR on the GSU page using a Windows-style (backslash) path,
// which the WinRT file APIs require.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const F = 'C:/Users/dtoro/AppData/Local/Temp/opencode/probe-files/exhibits/GSB-1970-05-25-1.jpg';
const WIN = F.split('/').join('\\');
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';

(async () => {
  console.log('path: ' + WIN + '  exists=' + fs.existsSync(F));
  let text = '';
  try {
    text = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', WIN], { encoding: 'utf8', timeout: 180000 });
  } catch (e) { console.log('OCR ERROR ' + e.message); }
  const low = text.toLowerCase();
  console.log('hits: jackson=' + (low.split('jackson').length - 1) + '  state=' + (low.split('state').length - 1) + '  slaughter=' + (low.split('slaughter').length - 1) + '  police=' + (low.split('police').length - 1) + '  nixon=' + (low.split('nixon').length - 1));
  console.log('text: ' + text.replace(/\s+/g, ' ').slice(0, 900));
})().catch(e => { console.error(e); process.exit(1); });
