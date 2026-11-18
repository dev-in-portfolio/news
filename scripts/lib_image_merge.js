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
    crop_method: e.crop_method || null,
    mosaic_method: e.mosaic_method || null,
    dimensions: e.source_dimensions || null,
    iiif_id: e.iiif_id || null,
    cited_section: e.cited_section || null,
    page_key: e.page_key || null,
    section_area: e.section_area || null,
    additional_cited_article: e.additional_cited_article || false,
    cross_reference_of: e.cross_reference_of || null,
    distinct_asset: e.distinct_asset || false,
  };
}

// An article clip too tall for one JPEG is stored as ordered vertical parts
// (crop_parts). Each part is its own image item on the record page, sharing the
// same source page URL and archive provenance.
function normalisePart(e, part, fallbackProvider) {
  const base = normalise(e, fallbackProvider);
  base.crop = part.asset;
  base.dimensions = part.dimensions || base.dimensions;
  base.part = part.part;
  base.part_count = e.crop_parts.length;
  return base;
}

function buildImages() {
  const images = {};
  const seen = new Set();
  const sources = [
    { file: path.join(ROOT, 'docs', 'IMAGE_ACQUISITION_LEDGER.json'), provider: 'Historic Oregon Newspapers (University of Oregon)' },
    { file: path.join(ROOT, 'docs', 'LOC_IMAGE_ACQUISITION_LEDGER.json'), provider: 'Library of Congress / Chronicling America' },
    { file: path.join(ROOT, 'docs', 'SC_IMAGE_ACQUISITION_LEDGER.json'), provider: 'South Carolina Historic Newspapers (University of South Carolina)' },
    { file: path.join(ROOT, 'docs', 'PORTAL_IMAGE_ACQUISITION_LEDGER.json'), provider: 'Gateway to Oklahoma History / The Portal to Texas History' },
    { file: path.join(ROOT, 'docs', 'INDIANA_IMAGE_ACQUISITION_LEDGER.json'), provider: 'Hoosier State Chronicles (Indiana State Library)' },
    { file: path.join(ROOT, 'docs', 'INDIANA_MOSAIC_LEDGER.json'), provider: 'Hoosier State Chronicles (Indiana State Library)' },
    { file: path.join(ROOT, 'docs', 'VIRGINIA_CHRONICLE_MOSAIC_LEDGER.json'), provider: 'Virginia Chronicle (Library of Virginia)' },
    { file: path.join(ROOT, 'docs', 'SUPPORTING_VERIDIAN_LEDGER.json'), provider: null },
    { file: path.join(ROOT, 'docs', 'GEORGIA_IIIF_LEDGER.json'), provider: 'Georgia Historic Newspapers (Digital Library of Georgia)' },
    { file: path.join(ROOT, 'docs', 'TAMU_IIIF_LEDGER.json'), provider: 'Texas A&M University Libraries (Open ONI)' },
    { file: path.join(ROOT, 'docs', 'NEWSPAPERSG_SUPPORT_LEDGER.json'), provider: 'NewspaperSG (National Library Board, Singapore)' },
    { file: path.join(ROOT, 'docs', 'SPECTATOR_IMAGE_LEDGER.json'), provider: 'The Spectator Archive' },
    { file: path.join(ROOT, 'docs', 'JTA_IMAGE_LEDGER.json'), provider: 'Jewish Telegraphic Agency Archive' },
    { file: path.join(ROOT, 'docs', 'OAKLAND_IMAGE_LEDGER.json'), provider: 'Oakland University (The Pontiac Press)' },
    { file: path.join(ROOT, 'docs', 'CMU_IMAGE_LEDGER.json'), provider: 'Carnegie Mellon University Libraries (The American Jewish Outlook)' },
    { file: path.join(ROOT, 'docs', 'SUPPORT_SCANS_LEDGER.json'), provider: 'Supporting newspaper scans' },
    { file: path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json'), provider: 'Other public archives' },
    { file: path.join(ROOT, 'docs', 'PAPERSPAST_IMAGE_ACQUISITION_LEDGER.json'), provider: 'Papers Past (National Library of New Zealand)' },
  ];
  for (const src of sources) {
    const ledger = readJsonIf(src.file);
    if (!ledger || !ledger.items) continue;
    for (const e of Object.values(ledger.items)) {
      if (!e) continue;
      if (!e.full_page_asset && !e.crop_asset) continue;
      if (e.status !== 'full_page_acquired' && e.status !== 'crop_acquired' &&
          e.status !== 'article_clip_acquired' && e.status !== 'page_mosaic_acquired' &&
          e.status !== 'image_acquired') continue;
      const hn = e.hn_id;
      if (!hn) continue;
      const parts = Array.isArray(e.crop_parts) && e.crop_parts.length ? e.crop_parts : null;
      if (parts) {
        for (const p of parts) {
          const pkey = hn + '|' + (e.page_url || p.asset) + '|part' + p.part;
          if (seen.has(pkey)) continue;
          seen.add(pkey);
          if (!images[hn]) images[hn] = [];
          images[hn].push(normalisePart(e, p, src.provider));
        }
        continue;
      }
      const asset = e.full_page_asset || e.crop_asset;
      // Distinct scans published on one source page (e.g. several archive-owned
      // clippings in a single exhibit) must not collapse to one image. Entries
      // flagged distinct_asset include the asset in the dedupe key; all other
      // entries keep the legacy page-level key so cross-ledger duplicates and
      // near-duplicate renditions of the same page still dedupe.
      const key = hn + '|' + (e.page_url || asset) + (e.distinct_asset ? '|' + asset : '');
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
