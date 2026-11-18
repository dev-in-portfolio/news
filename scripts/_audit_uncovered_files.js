// List uncovered cited URLs that point directly at a file (PDF/image/JPEG),
// which are the remaining candidates for archive-owned page scans.
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/news';

function readJson(p) {
  let s = fs.readFileSync(p, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return JSON.parse(s);
}
function norm(u) { return String(u || '').replace(/&amp;/g, '&').split('#')[0].replace(/\/$/, ''); }

const urls = readJson(path.join(ROOT, 'scripts', 'hn_urls.json'));
const images = readJson(path.join(ROOT, 'site', 'data', 'images.json'));
const records = readJson(path.join(ROOT, 'site', 'data', 'records.json'));
const recArr = Array.isArray(records) ? records : (records.records || Object.values(records));
const byHn = {};
for (const r of recArr) byHn[r.hn_id] = r;

const rows = [];
for (const [hn, list] of Object.entries(urls)) {
  const stored = new Set();
  for (const i of images[hn] || []) stored.add(norm(i.page_url));
  for (const raw of list) {
    const u = norm(raw);
    if (!u || stored.has(u)) continue;
    if (!/\.(?:pdf|jpe?g|png|tiff?|jp2)(?:[?#].*)?$/i.test(u)) continue;
    rows.push({ hn, url: u, stored: (images[hn] || []).length, date: (byHn[hn] || {}).date || '', heading: (byHn[hn] || {}).heading || '' });
  }
}
rows.sort((a, b) => a.hn.localeCompare(b.hn));
console.log('uncovered file URLs: ' + rows.length);
for (const r of rows) {
  console.log(r.hn + '  stored=' + r.stored + '  ' + r.date + '  ' + r.heading.slice(0, 55));
  console.log('   ' + r.url);
}
