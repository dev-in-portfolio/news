// Register the China Mail front page acquired from the Internet Archive for HN-460.
const fs = require('fs');
const p = 'D:/news/docs/OTHER_IMAGE_ACQUISITION_LEDGER.json';
let s = fs.readFileSync(p, 'utf8');
if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
const l = JSON.parse(s);
const items = l.items || {};
const key = 'HN-460|https://archive.org/details/NPCM19281113';
if (items[key]) {
  console.log('exists: ' + items[key].status);
} else {
  items[key] = {
    hn_id: 'HN-460',
    provider: 'Internet Archive (China Mail)',
    status: 'image_acquired',
    page_url: 'https://archive.org/details/NPCM19281113',
    newspaper: 'China Mail (Hong Kong)',
    issue_date: '1928-11-13',
    error: null,
    acquired_at: new Date().toISOString(),
    full_page_asset: 'assets/images/hn-460-china-mail-19281113-p1-page.jpg',
    source_dimensions: '3585x4678',
    output_dimensions: '3585x4678',
    mosaic_method: 'archive_page_image',
    page_selection: 'text_match',
    pdf_page: 1,
    article_note: 'Front page carrying the Vestris sinking report ("Vestris ... slowly sinking with fully 300 souls aboard")',
    additional_cited_article: true,
    gray_stats: { sd: 64.9, min: 0, mean: 189.1 },
  };
  l.items = items;
  l.generated_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(l, null, 1));
  console.log('added ' + key);
}
