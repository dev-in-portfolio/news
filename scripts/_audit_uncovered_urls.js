// List cited URLs that have no stored image, grouped by host, with the record's
// stored image count. Used to find remaining obtainable article scans.
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/news';

function readJson(p) {
  let s = fs.readFileSync(p, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return JSON.parse(s);
}
function norm(u) { return String(u || '').replace(/&amp;/g, '&').split('#')[0].replace(/\/$/, ''); }

const urls = readJson(path.join(ROOT, 'scripts', 'hn_urls.json'));
const images = readJson(path.join(ROOT, 'site', 'data', 'images.json'));
const records = readJson(path.join(ROOT, 'site', 'data', 'records.json'));
const recArr = Array.isArray(records) ? records : (records.records || Object.values(records));
const byHn = {};
for (const r of recArr) byHn[r.hn_id] = r;

const uncovered = [];
for (const [hn, list] of Object.entries(urls)) {
  const stored = new Set();
  for (const i of images[hn] || []) stored.add(norm(i.page_url));
  for (const raw of list) {
    const u = norm(raw);
    if (!u) continue;
    if (stored.has(u)) continue;
    let host = '';
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { host = 'invalid'; }
    uncovered.push({ hn, host, url: u, stored: (images[hn] || []).length });
  }
}

const hosts = {};
for (const x of uncovered) (hosts[x.host] = hosts[x.host] || []).push(x);

const want = process.argv.slice(2);
const keys = want.length ? want : Object.keys(hosts).sort();
for (const h of keys) {
  if (!hosts[h]) continue;
  console.log('\n######## ' + h + '  (' + hosts[h].length + ' uncovered urls, ' + new Set(hosts[h].map(x => x.hn)).size + ' records)');
  for (const x of hosts[h]) {
    const r = byHn[x.hn] || {};
    console.log('  ' + x.hn + '  stored=' + x.stored + '  ' + (r.date || '') + '  ' + (r.heading || '').slice(0, 60));
    console.log('     ' + x.url);
  }
}
