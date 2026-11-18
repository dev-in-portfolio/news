// Extract every URL from every text field of the 98 gap records and flag any
// historical-newspaper host, so no cited scan is missed in the prose. Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const records = rj(ROOT + '/site/data/records.json');
const recArr = Array.isArray(records) ? records : Object.values(records);
const images = rj(ROOT + '/site/data/images.json');
const urls = rj(ROOT + '/scripts/hn_urls.json');

const FIELDS = ['url', 'report', 'recorded_finding', 'audit_finding', 'discovery_body', 'rationale', 'audit_assessment', 'audit_prior_evidence', 'discovery_title', 'audit_links'];
const HIST = /(newspapers?\.library\.in\.gov|oregonnews\.uoregon|chroniclingamerica|loc\.gov\/resource|loc\.gov\/item|paperspast|trove|nli\.org\.il|nlb\.gov\.sg|virginiachronicle|hrvh|cdnc|bl\.iro|britishnewspaperarchive|historyworm|archive\.spectator|scvhistory|okhistory|texashistory|newspaperarchive|rarenewspapers|genealogybank|newspapers\.com\/article|contentdm|quartex|iiif)/i;

const gaps = recArr.filter(r => !(images[r.hn_id] || []).length);
console.log('gap records: ' + gaps.length);

let anyHist = 0;
const extraUrls = new Map();
for (const r of gaps) {
  const idx = new Set((urls[r.hn_id] || []).map(u => String(u).replace(/&amp;/g, '&')));
  const found = new Set();
  for (const f of FIELDS) {
    for (const m of String(r[f] || '').matchAll(/https?:\/\/[^\s)\]"'>]+/g)) found.add(m[0].replace(/&amp;/g, '&'));
  }
  const notIndexed = [...found].filter(u => !idx.has(u));
  const hist = [...found].filter(u => HIST.test(u));
  if (hist.length) {
    anyHist++;
    console.log('\n' + r.hn_id + '  primary=' + r.url);
    for (const u of hist) console.log('   HIST ' + u + (idx.has(u) ? '' : '   (NOT in hn_urls.json)'));
  }
  if (notIndexed.length) extraUrls.set(r.hn_id, notIndexed);
}
console.log('\ngap records with a historical host anywhere in text: ' + anyHist);
console.log('gap records with URLs not present in hn_urls.json: ' + extraUrls.size);
for (const [hn, list] of [...extraUrls.entries()].slice(0, 10)) console.log('  ' + hn + '  ' + list.slice(0, 3).join('  '));
