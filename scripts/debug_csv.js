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

const DATA = 'D:/news/docs';
const cov = fs.readFileSync(path.join(DATA, 'COVERAGE_SEARCH_LEDGER.csv'), 'utf8');
const lines = cov.split(/\r?\n/).filter(Boolean);
console.log('Total lines:', lines.length);
const header = parseCsvLine(lines[0]).map(h => h.trim());
console.log('Header:', header);

// Show first 3 data rows parsed
for (let i = 1; i <= 3; i++) {
  const cols = parseCsvLine(lines[i]);
  console.log(`Row ${i}:`, cols.map(c => c.substring(0, 60)));
}
