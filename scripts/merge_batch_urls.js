// ============================================================================
// Milestone 6 — Merge batch-report URLs into SOURCE_ACQUISITION_MANIFEST.csv
// and attempt accessible acquisitions.
// ============================================================================
const fs = require('fs');
const path = require('path');

const DATA = 'D:/news/docs';
const MANIFEST = path.join(DATA, 'SOURCE_ACQUISITION_MANIFEST.csv');

// ---------- Parse manifest ----------
let manifestText = fs.readFileSync(MANIFEST, 'utf8');
const manifestLines = manifestText.split(/\r?\n/).filter(Boolean);
const manifestHeader = manifestLines[0].split(',').map(h => h.replace(/"/g, '').trim());
const manifestRows = [];
for (let i = 1; i < manifestLines.length; i++) {
  const cols = manifestLines[i].split(',');
  const row = {};
  manifestHeader.forEach((h, j) => { row[h] = (cols[j] || '').replace(/"/g, ''); });
  manifestRows.push(row);
}
console.log('Existing manifest rows:', manifestRows.length);
const existingUrls = new Set(manifestRows.map(r => r.original_url_exact));

// ---------- Load batch URLs ----------
const batchUrls = JSON.parse(fs.readFileSync('D:/news/scripts/batch_urls.json', 'utf8'));
const batchByProvider = JSON.parse(fs.readFileSync('D:/news/scripts/batch_by_provider.json', 'utf8'));

// ---------- Merge new URLs ----------
const now = new Date().toISOString();
let appearanceSeq = manifestRows.length + 1;
let added = 0;
const newRows = [];

for (const url of batchUrls) {
  if (existingUrls.has(url)) continue;
  appearanceSeq++;
  added++;
  newRows.push({
    hn_ids: '',
    event_id: '',
    appearance_id: `APP-${String(appearanceSeq).padStart(5, '0')}`,
    newspaper: '',
    issue_date: '',
    edition: '',
    page: '',
    original_url_exact: url,
    resolved_url: url,
    provider: '', // will classify below
    source_kind: 'historical_archive_page',
    discovered_in_file: 'COVERAGE_SEARCH_LEDGER.csv',
    source_file_location: 'docs/',
    acquisition_status: 'untried',
    full_page_available: 'unknown',
    full_page_asset_path: '',
    article_crop_status: 'untried',
    crop_asset_path: '',
    crop_coordinates: '',
    source_dimensions: '',
    ocr_status: 'untried',
    reuse_status: 'rights_unresolved',
    reuse_basis_or_url: '',
    source_identity_verified: 'false',
    crop_reviewed: 'false',
    reviewer_or_process: 'OpenCode Milestone 6 (automated)',
    last_checked_at: '',
    failure_reason: '',
    next_action: 'Queue for provider-specific acquisition test'
  });
}

console.log('New batch-report URLs to add:', added);

// Classify provider
function getProvider(url) {
  if (!url) return 'Other';
  if (url.match(/theguardian\.com/)) return 'The Guardian';
  if (url.match(/loc\.gov/)) return 'Library of Congress / Chronicling America';
  if (url.match(/newspapers\.library\.in\.gov/)) return 'Indiana Historical Newspapers';
  if (url.match(/wcax\.com/)) return 'WCAX';
  if (url.match(/ny1\.com/)) return 'NY1';
  if (url.match(/bl\.iro\.bl\.uk/)) return 'British Library';
  if (url.match(/oregonnews\.uoregon\.edu/)) return 'Historic Oregon Newspapers';
  if (url.match(/paperspast\.natlib\.govt\.nz/)) return 'Papers Past (NZ)';
  if (url.match(/gateway\.okhistory\.org/)) return 'Oklahoma Historical Society';
  if (url.match(/tile\.loc\.gov/)) return 'LOC Tile Storage';
  if (url.match(/newspaperarchive\.com/)) return 'NewspaperArchive';
  if (url.match(/gahistoricnewspapers/)) return 'Georgia Historic Newspapers';
  return 'Other';
}

newRows.forEach(r => { r.provider = getProvider(r.original_url_exact); });

// ---------- Append to manifest ----------
const manifestCsvHeader = manifestHeader.join(',');
const newCsvRows = newRows.map(r => manifestHeader.map(h => {
  let v = r[h] || '';
  // Quote fields containing commas or quotes
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    v = '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}).join(','));

fs.appendFileSync(MANIFEST, newCsvRows.join('\n') + '\n');
console.log('Appended', newCsvRows.length, 'rows to manifest');

// ---------- Try fetching accessible URLs ----------
// Test Guardian and WCAX URLs (proven accessible)
const accessibleUrls = batchUrls.filter(u => 
  u.match(/theguardian\.com/) || u.match(/wcax\.com/)
);
console.log('\nAccessible URLs to test:', accessibleUrls.length);

async function fetchUrl(url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return { url, status: resp.status, ok: resp.ok };
  } catch (e) {
    return { url, status: null, ok: false, error: e.message };
  }
}

async function main() {
  const results = [];
  for (const url of accessibleUrls.slice(0, 20)) { // test first 20 accessible
    const r = await fetchUrl(url);
    results.push(r);
    console.log(`${r.status ?? 'ERR'} ${r.url}`);
  }
  
  const okCount = results.filter(r => r.ok).length;
  const blockedCount = results.filter(r => r.status === 403).length;
  const errCount = results.filter(r => !r.ok && r.status !== 403).length;
  console.log(`\nTest results: ${okCount} OK, ${blockedCount} 403-blocked, ${errCount} errors`);
}

main().catch(console.error);
