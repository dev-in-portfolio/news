// Detect duplicate or conflicting stored renditions after an Indiana batch.
//
// A shared asset is legitimate when every record that references it also cites
// that page in scripts/hn_urls.json (related records often cite the same
// articles). Only a reference by a record that does not cite the page is a
// conflict. page_key is only unique within one document, so collisions are
// compared per document, not per record.
//
// Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const images = rj(ROOT + '/site/data/images.json');
const urls = rj(ROOT + '/scripts/hn_urls.json');

const norm = u => String(u || '').replace(/&amp;/g, '&').trim();
const DOC = /newspapers\.library\.in\.gov\/\?a=d&d=([A-Za-z0-9]+?-?\d{8}(?:-\d+)?)\.(\d+)\.(\d+)/;

// record -> set of cited Indiana keys (doc + section)
const cited = {};
for (const [hn, list] of Object.entries(urls)) {
  const set = new Set();
  for (const raw of list || []) {
    const m = norm(raw).match(DOC);
    if (m) set.add(m[1] + '.' + m[2] + '.' + m[3]);
  }
  cited[hn] = set;
}

const byAsset = new Map();
let total = 0;
const pageKeyCollisions = [];

for (const [hn, list] of Object.entries(images)) {
  const seenKey = new Map(); // doc|page_key -> [cited_section]
  for (const i of list || []) {
    total++;
    const asset = i.crop || i.full_page;
    if (asset) {
      if (!byAsset.has(asset)) byAsset.set(asset, []);
      byAsset.get(asset).push({ hn, page_url: norm(i.page_url) });
    }
    if (i.page_key) {
      const m = norm(i.page_url).match(DOC);
      const doc = m ? m[1] : '(nodoc)';
      const k = doc + '|' + i.page_key;
      if (!seenKey.has(k)) seenKey.set(k, []);
      seenKey.get(k).push(i.cited_section || '(none)');
    }
  }
  for (const [k, secs] of seenKey) {
    if (secs.length > 1) pageKeyCollisions.push({ hn, key: k, cited_sections: secs });
  }
}

console.log('image entries: ' + total + '  records: ' + Object.keys(images).length);

// True conflicts: an asset referenced by a record that does not cite its page.
const conflicts = [];
for (const [asset, refs] of byAsset) {
  for (const r of refs) {
    const m = r.page_url.match(DOC);
    if (!m) continue; // non-Indiana assets are matched by exact page_url elsewhere
    const key = m[1] + '.' + m[2] + '.' + m[3];
    if (!(cited[r.hn] || new Set()).has(key)) conflicts.push({ asset, hn: r.hn, key });
  }
}
console.log('\nasset referenced by a record that does not cite that page: ' + conflicts.length);
for (const c of conflicts.slice(0, 30)) console.log('  ' + c.hn + '  ' + c.key + '  ' + c.asset);

console.log('\npage_key collisions within one record and document: ' + pageKeyCollisions.length);
for (const c of pageKeyCollisions.slice(0, 30)) {
  console.log('  ' + c.hn + '  ' + c.key + '  cited_sections=' + c.cited_sections.join(','));
}

let missing = 0;
for (const a of byAsset.keys()) {
  if (!fs.existsSync(ROOT + '/site/' + a)) { missing++; if (missing <= 10) console.log('  MISSING FILE ' + a); }
}
console.log('\nreferenced assets missing on disk: ' + missing);
