// Check whether audit_links URLs are present in hn_urls.json, and whether any
// gap record (no stored image) cites a historical-newspaper host in its
// audit_links or url. Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const records = rj(ROOT + '/site/data/records.json');
const recArr = Array.isArray(records) ? records : Object.values(records);
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');

const urlsIn = s => [...String(s || '').matchAll(/https?:\/\/[^\s)\]"'>]+/g)].map(m => m[0].replace(/&amp;/g, '&'));

let withAudit = 0, notAll = 0;
const examples = [];
for (const r of recArr) {
  const found = urlsIn(r.audit_links);
  if (!found.length) continue;
  withAudit++;
  const idx = new Set((urls[r.hn_id] || []).map(u => String(u).replace(/&amp;/g, '&')));
  const missing = found.filter(u => !idx.has(u));
  if (missing.length) { notAll++; if (examples.length < 8) examples.push([r.hn_id, missing.slice(0, 3)]); }
}
console.log('records with audit_links URLs: ' + withAudit);
console.log('records whose audit_links URLs are NOT all in hn_urls.json: ' + notAll);
for (const [h, m] of examples) console.log('  ' + h + '  ' + m.join('  '));

const HIST = /(newspapers?\.|newspaperarchive|rarenewspapers|chroniclingamerica|loc\.gov\/resource|paperspast|trove|nli\.org\.il|nlb\.gov\.sg|virginiachronicle|hrvh|cdnc|bl\.iro|britishnewspaperarchive|historyworm|spectator\.co\.uk\/article|scvhistory|okhistory|texashistory|newspapers\.library\.in\.gov|oregonnews)/i;
let n = 0;
for (const r of recArr) {
  if ((images[r.hn_id] || []).length) continue;
  const found = urlsIn(String(r.audit_links || '') + ' ' + String(r.url || ''));
  const hist = found.filter(u => HIST.test(u));
  if (hist.length) { n++; console.log('GAP ' + r.hn_id + '  ' + r.url + '  HIST=' + hist.join(' | ')); }
}
console.log('gap records with a historical host in url/audit_links: ' + n);
