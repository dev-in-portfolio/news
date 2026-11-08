const fs = require('fs');
const path = require('path');

function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let field = '';
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      if (i < line.length && line[i] === ',') i++;
      fields.push(field);
    } else {
      let end = line.indexOf(',', i);
      if (end === -1) end = line.length;
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

const MANIFEST = 'D:/news/docs/SOURCE_ACQUISITION_MANIFEST.csv';
const text = fs.readFileSync(MANIFEST, 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  const row = {};
  header.forEach((h, j) => { row[h] = (cols[j] || '').trim(); });
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

const guardianVerified = rows.filter(r => r.provider === 'The Guardian' && r.acquisition_status === 'source_identity_verified');
console.log(`\nGuardian verified: ${guardianVerified.length}`);

const guardianBlocked = rows.filter(r => r.provider === 'The Guardian' && r.acquisition_status === 'untried');
console.log(`Guardian untried: ${guardianBlocked.length}`);

const verifiedTotal = rows.filter(r => r.acquisition_status === 'source_identity_verified').length;
const blockedTotal = rows.filter(r => r.acquisition_status === 'blocked_access').length;
const untriedTotal = rows.filter(r => r.acquisition_status === 'untried').length;
console.log(`\nOverall: verified=${verifiedTotal}, blocked=${blockedTotal}, untried=${untriedTotal}`);
