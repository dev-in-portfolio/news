// Inventory article-level URL grammars across all cited URLs and check coverage.
// Article-level means the URL names a specific article/clipping, not just a page.
// Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');

const norm = u => String(u || '').replace(/&amp;/g, '&').trim();
const host = u => { try { return new URL(norm(u)).hostname.replace(/^www\./, ''); } catch (e) { return '?'; } };

const GRAMMARS = [
  { name: 'veridian d=…N.M (N>=2)', re: /[?&]d=[^.&]+\.(\d+)\.(\d+)/, article: m => Number(m[1]) >= 2 },
  { name: 'paperspast article id', re: /paperspast\.natlib\.govt\.nz\/newspapers\/([A-Za-z]+\d{8}\.\d+\.\d+)/, article: () => true },
  { name: 'newspapers.com /article/', re: /newspapers\.com\/article\/([^/?#]+)/, article: () => true },
  { name: 'NLI /article/', re: /nli\.org\.il\/[^?#]*\/article\/(\d+\.\d+)/, article: () => true },
  { name: 'NewspaperSG digitised/article', re: /eresources\.nlb\.gov\.sg\/newspapers\/digitised\/article\/([^/?#]+)/, article: () => true },
  { name: 'rarenewspapers item', re: /rarenewspapers\.com\/([^/?#]+)/, article: () => true },
  { name: 'newspaperarchive item', re: /newspaperarchive\.com\/([^/?#]+)/, article: () => true },
  { name: 'virginiachronicle article', re: /virginiachronicle\.com\/[^?#]*\?a=d&d=([^&]+)/, article: () => true },
];

for (const g of GRAMMARS) {
  const cited = new Map(); // key -> Set(hn)
  for (const [hn, list] of Object.entries(urls)) {
    for (const raw of list || []) {
      const u = norm(raw);
      const m = u.match(g.re);
      if (!m || !g.article(m)) continue;
      const key = m[1];
      if (!cited.has(key)) cited.set(key, new Set());
      cited.get(key).add(hn);
    }
  }
  let covered = 0, uncovered = 0;
  const miss = [];
  for (const [key, hns] of cited) {
    let ok = false;
    for (const hn of hns) {
      for (const i of images[hn] || []) {
        const hay = [i.page_url, i.clip_url, i.source_url, i.crop, i.full_page].filter(Boolean).map(norm).join(' ');
        if (hay.includes(key)) { ok = true; break; }
      }
      if (ok) break;
    }
    if (ok) covered++; else { uncovered++; miss.push([[...hns][0], key]); }
  }
  console.log(`\n=== ${g.name}: cited=${cited.size} covered=${covered} uncovered=${uncovered}`);
  for (const [hn, key] of miss.slice(0, 25)) console.log('  ' + hn + '  ' + key);
}
