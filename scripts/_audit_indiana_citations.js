// Precise Indiana citation audit.
// For every distinct cited Indiana URL, determine:
//   - level: page (second number = 1) or article (second number >= 2)
//   - whether a stored image already covers that record+citation
//   - mosaic-ledger status if present
//   - whether this URL is the record's primary `url`
// Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');
const records = rj(ROOT + '/site/data/records.json');
const recArr = Array.isArray(records) ? records : Object.values(records);
const recById = Object.fromEntries(recArr.map(r => [r.hn_id, r]));
const mosaic = (rj(ROOT + '/docs/INDIANA_MOSAIC_LEDGER.json').items) || {};
const clipLedger = (rj(ROOT + '/docs/INDIANA_IMAGE_ACQUISITION_LEDGER.json').items) || {};

const norm = u => String(u).replace(/&amp;/g, '&').trim();
const RE = /newspapers\.library\.in\.gov\/\?a=d&d=([A-Za-z0-9]+)\.(\d+)\.(\d+)/;

// index mosaic ledger by citation key
const mosaicByKey = {};
for (const [k, v] of Object.entries(mosaic)) {
  const m = norm(v.page_url || k.split('|')[1] || '').match(RE);
  if (m) mosaicByKey[m[1] + '.' + m[2] + '.' + m[3]] = v;
}
const clipByKey = {};
for (const [k, v] of Object.entries(clipLedger)) {
  const m = norm(v.page_url || k.split('|')[1] || '').match(RE);
  if (m) clipByKey[m[1] + '.' + m[2] + '.' + m[3]] = v;
}

const rows = [];
for (const [hn, list] of Object.entries(urls)) {
  for (const raw of list || []) {
    const u = norm(raw);
    const m = u.match(RE);
    if (!m) continue;
    const key = m[1] + '.' + m[2] + '.' + m[3];
    const level = Number(m[2]) >= 2 ? 'article' : 'page';
    // covered if any stored image for this record has a page_url containing the key
    let covered = false;
    for (const i of images[hn] || []) {
      const pu = norm(i.page_url || '');
      if (pu.includes(key)) { covered = true; break; }
      if (i.crop && String(i.crop).includes(key.replace(/\./g, '-').toLowerCase())) { covered = true; break; }
    }
    const rec = recById[hn] || {};
    rows.push({
      hn, key, level, covered,
      primary: norm(rec.url || '') === u,
      mosaic: mosaicByKey[key] ? mosaicByKey[key].status : null,
      mosaicErr: mosaicByKey[key] ? (mosaicByKey[key].error || '') : null,
      clip: clipByKey[key] ? clipByKey[key].status : null,
    });
  }
}

const page = rows.filter(r => r.level === 'page');
const art = rows.filter(r => r.level === 'article');
console.log('distinct Indiana citations: ' + rows.length + '  page-level: ' + page.length + '  article-level: ' + art.length);
console.log('page-level covered: ' + page.filter(r => r.covered).length + '  uncovered: ' + page.filter(r => !r.covered).length);
console.log('article-level covered: ' + art.filter(r => r.covered).length + '  uncovered: ' + art.filter(r => !r.covered).length);

const unc = page.filter(r => !r.covered);
const buckets = {};
for (const r of unc) {
  const b = r.mosaic ? ('mosaic:' + r.mosaic) : 'not-in-mosaic-ledger';
  buckets[b] = (buckets[b] || 0) + 1;
}
console.log('\nuncovered page-level by mosaic status:');
for (const [b, n] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + b);

const primaryUnc = unc.filter(r => r.primary);
console.log('\nuncovered page-level that ARE the record primary url: ' + primaryUnc.length);
const retryable = unc.filter(r => !r.mosaic || r.mosaic === 'failed');
console.log('uncovered page-level never attempted or token-failed (retryable): ' + retryable.length);
const absent = unc.filter(r => r.mosaic === 'page_unavailable');
console.log('uncovered page-level marked page_unavailable: ' + absent.length);

console.log('\n--- retryable sample (first 40) ---');
for (const r of retryable.slice(0, 40)) {
  const rec = recById[r.hn] || {};
  console.log(`  ${r.hn}  ${r.key}  primary=${r.primary}  mosaic=${r.mosaic || '-'}  ${(rec.date || '')}  ${(rec.heading || '').slice(0, 44)}`);
}
