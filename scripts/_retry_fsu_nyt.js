// Retry the NYT LibGuide image fetch with backoff and detailed error reporting.
const fs = require('fs');
const { execFileSync } = require('child_process');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/fsu-acquire';
const URL = 'https://libapps.s3.amazonaws.com/accounts/221478/images/NYT.jpg';

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const r = await fetch(URL, { headers: { 'User-Agent': UA, Referer: 'https://guides.lib.fsu.edu/Till/newyorktimes', Accept: 'image/*,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
      const buf = Buffer.from(await r.arrayBuffer());
      console.log('attempt ' + attempt + ': HTTP ' + r.status + '  ct=' + (r.headers.get('content-type') || '') + '  bytes=' + buf.length);
      if (r.status === 200 && buf.length > 10000) {
        const f = TMP + '/NYT.jpg';
        fs.writeFileSync(f, buf);
        const d = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
        console.log('saved ' + f + '  dims=' + d);
        return;
      }
    } catch (e) {
      console.log('attempt ' + attempt + ': ERROR ' + e.message + '  cause=' + (e.cause && e.cause.code ? e.cause.code : '') + ' ' + (e.cause && e.cause.message ? e.cause.message : ''));
    }
  }
  process.exit(1);
})();
