// Refresh a Hoosier State Chronicles (newspapers.library.in.gov) browser session.
//
// The site sits behind a Cloudflare managed challenge. A real Chrome instance
// passes it in roughly 10-40 seconds; the resulting cf_clearance cookie then
// lets plain HTTP requests through (including the article-block image service).
//
// This script launches Chrome over the DevTools protocol, waits for the
// challenge to clear, and writes the cookie header + User-Agent to
//   %TEMP%/opencode/indiana-session.json
//
// Usage: node scripts/indiana_session.js [url]
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-profile3';
const OUT = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-session.json';
const PORT = Number(process.env.CDP_PORT || 9340);
const PAGE_URL = process.argv[2] || 'https://newspapers.library.in.gov/?a=d&d=JCDC19111206.2.15';
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
  const page = ctx.pages().find(p => /newspapers\.library\.in\.gov/.test(p.url())) || ctx.pages()[0];

  const started = Date.now();
  let title = '';
  while (Date.now() - started < WAIT) {
    title = await page.title().catch(() => '');
    if (title && !/just a moment|verification|attention required/i.test(title)) break;
    await page.bringToFront().catch(() => {});
    await sleep(2000);
  }
  const passed = title && !/just a moment|verification|attention required/i.test(title);
  const cookies = await ctx.cookies('https://newspapers.library.in.gov');
  // The challenge page can navigate/reload while we read; retry the UA lookup
  // and fall back to the browser's own version string.
  let ua = '';
  for (let i = 0; i < 6 && !ua; i++) {
    try {
      ua = await page.evaluate(() => navigator.userAgent);
    } catch (e) {
      await sleep(1500);
    }
  }
  if (!ua) {
    const v = await browser.version().catch(() => '');
    ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' +
      (v.split('/')[1] || '131.0.0.0') + ' Safari/537.36';
  }
  const cookieHeader = cookies.map(c => c.name + '=' + c.value).join('; ');

  if (passed && cookies.some(c => c.name === 'cf_clearance')) {
    fs.writeFileSync(OUT, JSON.stringify({
      ua, cookieHeader, created_at: new Date().toISOString(), title,
      cookies: cookies.map(c => ({ name: c.name, expires: c.expires })),
    }, null, 1));
  }

  await browser.close().catch(() => {});
  child.kill();
  return { passed, title, hasClearance: cookies.some(c => c.name === 'cf_clearance') };
}

module.exports = { refreshSession, OUT };

if (require.main === module) {
  refreshSession().then(r => {
    console.log('challenge passed:', r.passed, '| cf_clearance:', r.hasClearance, '| title:', r.title.slice(0, 80));
    if (!r.passed) process.exit(1);
  }).catch(e => { console.error('ERR', e.message); process.exit(1); });
}
