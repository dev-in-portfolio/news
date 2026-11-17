// Reliable coverage checks (avoids shell-escaping pitfalls).
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');
const records = rj(ROOT + '/site/data/records.json');
const recArr = Array.isArray(records) ? records : Object.values(records);
const byId = Object.fromEntries(recArr.map(r => [r.hn_id, r]));

function allUrls(hn) { return (urls[hn] || []).map(u => String(u).replace(/&amp;/g, '&')); }

// 1) Papers Past coverage against the ledger.
const ppLedger = rj(ROOT + '/docs/PAPERSPAST_IMAGE_ACQUISITION_LEDGER.json');
const ppKeys = new Set(Object.keys(ppLedger.items));
let ppTotal = 0, ppMiss = [];
for (const [hn, list] of Object.entries(urls)) {
  for (const raw of list || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    if (!u.includes('paperspast.natlib.govt.nz')) continue;
    ppTotal++;
    if (!ppKeys.has(hn + '|' + u)) ppMiss.push({ hn, u });
  }
}
console.log('PAPERS PAST: urls=' + ppTotal + '  ledger entries=' + ppKeys.size + '  not-in-ledger=' + ppMiss.length);
for (const x of ppMiss) console.log('   MISSING ' + x.hn + '  ' + x.u);

// 2) NewspaperSG records.
const nlb = [];
for (const [hn, list] of Object.entries(urls)) {
  for (const raw of list || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    if (u.includes('eresources.nlb.gov.sg')) nlb.push({ hn, u, imgs: (images[hn] || []).length });
  }
}
console.log('\nNEWSPAPERSG: urls=' + nlb.length);
for (const x of nlb) console.log('   ' + x.hn + ' imgs=' + x.imgs + '  ' + x.u.slice(0, 120));

// 3) Gap records: every cited URL, flag historical-archive hosts.
const HIST = [
  'newspapers.library.in.gov', 'oregonnews.uoregon.edu', 'paperspast.natlib.govt.nz',
  'loc.gov/resource', 'loc.gov/item', 'chroniclingamerica.loc.gov', 'tile.loc.gov',
  'historicnewspapers.sc.edu', 'texashistory.unt.edu', 'gateway.okhistory.org',
  'newspapers.swco.ttu.edu', 'newspapers.lib.utah.edu', 'nli.org.il',
  'gahistoricnewspapers.galileo.usg.edu', 'coloradovirtuallibrary.org',
  'newspaper.library.tamu.edu', 'digital.library.unt.edu', 'floridamemory.com',
  'ufdc.ufl.edu', 'dlg.usg.edu', 'ohiomemory', 'cdnc.ucr.edu',
  'virginiachronicle.com', 'news.hrvh.org', 'nyshistoricnewspapers.org',
  'archives.novascotia.ca', 'okellyarchive.com', 'presse.wien.gv.at',
];
const gaps = recArr.filter(r => !(images[r.hn_id] || []).length);
console.log('\nGAP RECORDS: ' + gaps.length);
let histGaps = 0;
for (const r of gaps) {
  const hits = allUrls(r.hn_id).filter(u => HIST.some(h => u.includes(h)));
  if (hits.length) {
    histGaps++;
    console.log('   ' + r.hn_id + '  ' + (r.heading || '').slice(0, 60));
    for (const h of hits) console.log('       ' + h);
  }
}
console.log('gap records citing a historical newspaper archive: ' + histGaps);

// 4) NLI coverage.
const nli = [];
for (const [hn, list] of Object.entries(urls)) {
  for (const raw of list || []) {
    const u = String(raw).replace(/&amp;/g, '&');
    if (u.includes('nli.org.il') && /\/article\/\d+\.\d+/.test(u)) nli.push({ hn, u });
  }
}
console.log('\nNLI ARTICLE URLs: ' + nli.length);
for (const x of nli) {
  const has = (images[x.hn] || []).some(i => String(i.page_url || '').includes(x.u));
  console.log('   ' + x.hn + '  covered=' + has + '  ' + x.u);
}
