// Merge all image-acquisition ledgers into site/data/images.json.
// Called by acquire_oregon_images.js and acquire_loc_images.js after each run.
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/news';
const OUT = path.join(ROOT, 'site', 'data', 'images.json');

function readJsonIf(p) {
  try {
    let raw = fs.readFileSync(p, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function normalise(e, fallbackProvider) {
  return {
    provider: e.provider || fallbackProvider,
    newspaper: e.newspaper || '',
    headline: e.headline || '',
    lccn: e.lccn || '',
    issue_date: e.issue_date || '',
    sequence: e.sequence != null ? e.sequence : 1,
    page_url: e.page_url || '',
    full_page: e.full_page_asset || null,
    crop: e.crop_asset || null,
    crop_coordinates: e.crop_coordinates || null,
    dimensions: e.source_dimensions || null,
    iiif_id: e.iiif_id || null,
  };
}

function buildImages() {
  const images = {};
  const seen = new Set();
  const sources = [
    { file: path.join(ROOT, 'docs', 'IMAGE_ACQUISITION_LEDGER.json'), provider: 'Historic Oregon Newspapers (University of Oregon)' },
    { file: path.join(ROOT, 'docs', 'LOC_IMAGE_ACQUISITION_LEDGER.json'), provider: 'Library of Congress / Chronicling America' },
    { file: path.join(ROOT, 'docs', 'SC_IMAGE_ACQUISITION_LEDGER.json'), provider: 'South Carolina Historic Newspapers (University of South Carolina)' },
    { file: path.join(ROOT, 'docs', 'PORTAL_IMAGE_ACQUISITION_LEDGER.json'), provider: 'Gateway to Oklahoma History / The Portal to Texas History' },
  ];
  for (const src of sources) {
    const ledger = readJsonIf(src.file);
    if (!ledger || !ledger.items) continue;
    for (const e of Object.values(ledger.items)) {
      if (!e || !e.full_page_asset) continue;
      if (e.status !== 'full_page_acquired' && e.status !== 'crop_acquired') continue;
      const hn = e.hn_id;
      if (!hn) continue;
      const key = hn + '|' + (e.page_url || e.full_page_asset);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!images[hn]) images[hn] = [];
      images[hn].push(normalise(e, src.provider));
    }
  }
  for (const k of Object.keys(images)) {
    images[k].sort((a, b) => (a.issue_date + String(a.sequence).padStart(3, '0'))
      .localeCompare(b.issue_date + String(b.sequence).padStart(3, '0')));
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(images, null, 1));
  return images;
}

module.exports = { buildImages };

if (require.main === module) {
  const images = buildImages();
  const recs = Object.keys(images);
  let items = 0, crops = 0;
  for (const k of recs) { items += images[k].length; crops += images[k].filter(i => i.crop).length; }
  console.log('images.json: records=' + recs.length + ' items=' + items + ' crops=' + crops);
}
