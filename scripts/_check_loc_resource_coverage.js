// For each uncovered loc.gov /resource/ URL, derive lccn+date+sp and check
// whether the record already stores a LOC page image for that same page.
const fs = require('fs');

function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const images = rj('D:/news/site/data/images.json');
const urls = rj('D:/news/scripts/hn_urls.json');

function isFile(u) { return /\.(pdf|jpe?g|png|tiff?|jp2|webp)(?:[?#]|$)/i.test(u); }
function covered(hn, u) { return (images[hn] || []).some(i => i.page_url === u || i.crop === u || i.full_page === u); }

const RES = /^https?:\/\/(?:www\.)?loc\.gov\/resource\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/?(?:\?([^#]*))?/i;

const rows = [];
for (const hn of Object.keys(urls)) {
  for (const u of urls[hn]) {
    if (isFile(u) || covered(hn, u)) continue;
    const m = u.match(RES);
    if (!m) continue;
    const q = new URLSearchParams(m[4] || '');
    const sp = q.get('sp') ? +q.get('sp') : 1;
    rows.push({ hn, u, lccn: m[1], date: m[2], ed: m[3], sp });
  }
}

console.log('uncovered LOC resource URLs: ' + rows.length + '\n');
for (const r of rows) {
  const stored = (images[r.hn] || []).filter(i =>
    i.issue_date === r.date &&
    ((i.page_url || '').includes(r.lccn) || (i.lccn || '') === r.lccn));
  const match = stored.filter(s => (s.sequence || 1) === r.sp);
  const status = match.length ? 'COVERED' : (stored.length ? 'OTHER-PAGE' : 'NO-LOC-PAGE');
  console.log('  ' + status.padEnd(12) + r.hn + '  ' + r.lccn + '  ' + r.date + '  sp=' + r.sp +
    '  storedLocPages=' + JSON.stringify(stored.map(s => s.sequence)));
}
