// For every Indiana mosaic-ledger entry marked page_unavailable, show its URL
// level (page 1.x vs article 2.x+) and the matching article-clip ledger status.
// Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const mos = (rj(ROOT + '/docs/INDIANA_MOSAIC_LEDGER.json').items) || {};
const clip = (rj(ROOT + '/docs/INDIANA_IMAGE_ACQUISITION_LEDGER.json').items) || {};

const un = Object.entries(mos).filter(([, v]) => v.status === 'page_unavailable');
const levels = { page: 0, article: 0 };
const clipStatus = {};
const noClip = [];
for (const [k, v] of un) {
  const m = String(v.page_url).match(/d=([^.]+)\.(\d+)\.(\d+)/);
  const lvl = m && Number(m[2]) >= 2 ? 'article' : 'page';
  levels[lvl]++;
  const c = clip[k];
  const s = c ? c.status : '(no clip entry)';
  clipStatus[s] = (clipStatus[s] || 0) + 1;
  if (!c || c.status !== 'article_clip_acquired') noClip.push([v.hn_id, v.page_url, s]);
}
console.log('page_unavailable entries: ' + un.length);
console.log('levels: ' + JSON.stringify(levels));
console.log('matching clip-ledger statuses: ' + JSON.stringify(clipStatus));
console.log('\nentries with no acquired clip: ' + noClip.length);
for (const r of noClip.slice(0, 40)) console.log('  ' + r.join('  '));
