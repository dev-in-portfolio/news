// Repair SOURCE_ACQUISITION_MANIFEST.csv.
//
// The original 1,056 rows were written with an unquoted comma inside issue_date
// (e.g. "July 22, 1777"). That split one field into two and pushed every later
// column right by one, while the row total stayed at 29 because the final
// next_action field was dropped.
//
// Fix: detect the "Month D" + " YYYY" pair, merge them, then append the missing
// trailing field. Rewrite the whole file with RFC-4180 quoting.
const fs = require('fs');

const P = 'D:/news/docs/SOURCE_ACQUISITION_MANIFEST.csv';
const raw = fs.readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/).filter(l => l.length);

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

const header = parseCsvLine(lines[0]).map(h => h.trim());
const N = header.length;
const IDX = {};
header.forEach((h, i) => { IDX[h] = i; });

const MONTH_D = /^[A-Za-z]{3,9}\.?\s+\d{1,2}$/;
const YEAR = /^\s*\d{4}\s*$/;

let shifted = 0, clean = 0;
const rows = [];

for (let i = 1; i < lines.length; i++) {
  const f = parseCsvLine(lines[i]);
  const cur = (f[IDX.issue_date] || '');
  const nxt = f[IDX.issue_date + 1] || '';
  // A shifted row has the year sitting in the next column, with a non-empty date
  // fragment before it (e.g. "February 3 and June 2" + " 1821", "May 25-26" + " 1777").
  if (cur.trim() !== '' && YEAR.test(nxt) && !/,\s*\d{4}\s*$/.test(cur)) {
    const merged = cur.trim() + ',' + nxt;
    f.splice(IDX.issue_date, 2, merged);
    while (f.length < N) f.push('');
    shifted++;
  } else {
    clean++;
  }
  while (f.length < N) f.push('');
  // 24 coverage-ledger rows carry a stray "col_5:" marker field that shifts
  // every later column. Remove it and re-pad.
  while (f.includes('col_5:')) f.splice(f.indexOf('col_5:'), 1);
  while (f.length < N) f.push('');
  rows.push(f);
}

function quote(v) {
  v = v == null ? '' : String(v);
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

fs.writeFileSync(P, [header.map(quote).join(',')].concat(rows.map(r => r.map(quote).join(','))).join('\n') + '\n');

// ---------- verify ----------
const check = fs.readFileSync(P, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
let badCount = 0, badUrl = 0, badDate = 0, badStatus = 0;
const statuses = {};
for (let i = 1; i < check.length; i++) {
  const f = parseCsvLine(check[i]);
  if (f.length !== N) { badCount++; continue; }
  if (!/^https?:\/\//.test(f[IDX.original_url_exact] || '')) badUrl++;
  if (!/^[A-Za-z]{3,9}\.?\s+\d{1,2},\s*\d{4}$/.test((f[IDX.issue_date] || '').trim())) badDate++;
  const s = f[IDX.acquisition_status] || '';
  statuses[s] = (statuses[s] || 0) + 1;
  if (!s) badStatus++;
}
console.log('rows:', rows.length, '| repaired (date merge):', shifted, '| already clean:', clean);
console.log('bad field counts:', badCount, '| non-URL original_url_exact:', badUrl, '| malformed issue_date:', badDate);
console.log('acquisition_status distribution:', JSON.stringify(statuses));
