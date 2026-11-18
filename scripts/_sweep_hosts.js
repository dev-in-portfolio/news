// Final sweep: classify every cited URL by host/shape and report article-level
// citations that do not yet have a stored article crop/clip.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');
const records = rj(ROOT + '/site/data/records.json');
const recArr = Array.isArray(records) ? records : Object.values(records);

// host -> samples
const byHost = new Map();
for (const [hn, list] of Object.entries(urls)) {
  for (const raw of list || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    let host;
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { continue; }
    if (!byHost.has(host)) byHost.set(host, new Set());
    byHost.get(host).add(u);
  }
}
console.log('=== HOSTS (>=1 URL) ===');
for (const [h, set] of [...byHost.entries()].sort((a, b) => b[1].size - a[1].size)) {
  console.log(`\n## ${h}  (${set.size})`);
  for (const u of [...set].slice(0, 8)) console.log('   ' + u.slice(0, 180));
}
