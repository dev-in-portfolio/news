// Systematic cited-URL -> acquired-asset audit for the newspaper-archive providers.
// For each provider grammar, list distinct cited URLs and whether at least one
// record has a stored rendition whose source page_url matches that citation.
// Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');
const records = rj(ROOT + '/site/data/records.json');
const recArr = Array.isArray(records) ? records : Object.values(records);
const recById = Object.fromEntries(recArr.map(r => [r.hn_id, r]));

const norm = u => String(u).replace(/&amp;/g, '&').trim();

// Build the set of acquired source URLs per record.
function acquiredUrls(hn) {
  const out = new Set();
  for (const i of images[hn] || []) {
    for (const f of ['page_url', 'clip_url', 'source_url']) {
      if (i[f]) out.add(norm(i[f]).replace(/\/+$/, ''));
    }
  }
  return out;
}

const PROVIDERS = [
  { name: 'Indiana', re: /newspapers\.library\.in\.gov\/\?a=d&d=([A-Za-z0-9]+)\.(\d+)\.(\d+)/, key: m => m[1] + '.' + m[2] + '.' + m[3] },
  { name: 'Oregon', re: /oregonnews\.uoregon\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)/, key: m => m[1] + '/' + m[2] + '/ed-' + m[3] + '/seq-' + m[4] },
  { name: 'LOC', re: /(?:loc\.gov|chroniclingamerica\.loc\.gov)\/(?:resource|newspapers)\/([^/?#]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/?(?:seq-(\d+))?/, key: m => m[1] + '/' + m[2] + '/ed-' + m[3] + (m[4] ? '/seq-' + m[4] : '') },
  { name: 'Oklahoma', re: /gateway\.okhistory\.org\/explore\/collection\/([^/?#]+)\/order-(\d+)/, key: m => m[1] + '/order-' + m[2] },
  { name: 'Texas', re: /texashistory\.unt\.edu\/ark:\/(\d+)\/m(\d+)\/?(?:seq-(\d+))?/, key: m => 'ark:/' + m[1] + '/m' + m[2] + (m[3] ? '/seq-' + m[3] : '') },
  { name: 'SouthCarolina', re: /historicnewspapers\.sc\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)/, key: m => m[1] + '/' + m[2] + '/ed-' + m[3] + '/seq-' + m[4] },
  { name: 'PapersPast', re: /paperspast\.natlib\.govt\.nz\/newspapers\/([A-Za-z]+\d{8}\.\d+\.\d+)/, key: m => m[1] },
  { name: 'NLI', re: /nli\.org\.il\/[^?#]*\/article\/(\d+\.\d+)/, key: m => 'article/' + m[1] },
  { name: 'NewspaperSG', re: /eresources\.nlb\.gov\.sg\/newspapers\/digitised\/article\/([^/?#]+)/, key: m => m[1] },
];

for (const p of PROVIDERS) {
  const cited = new Map(); // key -> Set(hn)
  for (const [hn, list] of Object.entries(urls)) {
    for (const raw of list || []) {
      const u = norm(raw);
      const m = u.match(p.re);
      if (!m) continue;
      const k = p.key(m);
      if (!cited.has(k)) cited.set(k, new Set());
      cited.get(k).add(hn);
    }
  }
  const uncovered = [];
  for (const [k, hns] of cited) {
    let covered = false;
    for (const hn of hns) {
      const a = acquiredUrls(hn);
      // fuzzy: any acquired URL contains the key fragments
      for (const au of a) {
        if (au.includes(k) || au.replace(/[^a-z0-9]+/gi, '').includes(k.replace(/[^a-z0-9]+/gi, ''))) { covered = true; break; }
      }
      if (covered) break;
    }
    if (!covered) uncovered.push({ key: k, hns: [...hns] });
  }
  console.log(`\n=== ${p.name}: distinct cited=${cited.size}  uncovered=${uncovered.length}`);
  for (const u of uncovered.slice(0, 40)) {
    const hn = u.hns[0];
    console.log(`  ${u.hns.join(',')}  ${u.key}  ${(recById[hn] || {}).date || ''}  ${((recById[hn] || {}).heading || '').slice(0, 50)}`);
  }
}
