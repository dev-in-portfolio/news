// Add cross-reference ledger entries: a record cites an article-level Indiana URL
// whose scan was already acquired under a sibling record. The same archive scan
// is legitimately cited by both records, so link the existing asset to the
// citing record (no re-download, no new file).
const fs = require('fs');
const path = require('path');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const LEDGER_PATH = path.join(ROOT, 'docs', 'INDIANA_IMAGE_ACQUISITION_LEDGER.json');
function readJson(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
function norm(u) {
  const m = String(u).replace(/&amp;/g, '&').match(/[?&]d=([A-Za-z0-9]+?\d{8}(?:-\d+)?\.\d+\.\d+)/);
  return m ? 'https://newspapers.library.in.gov/?a=d&d=' + m[1] : null;
}

const PAIRS = [
  ['HN-173', 'https://newspapers.library.in.gov/?a=d&d=JPBN18550719.2.10'],
  ['HN-370', 'https://newspapers.library.in.gov/?a=d&d=JCDC19090904.2.11'],
  ['HN-367', 'https://newspapers.library.in.gov/?a=d&d=RSWR19091224.2.42'],
  ['HN-395', 'https://newspapers.library.in.gov/?a=d&d=JCDC19140121.2.12'],
  ['HN-388', 'https://newspapers.library.in.gov/?a=d&d=JCDC19150414.2.19'],
];

const ledger = readJson(LEDGER_PATH);
const items = ledger.items || {};
const byUrl = new Map();
for (const [k, e] of Object.entries(items)) {
  if (!e || e.status !== 'article_clip_acquired' || !e.page_url) continue;
  const u = norm(e.page_url);
  if (u && !byUrl.has(u)) byUrl.set(u, { key: k, e });
}

let added = 0;
for (const [hn, url] of PAIRS) {
  const key = hn + '|' + url;
  if (items[key] && items[key].status === 'article_clip_acquired') { console.log('skip (exists) ' + key); continue; }
  const owner = byUrl.get(norm(url));
  if (!owner) { console.log('NO OWNER for ' + url); continue; }
  const assetPath = path.join(ROOT, 'site', owner.e.crop_asset);
  if (!fs.existsSync(assetPath)) { console.log('MISSING FILE ' + owner.e.crop_asset); continue; }
  items[key] = {
    hn_id: hn,
    provider: owner.e.provider,
    status: 'article_clip_acquired',
    page_url: url,
    clip_url: url + (url.includes('?') ? '&' : '?') + 'dliv=none&e=-------en-20--1--txt-txIN-------',
    newspaper: owner.e.newspaper,
    headline: owner.e.headline,
    issue_date: owner.e.issue_date,
    page: owner.e.page,
    section: owner.e.section,
    page_key: owner.e.page_key,
    cited_section: owner.e.cited_section,
    block_count: owner.e.block_count,
    crop_asset: owner.e.crop_asset,
    crop_dimensions: owner.e.crop_dimensions,
    source_dimensions: owner.e.source_dimensions,
    crop_coordinates: null,
    crop_method: owner.e.crop_method,
    error: null,
    acquired_at: new Date().toISOString(),
    sequence: owner.e.sequence || 1,
    additional_cited_article: true,
    cross_reference_of: owner.key,
  };
  added++;
  console.log('linked ' + hn + ' -> ' + owner.e.crop_asset + ' (' + owner.e.headline + ')');
}
ledger.generated_at = new Date().toISOString();
fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
const images = buildImages();
let entries = 0, crops = 0;
for (const k of Object.keys(images)) { entries += images[k].length; crops += images[k].filter(i => i.crop).length; }
console.log(`\nadded cross-refs=${added}`);
console.log(`images.json: records=${Object.keys(images).length} entries=${entries} crops=${crops}`);
