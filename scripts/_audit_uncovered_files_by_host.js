// Group the uncovered cited file URLs by host so the remaining candidates can be triaged.
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/news';

function readJson(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
function norm(u) { return String(u || '').replace(/&amp;/g, '&').split('#')[0].replace(/\/$/, ''); }

const urls = readJson(path.join(ROOT, 'scripts', 'hn_urls.json'));
const images = readJson(path.join(ROOT, 'site', 'data', 'images.json'));

const byHost = {};
for (const [hn, list] of Object.entries(urls)) {
  const stored = new Set();
  for (const i of images[hn] || []) stored.add(norm(i.page_url));
  for (const raw of list) {
    const u = norm(raw);
    if (!u || stored.has(u)) continue;
    if (!/\.(?:pdf|jpe?g|png|tiff?|jp2)(?:[?#].*)?$/i.test(u)) continue;
    let host = 'invalid';
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) {}
    (byHost[host] = byHost[host] || []).push({ hn, url: u, stored: (images[hn] || []).length });
  }
}
const rows = Object.entries(byHost).sort((a, b) => b[1].length - a[1].length);
for (const [host, list] of rows) {
  console.log(host + '  (' + list.length + ')');
  for (const x of list) console.log('   ' + x.hn + '  stored=' + x.stored + '  ' + x.url);
}
