// Build HN -> [urls] map from batch report markdown files, then report coverage
// against providers we can actually fetch.
const fs = require('fs');
const path = require('path');

const OLD = 'D:/news/old stuff';
const files = fs.readdirSync(OLD).filter(f => /^Historical_Newspaper_Event_Research_.*\.md$/.test(f));

const map = {}; // hn -> [{url, paper, date, headline}]
let current = null;

for (const f of files) {
  const lines = fs.readFileSync(path.join(OLD, f), 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const h = line.match(/^###\s+(HN-\d{3,4})\b/);
    if (h) { current = h[1]; if (!map[current]) map[current] = []; continue; }
    if (/^##\s/.test(line)) { current = null; continue; }
    if (!current) continue;
    const urls = line.match(/https?:\/\/[^\s)\]"']+/g);
    if (!urls) continue;
    const paperM = line.match(/\*([^*]+)\*/);
    const dateM = line.match(/\*\*([^*]+)\*\*/);
    const headM = line.match(/[\u201c"]([^\u201d"]{4,180})[\u201d"]/);
    for (let u of urls) {
      u = u.replace(/[.,;]+$/, '');
      map[current].push(u);
      map[current]._meta = map[current]._meta || {};
      map[current]._meta[u] = {
        paper: paperM ? paperM[1].trim() : '',
        date: dateM ? dateM[1].trim() : '',
        headline: headM ? headM[1].trim() : '',
      };
    }
  }
}

// Separate metadata from the url list for clean serialisation
const urlMap = {};
const metaMap = {};
for (const k of Object.keys(map)) {
  urlMap[k] = map[k].filter(x => typeof x === 'string');
  metaMap[k] = map[k]._meta || {};
}
fs.writeFileSync('D:/news/scripts/hn_url_meta.json', JSON.stringify(metaMap));
console.log('wrote scripts/hn_url_meta.json');


const hnCount = Object.keys(urlMap).length;
const allUrls = new Set();
for (const k of Object.keys(urlMap)) urlMap[k].forEach(u => allUrls.add(u));

function prov(u) {
  if (/oregonnews\.uoregon\.edu/.test(u)) return 'oregon';
  if (/paperspast\.natlib\.govt\.nz/.test(u)) return 'paperspast';
  if (/loc\.gov/.test(u)) return 'loc';
  if (/newspapers\.library\.in\.gov/.test(u)) return 'indiana';
  if (/gateway\.okhistory\.org/.test(u)) return 'oklahoma';
  if (/gahistoricnewspapers/.test(u)) return 'georgia';
  return 'other';
}

const byProv = {};
for (const u of allUrls) byProv[prov(u)] = (byProv[prov(u)] || 0) + 1;

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
const recs = readJson('D:/news/docs/reconciliation_ledger.json');
const recArr = Array.isArray(recs) ? recs : (recs.records || Object.values(recs));

console.log('batch files:', files.length);
console.log('HN ids found in batch reports:', hnCount);
console.log('unique URLs:', allUrls.size);
console.log('by provider:', JSON.stringify(byProv));

const curated = recArr.filter(r => r.curated_class || r.reconciliation_category === 'curated_flag');
console.log('\ncurated records:', curated.length);

const curatedWithOregon = curated.filter(r => (urlMap[r.hn_id] || []).some(u => prov(u) === 'oregon'));
console.log('curated records with >=1 Oregon URL:', curatedWithOregon.length);
console.log(curatedWithOregon.map(r => r.hn_id + '(' + r.curated_class + ')').join(' '));

const allWithOregon = Object.keys(urlMap).filter(h => urlMap[h].some(u => prov(u) === 'oregon'));
console.log('\nALL records with >=1 Oregon URL:', allWithOregon.length);

fs.writeFileSync('D:/news/scripts/hn_urls.json', JSON.stringify(urlMap, null, 0));
console.log('\nwrote scripts/hn_urls.json');
