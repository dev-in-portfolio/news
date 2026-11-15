// Augment scripts/hn_urls.json with every URL that appears in the canonical
// record text (discovery_body, audit_links, recorded_finding).
//
// The original map was built only from `### HN-...` blocks in the batch report
// markdown, which left 355 records with an empty URL list even though their
// canonical record text cites a source. This script unions the two sources so
// the acquisition pipelines and the gap report see the same URL set.
//
// It never removes a URL and never rewrites one: existing entries keep their
// order, and new URLs are appended in the order they appear in the record.
//
// Usage: node scripts/augment_hn_urls.js [--dry]
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/news';
const MAP_PATH = path.join(ROOT, 'scripts', 'hn_urls.json');
const DRY = process.argv.includes('--dry');

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

function extractUrls(text) {
  const out = [];
  const re = /https?:\/\/[^\s)\]"'<>]+/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    out.push(m[0].replace(/[.,;]+$/, ''));
  }
  return out;
}

const records = readJson(path.join(ROOT, 'site', 'data', 'records.json'));
const arr = Array.isArray(records) ? records : (records.records || Object.values(records));
const map = readJson(MAP_PATH);

let added = 0, recsAdded = 0, emptyBefore = 0;
for (const r of arr) {
  const existing = map[r.hn_id] || [];
  if (!existing.length) emptyBefore++;
  const seen = new Set(existing);
  const candidates = [
    ...extractUrls(r.discovery_body),
    ...extractUrls(r.audit_links),
    ...extractUrls(r.recorded_finding),
  ];
  let touched = false;
  for (const u of candidates) {
    if (seen.has(u)) continue;
    seen.add(u);
    existing.push(u);
    added++;
    touched = true;
  }
  if (touched) recsAdded++;
  map[r.hn_id] = existing;
}

// Drop records that ended up with no URLs at all, to keep the file compact.
const out = {};
for (const k of Object.keys(map).sort()) {
  if (map[k] && map[k].length) out[k] = map[k];
}

const totalUrls = new Set(Object.values(out).flat()).size;
console.log(`records in map: ${Object.keys(out).length}`);
console.log(`records with empty list before: ${emptyBefore}`);
console.log(`URLs added: ${added} across ${recsAdded} records`);
console.log(`unique URLs now: ${totalUrls}`);

if (DRY) { console.log('(dry run, not written)'); process.exit(0); }
fs.writeFileSync(MAP_PATH, JSON.stringify(out));
console.log('wrote scripts/hn_urls.json');
