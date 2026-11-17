// Refresh a National Library of Israel — Historical Jewish Press (JPress)
// browser session.
//
// nli.org.il sits behind a Cloudflare JS challenge. A real Chrome instance
// clears it and receives the cf_clearance cookie, which then lets plain HTTP
// requests (article page + Veridian block-image endpoint) through.
//
// Writes the cookie header + User-Agent to
//   %TEMP%/opencode/nli-session.json
//
// Usage: node scripts/nli_session.js [article-url]
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/nli-profile';
const OUT = 'C:/Users/dtoro/AppData/Local/Temp/opencode/nli-session.json';
const PORT = Number(process.env.CDP_PORT || 9371);
const PAGE_URL = process.argv[2] || 'https://www.nli.org.il/en/newspapers/jweekly/1992/09/04/article/3.3';
const WAIT = Number(process.env.WAIT || 180000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function refreshSession() {
  fs.mkdirSync(PROFILE, { recursive: true });
  const child = spawn(CHROME, [
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', PAGE_URL,
  ], { stdio: 'ignore' });

  let up = false;
  for (let i = 0; i < 80; i++) {
    await sleep(500);
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(2000) });
      if (r.ok) { up = true; break; }
    } catch (e) { /* not up */ }
  }
  if (!up) { child.kill(); throw new Error('Chrome DevTools endpoint never came up'); }

  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => /nli\.org\.il/.test(p.url())) || ctx.pages()[0];

  const started = Date.now();
  let title = '', bodyLen = 0, passed = false;
  while (Date.now() - started < WAIT) {
    title = await page.title().catch(() => '');
    bodyLen = await page.evaluate(() => document.body ? document.body.innerText.length : 0).catch(() => 0);
    const challenge = /just a moment|attention required|cloudflare|verify you are human/i.test(title) || bodyLen < 200;
    if (!challenge) { passed = true; break; }
    await page.bringToFront().catch(() => {});
    await sleep(2500);
  }

  const cookies = await ctx.cookies('https://www.nli.org.il');
  let ua = '';
  for (let i = 0; i < 6 && !ua; i++) {
    try { ua = await page.evaluate(() => navigator.userAgent); } catch (e) { await sleep(1500); }
  }
  if (!ua) {
    const v = await browser.version().catch(() => '');
    ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' +
      (v.split('/')[1] || '131.0.0.0') + ' Safari/537.36';
  }
  const cookieHeader = cookies.map(c => c.name + '=' + c.value).join('; ');

  if (passed) {
    fs.writeFileSync(OUT, JSON.stringify({
      ua, cookieHeader, created_at: new Date().toISOString(), title, bodyLen,
      cookies: cookies.map(c => ({ name: c.name, expires: c.expires })),
    }, null, 1));
  }

  await browser.close().catch(() => {});
  child.kill();
  return { passed, title, bodyLen, cookieNames: cookies.map(c => c.name) };
}

module.exports = { refreshSession, OUT };

if (require.main === module) {
  refreshSession().then(r => {
    console.log('challenge passed:', r.passed, '| bodyLen:', r.bodyLen, '| cookies:', r.cookieNames.join(','));
    console.log('title:', String(r.title).slice(0, 100));
    if (!r.passed) process.exit(1);
  }).catch(e => { console.error('ERR', e.message); process.exit(1); });
}
