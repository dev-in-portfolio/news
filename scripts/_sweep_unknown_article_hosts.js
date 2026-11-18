// Look for article-level-looking URLs on hosts not covered by the known
// article grammars, so no obtainable clip is missed.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');

// Hosts already handled for article-level acquisition.
const HANDLED = [
  'newspapers.library.in.gov', 'oregonnews.uoregon.edu', 'paperspast.natlib.govt.nz',
  'nli.org.il', 'eresources.nlb.gov.sg', 'trove.nla.gov.au', 'newspapers.com',
  'virginiachronicle.com', 'news.hrvh.org', 'cdnc.ucr.edu',
  'loc.gov', 'chroniclingamerica.loc.gov', 'gateway.okhistory.org',
  'texashistory.unt.edu', 'historicnewspapers.sc.edu',
];

// Heuristic: URL has a path/query segment that suggests a single article.
const ARTICLE_HINTS = [
  /\/article\//i, /\/articles\//i, /[?&]articleid=/i, /[?&]article_id=/i,
  /[?&]artid=/i, /[?&]aid=/i, /\/story\//i, /\/news\/[^/]+\/?$/i,
  /[?&]id=\d+/, /\/\d{4}\/\d{2}\/\d{2}\//, /\/content\//i,
];

const rows = [];
for (const [hn, list] of Object.entries(urls)) {
  for (const raw of list || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    let host;
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { continue; }
    if (HANDLED.some(h => host === h || host.endsWith('.' + h))) continue;
    const hits = ARTICLE_HINTS.filter(re => re.test(u));
    if (hits.length) rows.push({ hn, host, u });
  }
}

const byHost = new Map();
for (const r of rows) {
  if (!byHost.has(r.host)) byHost.set(r.host, []);
  byHost.get(r.host).push(r);
}
console.log('UNHANDLED HOSTS WITH ARTICLE-LIKE URLS: ' + byHost.size);
for (const [host, list] of [...byHost.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n## ${host} (${list.length})  records: ${[...new Set(list.map(x => x.hn))].slice(0, 6).join(', ')}`);
  for (const r of list.slice(0, 4)) console.log('   ' + r.hn + '  ' + r.u.slice(0, 160));
}
