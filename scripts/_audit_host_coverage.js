// Host-level coverage audit: for every cited URL in scripts/hn_urls.json, group
// by hostname and check whether site/data/images.json stores any image whose
// page_url is on that host. Lists hosts with cited URLs but no stored image, so
// a missed archive can be spotted.
const fs = require('fs');

function readJson(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
function host(u) { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } }

const urls = readJson('D:/news/scripts/hn_urls.json');
const images = readJson('D:/news/site/data/images.json');

const cited = new Map();   // host -> { urls:Set, records:Set }
for (const [hn, list] of Object.entries(urls)) {
  for (const u of list || []) {
    const h = host(u);
    if (!h) continue;
    if (!cited.has(h)) cited.set(h, { urls: new Set(), records: new Set() });
    cited.get(h).urls.add(u);
    cited.get(h).records.add(hn);
  }
}

const stored = new Map();  // host -> count of stored entries
for (const arr of Object.values(images)) {
  for (const i of arr) {
    const h = host(i.page_url || '');
    if (!h) continue;
    stored.set(h, (stored.get(h) || 0) + 1);
  }
}

const rows = [...cited.entries()].map(([h, v]) => ({
  host: h, urls: v.urls.size, records: v.records.size, stored: stored.get(h) || 0,
}));
rows.sort((a, b) => (b.records - a.records) || (b.urls - a.urls));

console.log('hosts cited: ' + rows.length);
console.log('\n=== hosts with cited URLs but ZERO stored images ===');
for (const r of rows) {
  if (r.stored === 0) console.log(`${String(r.records).padStart(4)} rec  ${String(r.urls).padStart(4)} url  ${r.host}`);
}
console.log('\n=== top hosts with stored images ===');
for (const r of rows.filter(x => x.stored > 0).slice(0, 30)) {
  console.log(`${String(r.records).padStart(4)} rec  ${String(r.urls).padStart(4)} url  ${String(r.stored).padStart(4)} img  ${r.host}`);
}
