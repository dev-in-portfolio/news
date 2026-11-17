// Refresh a NewspaperSG (eresources.nlb.gov.sg) browser session.
//
// NewspaperSG serves its article pages behind an AWS WAF challenge and a
// terms-of-use modal. A real Chrome instance clears the WAF; clicking "I Agree"
// accepts the terms and issues the .AspNetCore.Session cookie. The cookie
// header + User-Agent are then used for plain HTTP requests to the archive's
// own article-clipping image endpoint.
//
// Writes the cookie header + User-Agent to
//   %TEMP%/opencode/newspapersg-session.json
//
// Usage: node scripts/newspapersg_session.js [article-url]
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/newspapersg-profile';
const OUT = 'C:/Users/dtoro/AppData/Local/Temp/opencode/newspapersg-session.json';
const PORT = Number(process.env.CDP_PORT || 9381);
const PAGE_URL = process.argv[2] || 'https://eresources.nlb.gov.sg/newspapers/digitised/article/straitstimes19740410-1.2.29.14.4';
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
  const page = ctx.pages().find(p => /nlb\.gov\.sg/.test(p.url())) || ctx.pages()[0];

  // Accept the terms-of-use modal if present.
  const clicked = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, input[type=button], input[type=submit], [role=button]')];
    const b = els.find(e => /^\s*i agree\s*$/i.test((e.textContent || e.value || '').trim()));
    if (b) { b.click(); return true; }
    return false;
  }).catch(() => false);
  await sleep(2500);

  const started = Date.now();
  let title = '', bodyLen = 0, passed = false, html = '';
  while (Date.now() - started < WAIT) {
    title = await page.title().catch(() => '');
    bodyLen = await page.evaluate(() => document.body ? document.body.innerText.length : 0).catch(() => 0);
    html = await page.content().catch(() => '');
    const challenge = /just a moment|attention required|verify you are human|access denied/i.test(title) || bodyLen < 200;
    // The article page's visible text is short; the archive's clipping <img> is
    // the reliable signal that the terms modal was accepted and content loaded.
    if (!challenge && /class="image-content"/i.test(html)) { passed = true; break; }
    await page.bringToFront().catch(() => {});
    await sleep(2500);
  }

  if (!html) html = await page.content().catch(() => '');
  const cookies = await ctx.cookies('https://eresources.nlb.gov.sg');
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
      ua, cookieHeader, created_at: new Date().toISOString(), title, bodyLen, clicked,
      cookies: cookies.map(c => ({ name: c.name, expires: c.expires })),
    }, null, 1));
  }

  await browser.close().catch(() => {});
  child.kill();
  return { passed, clicked, title, bodyLen, cookieNames: cookies.map(c => c.name), htmlLen: html.length };
}

module.exports = { refreshSession, OUT };

if (require.main === module) {
  refreshSession().then(r => {
    console.log('terms clicked:', r.clicked, '| passed:', r.passed, '| bodyLen:', r.bodyLen);
    console.log('cookies:', r.cookieNames.join(','));
    console.log('title:', String(r.title).slice(0, 100));
    if (!r.passed) process.exit(1);
  }).catch(e => { console.error('ERR', e.message); process.exit(1); });
}
