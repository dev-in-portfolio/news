// Summarise every acquisition ledger by status and list any failed / retryable
// entries. Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news/docs';
const files = fs.readdirSync(ROOT).filter(f => /LEDGER\.json$/i.test(f));
for (const f of files) {
  let j;
  try { j = rj(ROOT + '/' + f); } catch (e) { continue; }
  const items = j.items || j;
  const entries = Object.entries(items);
  const st = {};
  for (const [, v] of entries) { const s = (v && v.status) || '(none)'; st[s] = (st[s] || 0) + 1; }
  console.log('\n=== ' + f + '  entries=' + entries.length);
  for (const [s, n] of Object.entries(st).sort((a, b) => b[1] - a[1])) console.log('   ' + String(n).padStart(4) + '  ' + s);
  const failed = entries.filter(([, v]) => v && /fail|error|pending/i.test(v.status || ''));
  if (failed.length) {
    console.log('   --- failed/pending sample ---');
    for (const [k, v] of failed.slice(0, 12)) console.log('     ' + k + '  ' + (v.error || v.reason || ''));
  }
}
