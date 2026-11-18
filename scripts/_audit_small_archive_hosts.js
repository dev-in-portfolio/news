// Show every cited URL for the small archive-like hosts that still have a record
// without a rendition from that host. Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');
const recs = rj(ROOT + '/site/data/records.json');
const arr = Array.isArray(recs) ? recs : Object.values(recs);
const by = Object.fromEntries(arr.map(r => [r.hn_id, r]));

const norm = u => String(u || '').replace(/&amp;/g, '&').trim();
const host = u => { try { return new URL(norm(u)).hostname.replace(/^www\./, ''); } catch (e) { return '?'; } };

const WANT = ['jta.org', 'newspapers.swco.ttu.edu', 'eresources.nlb.gov.sg', 'historyworm.com',
  'news.hrvh.org', 'chroniclingamerica.loc.gov', 'newspapers.lib.utah.edu',
  'gahistoricnewspapers.galileo.usg.edu', 'cdnc.ucr.edu', 'vermonthistory.org',
  'scvhistory.com', 'snewspapers.com', 'historicnewspapers.sc.edu', 'archive.spectator.co.uk',
  'newspaper.library.tamu.edu', 'genealogybank.com'];

for (const w of WANT) {
  const hits = [];
  for (const [hn, list] of Object.entries(urls)) {
    const cited = (list || []).filter(u => host(u) === w);
    if (!cited.length) continue;
    const imaged = (images[hn] || []).some(i => host(i.page_url) === w);
    if (imaged) continue;
    hits.push({ hn, cited });
  }
  if (!hits.length) continue;
  console.log('\n######## ' + w + '  (' + hits.length + ' unimaged records)');
  for (const h of hits) {
    const r = by[h.hn] || {};
    console.log('  ' + h.hn + '  ' + (r.date || '') + '  ' + String(r.heading || '').slice(0, 70));
    console.log('    primary: ' + (r.url || ''));
    console.log('    stored:  ' + (images[h.hn] || []).map(i => i.provider + ' | ' + i.page_url).join('\n             '));
    for (const u of h.cited.slice(0, 4)) console.log('    cited:   ' + u);
  }
}
