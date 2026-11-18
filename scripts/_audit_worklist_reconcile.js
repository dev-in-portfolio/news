// Reconcile the --include-imaged worklist against the audit's uncovered set.
//
// A = distinct record+key page-level Indiana citations not covered by a stored
//     image (the audit definition).
// B = doc+section keys the acquisition script would visit (deduped by
//     document+section, all citing records merged).
// Lists A\B (a citation the script would miss) and B\A (a section with no
// uncovered citation). Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');
const mosaic = (rj(ROOT + '/docs/INDIANA_MOSAIC_LEDGER.json').items) || {};
const RE = /newspapers\.library\.in\.gov\/\?a=d&d=([A-Za-z0-9]+?-?\d{8}(?:-\d+)?)\.(\d+)\.(\d+)/;
const norm = u => String(u || '').replace(/&amp;/g, '&').trim();

const A = new Map(); // "hn|doc.sec" -> {hn, doc, sec, key}
for (const [hn, list] of Object.entries(urls)) {
  for (const raw of list || []) {
    const u = norm(raw);
    const m = u.match(RE);
    if (!m) continue;
    if (Number(m[2]) >= 2) continue; // page-level only
    const doc = m[1], sec = m[2] + '.' + m[3];
    const key = doc + '.' + sec;
    // covered if a stored image for this record names this citation
    let covered = false;
    for (const i of images[hn] || []) {
      const pu = norm(i.page_url);
      if (pu.includes(key)) { covered = true; break; }
      if (i.crop && String(i.crop).includes(key.replace(/\./g, '-'))) { covered = true; break; }
    }
    if (covered) continue;
    const id = hn + '|' + key;
    if (!A.has(id)) A.set(id, { hn, doc, sec, key });
  }
}

const B = new Map(); // "doc.sec" -> [hn]
for (const [id, r] of A) {
  const k = r.doc + '.' + r.sec;
  if (!B.has(k)) B.set(k, []);
  B.get(k).push(r.hn);
}

const aKeys = new Set([...A.values()].map(r => r.doc + '.' + r.sec));
const aMissed = [...A.values()].filter(r => !B.has(r.doc + '.' + r.sec)); // always empty by construction
console.log('A: uncovered record+citation pairs = ' + A.size);
console.log('B: distinct doc+section worklist keys = ' + B.size);
console.log('A record count = ' + new Set([...A.values()].map(r => r.hn)).size);

// Sections already in the mosaic ledger (attempted before this run)
let inLedger = 0, acquired = 0, unavailable = 0, failed = 0, notInLedger = 0;
for (const k of B.keys()) {
  const hit = Object.values(mosaic).find(v => {
    const m = norm(v.page_url).match(RE);
    return m && (m[1] + '.' + m[2] + '.' + m[3]) === k;
  });
  if (!hit) { notInLedger++; continue; }
  inLedger++;
  if (hit.status === 'page_mosaic_acquired') acquired++;
  else if (hit.status === 'page_unavailable') unavailable++;
  else if (hit.status === 'failed') failed++;
}
console.log('\nworklist keys already in mosaic ledger: ' + inLedger +
  '  (acquired=' + acquired + ' unavailable=' + unavailable + ' failed=' + failed + ')');
console.log('worklist keys not yet in ledger (this run acquires them): ' + notInLedger);

// Sections with more than one citing record (merged into one fetch)
const multi = [...B.entries()].filter(([, hns]) => new Set(hns).size > 1);
console.log('\ndoc+section keys cited by >1 record: ' + multi.length);
for (const [k, hns] of multi.slice(0, 15)) console.log('  ' + k + '  <- ' + [...new Set(hns)].join(','));
