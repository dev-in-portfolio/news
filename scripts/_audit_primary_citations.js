// Does each record's PRIMARY cited url have a stored rendition for that record?
// Catches cases where the record's own cited source is missing and the only
// stored image is a different newspaper. Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const images = rj(ROOT + '/site/data/images.json');
const records = rj(ROOT + '/site/data/records.json');
const recArr = Array.isArray(records) ? records : Object.values(records);

const norm = u => String(u || '').replace(/&amp;/g, '&').trim().replace(/\/+$/, '');

// A stable "citation identity" per archive so trivial URL differences still match.
function identity(u) {
  u = norm(u);
  let m = u.match(/newspapers\.library\.in\.gov\/\?a=d&d=([^&]+)/);
  if (m) return 'in:' + m[1];
  m = u.match(/oregonnews\.uoregon\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)/);
  if (m) return 'or:' + m[1] + '/' + m[2] + '/' + m[3] + '/' + m[4];
  m = u.match(/loc\.gov\/resource\/([^/?#]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/\?sp=(\d+)/);
  if (m) return 'loc:' + m[1] + '/' + m[2] + '/' + m[3] + '/' + m[4];
  m = u.match(/gateway\.okhistory\.org\/explore\/collection\/([^/?#]+)\/order-(\d+)/);
  if (m) return 'ok:' + m[1] + '/' + m[2];
  m = u.match(/texashistory\.unt\.edu\/ark:\/(\d+)\/m(\d+)\/?(?:seq-(\d+))?/);
  if (m) return 'tx:' + m[1] + '/' + m[2] + '/' + (m[3] || '');
  m = u.match(/historicnewspapers\.sc\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)/);
  if (m) return 'sc:' + m[1] + '/' + m[2] + '/' + m[3] + '/' + m[4];
  m = u.match(/paperspast\.natlib\.govt\.nz\/newspapers\/([A-Za-z]+\d{8}\.\d+\.\d+)/);
  if (m) return 'pp:' + m[1];
  m = u.match(/nli\.org\.il\/[^?#]*\/article\/(\d+\.\d+)/);
  if (m) return 'nli:' + m[1];
  m = u.match(/eresources\.nlb\.gov\.sg\/newspapers\/digitised\/article\/([^/?#]+)/);
  if (m) return 'sg:' + m[1];
  m = u.match(/newspapers\.com\/article\/([^/?#]+)/);
  if (m) return 'nc:' + m[1];
  return 'raw:' + u;
}

const rows = [];
for (const r of recArr) {
  const primary = norm(r.url);
  if (!primary) { rows.push({ hn: r.hn_id, host: '(none)', covered: false, note: 'no url' }); continue; }
  let host = '?';
  try { host = new URL(primary).hostname.replace(/^www\./, ''); } catch (e) {}
  const want = identity(primary);
  const list = images[r.hn_id] || [];
  let covered = false;
  for (const i of list) {
    const cands = [i.page_url, i.clip_url, i.source_url, i.crop, i.full_page].filter(Boolean).map(identity);
    if (cands.includes(want)) { covered = true; break; }
    // asset filename often encodes the doc id
    if (i.crop && want.startsWith('in:') && String(i.crop).includes(want.slice(3).replace(/\./g, '-'))) { covered = true; break; }
  }
  rows.push({ hn: r.hn_id, host, covered, primary, heading: (r.heading || '').slice(0, 60) });
}

const uncovered = rows.filter(r => !r.covered);
console.log('records: ' + rows.length + '  primary covered: ' + (rows.length - uncovered.length) + '  uncovered: ' + uncovered.length);
const byHost = {};
for (const r of uncovered) byHost[r.host] = (byHost[r.host] || 0) + 1;
console.log('\nuncovered primary by host:');
for (const [h, n] of Object.entries(byHost).sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + h);

console.log('\n--- archive-host primaries uncovered (first 60) ---');
const ARCH = /(newspapers\.library\.in\.gov|oregonnews\.uoregon|loc\.gov|gateway\.okhistory|texashistory\.unt|historicnewspapers\.sc|paperspast|nli\.org\.il|eresources\.nlb|newspapers\.com|bl\.iro)/i;
let n = 0;
for (const r of uncovered) {
  if (!ARCH.test(r.host)) continue;
  if (n++ >= 60) break;
  console.log(`  ${r.hn}  ${r.host}  ${r.primary}`);
}
