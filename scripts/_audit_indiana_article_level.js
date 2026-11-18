// For every article-level Indiana citation (d=<doc>.<n>.<m> with n>=2), classify
// how it is currently covered: native clip, page mosaic, cross-reference, or none.
// Reveals any article-level citation that only has a page scan and could still be
// clipped. Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');
const clipLedger = (rj(ROOT + '/docs/INDIANA_IMAGE_ACQUISITION_LEDGER.json').items) || {};
const RE = /newspapers\.library\.in\.gov\/\?a=d&d=([A-Za-z0-9]+)\.(\d+)\.(\d+)/;

const seen = new Set();
const rows = [];
for (const [hn, list] of Object.entries(urls)) {
  for (const raw of list || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    const m = u.match(RE);
    if (!m) continue;
    if (Number(m[2]) < 2) continue;
    const key = m[1] + '.' + m[2] + '.' + m[3];
    if (seen.has(hn + '|' + key)) continue;
    seen.add(hn + '|' + key);
    const l = images[hn] || [];
    const cropHit = l.find(i => i.crop && String(i.page_url || '').replace(/&amp;/g, '&').includes(key));
    const pageHit = l.find(i => !i.crop && String(i.page_url || '').replace(/&amp;/g, '&').includes(key));
    const clip = clipLedger[hn + '|' + u] || Object.values(clipLedger).find(e => e.hn_id === hn && String(e.page_url || '').includes(key));
    rows.push({
      hn, key,
      kind: cropHit ? 'clip' : (pageHit ? 'page_only' : 'none'),
      clipStatus: clip ? clip.status : null,
      clipMethod: cropHit ? (cropHit.crop_method || cropHit.mosaic_method || '') : (clip ? (clip.crop_method || '') : ''),
      additional: cropHit ? !!cropHit.additional_cited_article : false,
    });
  }
}
const by = {};
for (const r of rows) by[r.kind] = (by[r.kind] || 0) + 1;
console.log('article-level Indiana citations: ' + rows.length + '  ' + JSON.stringify(by));
const pageOnly = rows.filter(r => r.kind === 'page_only');
console.log('\ncovered only by a page scan (' + pageOnly.length + '):');
for (const r of pageOnly) console.log('  ' + r.hn + '  ' + r.key + '  clipStatus=' + r.clipStatus);
const none = rows.filter(r => r.kind === 'none');
console.log('\nuncovered (' + none.length + '):');
for (const r of none) console.log('  ' + r.hn + '  ' + r.key + '  clipStatus=' + r.clipStatus);
