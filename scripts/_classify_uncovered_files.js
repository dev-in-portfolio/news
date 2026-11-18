// Classify the remaining uncovered cited file URLs. Newspaper-page PDFs are
// checked against the record's stored page images by issue+sequence, because
// the same page is often stored from its HTML viewer URL while the citation
// uses the .pdf URL.
const fs = require('fs');

function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }

const images = rj('D:/news/site/data/images.json');
const urls = rj('D:/news/scripts/hn_urls.json');

// Re-derive uncovered file URLs exactly as _audit_uncovered_files.js does.
function isFile(u) { return /\.(pdf|jpe?g|png|tiff?|jp2|webp)(?:[?#]|$)/i.test(u); }
function covered(hn, u) {
  return (images[hn] || []).some(i => i.page_url === u || i.crop === u || i.full_page === u);
}

const rows = [];
for (const hn of Object.keys(urls)) {
  for (const u of urls[hn]) {
    if (isFile(u) && !covered(hn, u)) rows.push([hn, u]);
  }
}
console.log('uncovered file URLs: ' + rows.length + '\n');

const ORE = /^https?:\/\/oregonnews\.uoregon\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)\.pdf/i;
const SC = /^https?:\/\/historicnewspapers\.sc\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)\.pdf/i;
const LOC = /^https?:\/\/tile\.loc\.gov\/storage-services\/service\/ndnp\/[^/]+\/[^/]+\/data\/([^/]+)\/[^/]+\/(\d{4})(\d{2})(\d{2})01\/(\d+)\.pdf/i;

const buckets = { oregon: [], sc: [], loc: [], other: [] };
for (const [hn, u] of rows) {
  let m;
  if ((m = u.match(ORE))) buckets.oregon.push({ hn, u, lccn: m[1], date: m[2], seq: +m[4] });
  else if ((m = u.match(SC))) buckets.sc.push({ hn, u, lccn: m[1], date: m[2], seq: +m[4] });
  else if ((m = u.match(LOC))) buckets.loc.push({ hn, u, lccn: m[1], date: `${m[2]}-${m[3]}-${m[4]}`, seq: +m[5] });
  else buckets.other.push({ hn, u });
}

function storedSeqs(hn, lccn, date) {
  return (images[hn] || []).filter(i => i.issue_date === date && (!lccn || (i.lccn || '') === lccn || (i.page_url || '').includes(lccn)))
    .map(i => ({ seq: i.sequence, page_url: i.page_url }));
}

for (const kind of ['oregon', 'sc', 'loc']) {
  console.log('===== ' + kind + ' (' + buckets[kind].length + ')');
  for (const r of buckets[kind]) {
    const stored = storedSeqs(r.hn, r.lccn, r.date);
    const has = stored.some(s => s.seq === r.seq);
    console.log((has ? '  COVERED ' : '  MISSING ') + r.hn + '  ' + r.lccn + '  ' + r.date + '  seq' + r.seq +
      '   stored=' + JSON.stringify(stored.map(s => s.seq)));
  }
  console.log();
}

console.log('===== other (' + buckets.other.length + ')');
for (const r of buckets.other) console.log('  ' + r.hn + '  ' + r.u);
