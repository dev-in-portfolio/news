// Update SOURCE_ACQUISITION_MANIFEST.csv with Guardian test results
const fs = require('fs');
const path = require('path');

const MANIFEST = 'D:/news/docs/SOURCE_ACQUISITION_MANIFEST.csv';
const now = new Date().toISOString();

// Read manifest
const text = fs.readFileSync(MANIFEST, 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);
const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  const row = {};
  header.forEach((h, j) => { row[h] = (cols[j] || '').replace(/"/g, ''); });
  rows.push(row);
}

// Guardian URLs that loaded successfully (from the fetch test)
const guardianSuccess = [
  'https://www.theguardian.com/news/2026/oct/19/hurricane-trudy-mexico-pacific-coast-greece-floods',
  'https://www.theguardian.com/theguardian/2012/mar/01/archive-second-battle-wounded-knee-1973',
  'https://www.theguardian.com/world/1981/may/14/catholicism.religion1',
  'https://www.theguardian.com/world/2014/sep/13/ferguson-video-shows-michael-brown-hands-raised',
  'https://www.theguardian.com/world/2000/nov/10/uselections2000.usa9',
  'https://www.theguardian.com/world/2008/dec/12/cholera-mugabe-zimbabwe-disease',
  'https://www.theguardian.com/world/2014/sep/23/us-launches-air-strikes-against-isis-targets-in-syria',
  'https://www.theguardian.com/uk-news/2026/oct/21/mystery-roman-sarcophagus-westminster-abbey-solved-at-last-expert-says',
  'https://www.theguardian.com/world/2002/nov/18/iraq',
  'https://www.theguardian.com/us-news/2015/mar/31/indiana-religious-anti-gay-law-governor-mike-pence',
  'https://www.theguardian.com/world/2026/oct/22/iran-threatens-seven-gulf-countries-us-israel-renew-attacks',
  'https://www.theguardian.com/environment/2016/jan/16/flints-water-crisis-what-went-wrong',
  'https://www.theguardian.com/world/2005/jan/19/indonesia.tsunami2004',
  'https://www.theguardian.com/environment/cif-green/2010/aug/25/un-nigeria-oil-spill-shell',
  'https://www.theguardian.com/world/2014/mar/18/crimea-putin-condemns-western-hypocrisy-annexation',
  'https://www.theguardian.com/world/1994/jul/25/rwanda.chrismcgreal',
  'https://www.theguardian.com/world/1999/sep/05/indonesia.easttimor1',
  'https://www.theguardian.com/theguardian/1966/oct/22/fromthearchive',
  'https://www.theguardian.com/world/2003/mar/28/iraq.politics',
  'https://www.theguardian.com/world/2000/apr/20/cuba.usa'
];

let updated = 0;
rows.forEach(r => {
  if (guardianSuccess.includes(r.original_url_exact)) {
    r.acquisition_status = 'source_identity_verified';
    r.source_identity_verified = 'true';
    r.last_checked_at = now;
    r.failure_reason = '';
    r.next_action = 'Cite and link to publisher; modern copyrighted article - do not republish full text without permission';
    updated++;
  }
});

console.log('Updated', updated, 'rows');

// Write back
const outLines = [header.join(',')];
rows.forEach(r => {
  outLines.push(header.map(h => {
    let v = r[h] || '';
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      v = '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }).join(','));
});
fs.writeFileSync(MANIFEST, outLines.join('\n') + '\n');
console.log('Manifest written. Total rows:', rows.length);

// Now compute stats
const statuses = {};
rows.forEach(r => { statuses[r.acquisition_status] = (statuses[r.acquisition_status] || 0) + 1; });
console.log('\nAcquisition status breakdown:');
Object.entries(statuses).sort((a,b) => b[1]-a[1]).forEach(([s, c]) => {
  console.log(`  ${s}: ${c}`);
});

const providers = {};
rows.forEach(r => { providers[r.provider] = (providers[r.provider] || 0) + 1; });
console.log('\nProvider breakdown:');
Object.entries(providers).sort((a,b) => b[1]-a[1]).forEach(([p, c]) => {
  console.log(`  ${p}: ${c}`);
});
