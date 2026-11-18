// Check whether the uncovered loc.gov ?st=text URLs map to page resources that
// are already stored (same lccn/date/edition), and inspect the few genuinely
// different LOC items (HN-531 item record, exhibits, guides).
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');

function resKey(u) {
  const m = String(u).match(/loc\.gov\/resource\/([^/]+)\/([^/]+)\/ed-(\d+)/i);
  if (!m) return null;
  return (m[1] + '|' + m[2] + '|' + m[3]).toLowerCase();
}
function storedKeys(hn) {
  const out = new Set();
  for (const i of images[hn] || []) {
    for (const f of ['page_url', 'clip_url', 'source_url']) {
      const k = resKey(i[f] || '');
      if (k) out.add(k);
    }
  }
  return out;
}

for (const hn of Object.keys(urls)) {
  const locUrls = urls[hn].filter(u => /(^https?:\/\/(www\.)?loc\.gov\/resource\/)/i.test(u));
  if (!locUrls.length) continue;
  const have = storedKeys(hn);
  const missing = [];
  for (const u of locUrls) {
    const k = resKey(u);
    if (k && !have.has(k)) missing.push(u);
  }
  if (missing.length) {
    console.log(hn + '  stored=' + (images[hn] || []).length + '  genuinely-missing-resource-urls=' + missing.length);
    for (const u of missing) console.log('   ' + u);
  }
}
