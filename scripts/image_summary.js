// Summarise the merged image data and the remaining gaps with explicit reasons.
// Read-only: does not fetch anything.
//
// Usage: node scripts/image_summary.js
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/news';
function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

const records = readJson(path.join(ROOT, 'site/data/records.json'));
const arr = Array.isArray(records) ? records : (records.records || Object.values(records));
const images = readJson(path.join(ROOT, 'site/data/images.json'));
const hnUrls = readJson(path.join(ROOT, 'scripts/hn_urls.json'));

let items = 0, crops = 0, fullPages = 0;
const methodCounts = {};
const recordsWith = new Set(Object.keys(images));
for (const hn of recordsWith) {
  for (const im of images[hn]) {
    items++;
    if (im.crop) crops++;
    if (im.full_page) fullPages++;
    const kind = im.crop
      ? (im.crop_method || 'crop')
      : (im.mosaic_method || 'page_scan');
    methodCounts[kind] = (methodCounts[kind] || 0) + 1;
  }
}

const gaps = arr.filter(r => !recordsWith.has(r.hn_id));
function classify(r) {
  const urls = (hnUrls[r.hn_id] || []).map(String);
  const u = r.url || urls[0] || '';
  if (/bl\.iro\.bl\.uk/.test(u)) return 'British Library OCR-only (no page scans published)';
  if (/theguardian\.com|washingtonpost\.com|latimes\.com|sfchronicle\.com|wcax\.com|ny1\.com/.test(u)) {
    return 'Modern copyrighted web article (not a historical newspaper scan)';
  }
  if (/newspapers\.library\.in\.gov/.test(u)) return 'Indiana archive (pending / no article blocks)';
  return 'Other';
}
const reasons = {};
for (const r of gaps) {
  const k = classify(r);
  (reasons[k] = reasons[k] || []).push(r.hn_id);
}

console.log('records total:', arr.length);
console.log('records with >=1 image:', recordsWith.size);
console.log('records without image:', gaps.length);
console.log('image entries:', items, '| crops/clips:', crops, '| full pages:', fullPages);
console.log('\nentries by method:');
for (const [k, v] of Object.entries(methodCounts).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(v).padStart(5) + '  ' + k);
}
console.log('\nremaining gaps by reason:');
for (const [k, ids] of Object.entries(reasons).sort((a, b) => b[1].length - a[1].length)) {
  console.log('  ' + String(ids.length).padStart(4) + '  ' + k);
  // Print every id: the Indiana list doubles as the --only argument for the
  // full-page mosaic fallback.
  console.log('        ' + ids.sort().join(', '));
}
