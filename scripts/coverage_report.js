// Report honest article/scan coverage across the 1,056 HN records.
const fs = require('fs');

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

const hnUrls = readJson('D:/news/scripts/hn_urls.json');
const images = readJson('D:/news/site/data/images.json');
const recon = readJson('D:/news/docs/reconciliation_ledger.json');
const records = Array.isArray(recon) ? recon : (recon.records || Object.values(recon));

function prov(u) {
  if (/oregonnews\.uoregon\.edu/.test(u)) return 'oregon';
  if (/paperspast\.natlib\.govt\.nz/.test(u)) return 'paperspast';
  if (/loc\.gov/.test(u)) return 'loc';
  if (/newspapers\.library\.in\.gov/.test(u)) return 'indiana';
  if (/gateway\.okhistory\.org/.test(u)) return 'oklahoma';
  if (/texashistory\.unt\.edu/.test(u)) return 'texas';
  if (/historicnewspapers\.sc\.edu/.test(u)) return 'southcarolina';
  if (/gahistoricnewspapers/.test(u)) return 'georgia';
  if (/theguardian\.com/.test(u)) return 'guardian';
  if (/washingtonpost\.com/.test(u)) return 'washingtonpost';
  if (/latimes\.com/.test(u)) return 'latimes';
  if (/newspaperarchive\.com/.test(u)) return 'newspaperarchive';
  if (/rarenewspapers\.com/.test(u)) return 'rarenewspapers';
  if (/britishnewspaperarchive|bl\.uk/.test(u)) return 'british';
  return 'other';
}

// Providers that block automated retrieval (bot challenge, paywall, or
// commercial image licensing). Everything else is attempted.
const BLOCKED = new Set(['indiana', 'paperspast', 'british', 'newspaperarchive', 'rarenewspapers', 'washingtonpost', 'latimes', 'guardian']);

const all = records.map(r => r.hn_id);
const total = all.length;
const withAnyUrl = all.filter(h => (hnUrls[h] || []).length > 0);
const withOregon = all.filter(h => (hnUrls[h] || []).some(u => prov(u) === 'oregon'));
const withImages = Object.keys(images);
const withCrop = Object.keys(images).filter(h => images[h].some(i => i.crop));
const noUrl = all.filter(h => (hnUrls[h] || []).length === 0);

// records whose ONLY urls are on blocked providers
const blockedOnly = withAnyUrl.filter(h => {
  const ps = new Set((hnUrls[h] || []).map(prov));
  return [...ps].every(p => BLOCKED.has(p));
});

// unique HN per provider
const hnByProv = {};
for (const h of all) {
  const ps = new Set((hnUrls[h] || []).map(prov));
  for (const p of ps) (hnByProv[p] = hnByProv[p] || []).push(h);
}

// acquired scans per provider (items, not records)
const itemsByProv = {};
for (const arr of Object.values(images)) {
  for (const i of arr) {
    const p = i.provider || 'unknown';
    itemsByProv[p] = (itemsByProv[p] || 0) + 1;
  }
}

const pct = n => (100 * n / total).toFixed(1) + '%';
console.log('TOTAL records: ' + total);
console.log('Records with >=1 batch-report URL: ' + withAnyUrl.length + ' (' + pct(withAnyUrl.length) + ')');
console.log('Records with >=1 Oregon URL: ' + withOregon.length + ' (' + pct(withOregon.length) + ')');
console.log('Records with acquired images: ' + withImages.length + ' (' + pct(withImages.length) + ')');
console.log('Records with a word-coordinate-verified article crop: ' + withCrop.length + ' (' + pct(withCrop.length) + ')');
console.log('Records with NO batch-report URL at all: ' + noUrl.length + ' (' + pct(noUrl.length) + ')');
console.log('Records whose only URLs are blocked/paywalled providers: ' + blockedOnly.length);
console.log('\nUnique HN records by provider (a record can have several):');
for (const [p, arr] of Object.entries(hnByProv).sort((a, b) => b[1].length - a[1].length)) {
  console.log('  ' + p.padEnd(16) + arr.length);
}
console.log('\nAcquired page scans by provider:');
for (const [p, n] of Object.entries(itemsByProv).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + p.padEnd(60) + n);
}
console.log('\nTotal distinct batch URLs: ' + [...new Set(Object.values(hnUrls).flat())].length);
console.log('Total HN IDs seen in batch reports: ' + Object.keys(hnUrls).length);
