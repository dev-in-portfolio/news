const fs = require('fs');
const path = require('path');

function stripBom(s) {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

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

const DATA = 'D:/news/docs';
let cov = fs.readFileSync(path.join(DATA, 'COVERAGE_SEARCH_LEDGER.csv'), 'utf8');
cov = stripBom(cov);
const lines = cov.split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
console.log('Header:', header);

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  const row = {};
  header.forEach((h, j) => { row[h] = (cols[j] || '').trim(); });
  rows.push(row);
}

console.log('Total coverage rows:', rows.length);

const batchRows = rows.filter(r => r.discovery_source === 'batch_report');
console.log('Batch-report rows:', batchRows.length);

const batchUrls = [...new Set(batchRows.map(r => r.url))];
console.log('Unique batch-report URLs:', batchUrls.length);

// Classify by provider
function getProvider(url) {
  if (!url) return 'Other';
  if (url.match(/theguardian\.com/)) return 'The Guardian';
  if (url.match(/loc\.gov/)) return 'Library of Congress / Chronicling America';
  if (url.match(/newspapers\.library\.in\.gov/)) return 'Indiana Historical Newspapers';
  if (url.match(/wcax\.com/)) return 'WCAX';
  if (url.match(/ny1\.com/)) return 'NY1';
  if (url.match(/bl\.iro\.bl\.uk/)) return 'British Library';
  if (url.match(/oregonnews\.uoregon\.edu/)) return 'Historic Oregon Newspapers';
  if (url.match(/paperspast\.natlib\.govt\.nz/)) return 'Papers Past (NZ)';
  if (url.match(/gateway\.okhistory\.org/)) return 'Oklahoma Historical Society';
  if (url.match(/tile\.loc\.gov/)) return 'LOC Tile Storage';
  if (url.match(/newspaperarchive\.com/)) return 'NewspaperArchive';
  if (url.match(/gahistoricnewspapers/)) return 'Georgia Historic Newspapers';
  return 'Other';
}

const byProvider = {};
batchUrls.forEach(u => {
  const p = getProvider(u);
  if (!byProvider[p]) byProvider[p] = [];
  byProvider[p].push(u);
});

console.log('\n=== Batch-report URLs by provider ===');
Object.entries(byProvider).sort((a, b) => b[1].length - a[1].length).forEach(([p, urls]) => {
  console.log(`  ${p}: ${urls.length}`);
});

// Save for merging
fs.writeFileSync('D:/news/scripts/batch_urls.json', JSON.stringify(batchUrls, null, 2));
fs.writeFileSync('D:/news/scripts/batch_by_provider.json', JSON.stringify(Object.fromEntries(Object.entries(byProvider).map(([k, v]) => [k, v.length])), null, 2));
console.log('\nSaved batch_urls.json and batch_by_provider.json');
