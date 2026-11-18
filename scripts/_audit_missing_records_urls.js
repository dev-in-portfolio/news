// For every record with no stored image, list its cited URLs and flag any that
// point at a known historical-newspaper archive (as opposed to a modern web article).
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/news';

function readJson(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }

const urls = readJson(path.join(ROOT, 'scripts', 'hn_urls.json'));
const images = readJson(path.join(ROOT, 'site', 'data', 'images.json'));
const records = readJson(path.join(ROOT, 'site', 'data', 'records.json'));
const recArr = Array.isArray(records) ? records : (records.records || Object.values(records));

const ARCHIVE_HOSTS = [
  'newspapers.library.in.gov', 'oregonnews.uoregon.edu', 'loc.gov', 'chroniclingamerica.loc.gov',
  'paperspast.natlib.govt.nz', 'nli.org.il', 'eresources.nlb.gov.sg', 'historicnewspapers.sc.edu',
  'texashistory.unt.edu', 'gateway.okhistory.org', 'cdnc.ucr.edu', 'news.hrvh.org',
  'newspaper.library.tamu.edu', 'gahistoricnewspapers.galileo.usg.edu', 'newspapers.lib.utah.edu',
  'newspapers.swco.ttu.edu', 'ohiomemory.org', 'bplonline.contentdm.oclc.org', 'archive.org',
  'trove.nla.gov.au', 'paperspast', 'nyshistoricnewspapers.org', 'digitalnc.org',
  'idnc.library.illinois.edu', 'newspapers.com', 'britishnewspaperarchive.co.uk',
  'newspaperarchive.com', 'rarenewspapers.com', 'genealogybank.com', 'newspapers.digitalnc.org',
  'utahdigitalnewspapers.org', 'coloradohistoricnewspapers.org', 'digital.denverlibrary.org',
];

const missing = recArr.filter(r => !images[r.hn_id]);
console.log('records without image: ' + missing.length);
let flagged = 0;
for (const r of missing) {
  const list = urls[r.hn_id] || [];
  const hits = list.filter(u => ARCHIVE_HOSTS.some(h => u.includes(h)));
  if (!hits.length) continue;
  flagged++;
  console.log('\n### ' + r.hn_id + '  ' + (r.date || '') + '  ' + (r.heading || '').slice(0, 70));
  for (const u of list) console.log('   ' + (hits.includes(u) ? '*' : ' ') + ' ' + u);
}
console.log('\nrecords with an archive-host citation: ' + flagged);
