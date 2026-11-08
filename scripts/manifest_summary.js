const fs = require('fs');
const path = require('path');

const MANIFEST = 'D:/news/docs/SOURCE_ACQUISITION_MANIFEST.csv';
const text = fs.readFileSync(MANIFEST, 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);
const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  const row = {};
  header.forEach((h, j) => { row[h] = (cols[j] || '').replace(/"/g, ''); });
  rows.push(row);
}

console.log('Total manifest rows:', rows.length);

const statuses = {};
rows.forEach(r => { statuses[r.acquisition_status] = (statuses[r.acquisition_status] || 0) + 1; });
console.log('\nAcquisition status:');
Object.entries(statuses).sort((a,b) => b[1]-a[1]).forEach(([s, c]) => {
  console.log(`  ${s}: ${c}`);
});

const providers = {};
rows.forEach(r => { providers[r.provider] = (providers[r.provider] || 0) + 1; });
console.log('\nProvider breakdown:');
Object.entries(providers).sort((a,b) => b[1]-a[1]).forEach(([p, c]) => {
  console.log(`  ${p}: ${c}`);
});

// Check Guardian verified count
const guardianVerified = rows.filter(r => r.provider === 'The Guardian' && r.acquisition_status === 'source_identity_verified');
console.log(`\nGuardian verified: ${guardianVerified.length}`);

// Check source_kind
const kinds = {};
rows.forEach(r => { kinds[r.source_kind] = (kinds[r.source_kind] || 0) + 1; });
console.log('\nSource kind:');
Object.entries(kinds).sort((a,b) => b[1]-a[1]).forEach(([k, c]) => {
  console.log(`  ${k}: ${c}`);
});
