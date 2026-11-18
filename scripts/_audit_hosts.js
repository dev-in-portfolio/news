// Inventory every host in hn_urls.json: record count, URL count, and how many of
// those records have at least one stored image whose page_url is on that host.
// Flags hosts that look like newspaper archives but have no stored rendition.
// Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');

const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return '?'; } };
const norm = u => String(u || '').replace(/&amp;/g, '&').trim();

const hosts = new Map(); // host -> {recs:Set, urls:Set, imagedRecs:Set}
for (const [hn, list] of Object.entries(urls)) {
  const imagedHosts = new Set((images[hn] || []).map(i => host(norm(i.page_url))).filter(Boolean));
  for (const raw of list || []) {
    const u = norm(raw);
    const h = host(u);
    if (!hosts.has(h)) hosts.set(h, { recs: new Set(), urls: new Set(), imagedRecs: new Set() });
    const e = hosts.get(h);
    e.recs.add(hn);
    e.urls.add(u);
    if (imagedHosts.has(h)) e.imagedRecs.add(hn);
  }
}

const rows = [...hosts.entries()].map(([h, e]) => ({ h, recs: e.recs.size, urls: e.urls.size, imaged: e.imagedRecs.size }));
rows.sort((a, b) => b.recs - a.recs);
console.log('distinct hosts: ' + rows.length + '  (record, url, imaged-record counts)');
for (const r of rows) {
  const gap = r.recs - r.imaged;
  console.log('  ' + String(r.recs).padStart(4) + ' recs  ' + String(r.urls).padStart(4) + ' urls  ' +
    String(gap).padStart(4) + ' unimaged  ' + r.h);
}
