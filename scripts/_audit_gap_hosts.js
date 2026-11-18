// List every gap record (no stored image) with all its cited URL hosts, so we
// can confirm each is a modern web article or the 2 BL OCR-only records and not
// an unacquired historical newspaper scan.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const images = rj(ROOT + '/site/data/images.json');
const urls = rj(ROOT + '/scripts/hn_urls.json');
const records = rj(ROOT + '/site/data/records.json');
const arr = Array.isArray(records) ? records : Object.values(records);
const recById = Object.fromEntries(arr.map(r => [r.hn_id, r]));

const HISTORICAL = /(newspapers\.library\.in\.gov|oregonnews\.uoregon\.edu|loc\.gov|chroniclingamerica|gateway\.okhistory|texashistory\.unt|historicnewspapers\.sc\.edu|paperspast\.natlib|nli\.org\.il|eresources\.nlb|newspapers\.com|newspaperarchive|rarenewspapers|virginiachronicle|news\.hrvh|cdnc\.ucr|newspapers\.swco|bl\.iro|iiif\.library\.cmu|archive\.spectator|historyworm|bplonline\.contentdm|quartexcollections|rijha\.org|archives\.nd\.edu|lva\.virginia)/i;

const gaps = [];
for (const [hn, list] of Object.entries(urls)) {
  if (images[hn] && images[hn].length) continue;
  const hosts = new Set();
  let hist = false;
  for (const raw of list || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    try { const h = new URL(u).hostname.replace(/^www\./, ''); hosts.add(h); if (HISTORICAL.test(h)) hist = true; } catch (e) { /* ignore */ }
  }
  gaps.push({ hn, date: (recById[hn] || {}).date || '', hosts: [...hosts], hist });
}

console.log('GAP RECORDS: ' + gaps.length);
const histGaps = gaps.filter(g => g.hist);
console.log('gap records with a historical-archive host: ' + histGaps.length);
for (const g of histGaps) console.log('  ' + g.hn + '  ' + g.hosts.join(', '));

console.log('\n--- all gap records by host ---');
const byHost = new Map();
for (const g of gaps) for (const h of g.hosts) { if (!byHost.has(h)) byHost.set(h, []); byHost.get(h).push(g.hn); }
for (const [h, ids] of [...byHost.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(String(ids.length).padStart(3) + '  ' + h + '  [' + ids.slice(0, 4).join(', ') + (ids.length > 4 ? ', …' : '') + ']');
}
