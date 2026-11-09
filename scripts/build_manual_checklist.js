// Build a manual-download checklist for records that still have no acquired
// page scan. Splits actionable public-domain archives from modern paywalled
// or commercial sources that should only be cited.
//
// Outputs:
//   docs/MANUAL_DOWNLOAD_CHECKLIST.md
//   docs/MANUAL_DOWNLOAD_CHECKLIST.csv
const fs = require('fs');

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

const records = readJson('D:/news/site/data/records.json');
const hnUrls = readJson('D:/news/scripts/hn_urls.json');
const images = readJson('D:/news/site/data/images.json');

// host fragment -> { label, reason, kind }
// kind: 'archive' (public-domain scan worth retrieving) | 'modern' (cite only)
const HOSTS = [
  { test: /newspapers\.library\.in\.gov/, label: 'Indiana — newspapers.library.in.gov', kind: 'archive',
    reason: 'Cloudflare bot challenge. Open in a normal browser, let the viewer load, then save the page image from the viewer.' },
  { test: /paperspast\.natlib\.govt\.nz/, label: 'Papers Past — paperspast.natlib.govt.nz', kind: 'archive',
    reason: 'Incapsula JavaScript challenge. Open in a browser and use the page\'s own Download control.' },
  { test: /gahistoricnewspapers/, label: 'Georgia Historic Newspapers', kind: 'archive',
    reason: 'Server returns 403 to automated requests. Open in a browser and use the page image / OCR links.' },
  { test: /newspaper\.library\.tamu\.edu/, label: 'Texas A&M Newspaper Collection', kind: 'archive',
    reason: 'Server returns 403 to automated requests. Open in a browser and save the page image.' },
  { test: /news\.hrvh\.org/, label: 'Hudson River Valley Heritage', kind: 'archive',
    reason: 'Server returns 403 to automated requests. Open in a browser and save the page image.' },
  { test: /virginiachronicle\.com/, label: 'Virginia Chronicle', kind: 'archive',
    reason: 'Cloudflare challenge. Open in a browser and save the page image.' },
  { test: /eresources\.nlb\.gov\.sg/, label: 'NewspaperSG (National Library Board Singapore)', kind: 'archive',
    reason: 'JavaScript challenge (HTTP 202). Open in a browser and use the article / page download control.' },
  { test: /bplonline\.contentdm\.oclc\.org/, label: 'Boston Public Library (CONTENTdm)', kind: 'archive',
    reason: 'IIIF works but exposes only a 460-px clipping. Open in a browser to request a higher-resolution copy.' },
  { test: /digital\.library\.cornell\.edu/, label: 'Cornell Digital Library', kind: 'archive',
    reason: 'JavaScript challenge (HTTP 202). Open in a browser and use the download control.' },
  { test: /ufdc\.ufl\.edu/, label: 'University of Florida Digital Collections', kind: 'archive',
    reason: 'No public IIIF path found. Open in a browser and use the page image / PDF download.' },
  { test: /archives\.nd\.edu/, label: 'Notre Dame Archives (PDF)', kind: 'archive',
    reason: 'Source is a PDF, not a page image. Download the PDF manually and cite it.' },
  { test: /api\.drum\.lib\.umd\.edu/, label: 'DRUM (University of Maryland, PDF)', kind: 'archive',
    reason: 'Source is a PDF, not a page image. Download the PDF manually and cite it.' },
  { test: /iiif\.library\.cmu\.edu/, label: 'Carnegie Mellon IIIF (PDF)', kind: 'archive',
    reason: 'Source is a PDF, not a page image. Download the PDF manually and cite it.' },
  { test: /quartexcollections\.com/, label: 'Quartex digital collections', kind: 'archive',
    reason: 'Viewer-specific download. Open in a browser and use the document download control.' },
  { test: /newspapers\.swco\.ttu\.edu/, label: 'Texas Tech Southwest Collection', kind: 'archive',
    reason: 'DSpace bitstream download. Open in a browser and save the file.' },
  { test: /britishnewspaperarchive|bl\.uk/, label: 'British Newspaper Archive', kind: 'modern',
    reason: 'Subscription paywall. Do not store images beyond personal research use.' },
  { test: /newspaperarchive\.com/, label: 'NewspaperArchive.com', kind: 'modern',
    reason: 'Commercial subscription paywall. Cite only unless you hold a licence.' },
  { test: /rarenewspapers\.com/, label: 'RareNewspapers.com', kind: 'modern',
    reason: 'Commercial dealer photographs. Do not copy without permission.' },
  { test: /washingtonpost\.com/, label: 'The Washington Post', kind: 'modern', reason: 'Modern paywalled article. Cite the URL only.' },
  { test: /latimes\.com/, label: 'Los Angeles Times', kind: 'modern', reason: 'Modern paywalled article. Cite the URL only.' },
  { test: /theguardian\.com/, label: 'The Guardian', kind: 'modern', reason: 'Modern article. Cite the URL only.' },
  { test: /nytimes\.com|timesmachine\.nytimes\.com/, label: 'The New York Times', kind: 'modern', reason: 'Modern paywall / TimesMachine subscription. Cite the URL only.' },
  { test: /wsj\.com/, label: 'The Wall Street Journal', kind: 'modern', reason: 'Modern paywall. Cite the URL only.' },
  { test: /ft\.com/, label: 'Financial Times', kind: 'modern', reason: 'Modern paywall. Cite the URL only.' },
  { test: /thetimes\.com/, label: 'The Times (London)', kind: 'modern', reason: 'Modern paywall. Cite the URL only.' },
];

function classify(url) {
  for (const h of HOSTS) if (h.test.test(url)) return h;
  return {
    label: 'Other web sources (modern news, encyclopedias, PDFs)',
    kind: 'modern',
    reason: 'Not a digitized newspaper archive we can retrieve automatically. Cite the URL only; do not republish article text or images.',
  };
}

const rows = [];
for (const r of records) {
  const urls = hnUrls[r.hn_id] || [];
  if (!urls.length) continue;
  if ((images[r.hn_id] || []).length) continue; // already has at least one scan
  const byLabel = new Map();
  for (const u of urls) {
    const h = classify(u);
    if (!byLabel.has(h.label)) byLabel.set(h.label, { h, urls: [] });
    byLabel.get(h.label).urls.push(u);
  }
  for (const { h, urls: us } of byLabel.values()) {
    rows.push({
      hn_id: r.hn_id,
      heading: r.heading || '',
      date: r.date || '',
      provider: h.label,
      kind: h.kind,
      reason: h.reason,
      urls: [...new Set(us)],
      page: `stories/${r.hn_id.replace('HN-', 'hn-')}.html`,
    });
  }
}

const archiveRows = rows.filter(r => r.kind === 'archive');
const modernRows = rows.filter(r => r.kind === 'modern');
const archiveRecords = new Set(archiveRows.map(r => r.hn_id));
const modernRecords = new Set(modernRows.map(r => r.hn_id));

function csvCell(v) {
  v = String(v == null ? '' : v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
const csv = ['hn_id,heading,date,category,provider,urls,record_page,note'];
for (const r of rows) {
  csv.push([r.hn_id, r.heading, r.date, r.kind, r.provider, r.urls.join(' | '), r.page, r.reason].map(csvCell).join(','));
}
fs.writeFileSync('D:/news/docs/MANUAL_DOWNLOAD_CHECKLIST.csv', '\uFEFF' + csv.join('\r\n') + '\r\n');

// ---------- Markdown ----------
const md = [];
md.push('# Manual Download Checklist');
md.push('');
md.push('These records still have **no acquired page scan**. The list is split into');
md.push('public-domain archive scans that are worth retrieving by hand, and modern');
md.push('paywalled/commercial sources that should only be cited.');
md.push('');
md.push('## Rules');
md.push('');
md.push('- Only save scans you are permitted to keep and display. Prefer public-domain');
md.push('  and openly licensed material.');
md.push('- Save the archive\'s own page image; never screenshot a modern paywalled article.');
md.push('- Record the exact URL used and the retrieval date.');
md.push('- When a scan is added: put it in `site/assets/images/`, add an entry to the');
md.push('  matching provider ledger, then re-run `node scripts/lib_image_merge.js` and');
md.push('  `node scripts/build-pages.js`.');
md.push('- Do not edit the original research reports in `newspaper/`.');
md.push('');
md.push('## Summary');
md.push('');
md.push('| Category | Records | Source links |');
md.push('|----------|---------|--------------|');
md.push(`| Public-domain archive scans worth retrieving | ${archiveRecords.size} | ${archiveRows.length} |`);
md.push(`| Modern / commercial — cite only | ${modernRecords.size} | ${modernRows.length} |`);
md.push('');

function tableFor(groupRows) {
  const out = [];
  out.push('| HN | Date | Heading | Source |');
  out.push('|----|------|---------|--------|');
  for (const r of groupRows) {
    const links = r.urls.map(u => `<${u}>`).join('<br>');
    out.push(`| ${r.hn_id} | ${r.date || '—'} | ${(r.heading || '—').replace(/\|/g, '\\|')} | ${links} |`);
  }
  return out;
}

md.push('## A. Public-domain archive scans to retrieve manually');
md.push('');
const archiveLabels = [...new Set(archiveRows.map(r => r.provider))];
for (const label of archiveLabels) {
  const g = archiveRows.filter(r => r.provider === label);
  md.push(`### ${label} — ${g.length} record${g.length === 1 ? '' : 's'}`);
  md.push('');
  md.push(`_${g[0].reason}_`);
  md.push('');
  md.push(...tableFor(g));
  md.push('');
}

md.push('## B. Modern / commercial sources — cite only, do not download');
md.push('');
const modernLabels = [...new Set(modernRows.map(r => r.provider))];
for (const label of modernLabels) {
  const g = modernRows.filter(r => r.provider === label);
  md.push(`### ${label} — ${g.length} record${g.length === 1 ? '' : 's'}`);
  md.push('');
  md.push(`_${g[0].reason}_`);
  md.push('');
  md.push(...tableFor(g));
  md.push('');
}

md.push('---');
md.push('');
md.push('Machine-readable copy: `docs/MANUAL_DOWNLOAD_CHECKLIST.csv`.');
fs.writeFileSync('D:/news/docs/MANUAL_DOWNLOAD_CHECKLIST.md', md.join('\n') + '\n');

console.log(`Rows: ${rows.length}  archive=${archiveRows.length} (${archiveRecords.size} records)  modern=${modernRows.length} (${modernRecords.size} records)`);
const counts = {};
for (const r of rows) counts[r.provider] = (counts[r.provider] || 0) + 1;
for (const [p, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${p}`);
console.log('Wrote docs/MANUAL_DOWNLOAD_CHECKLIST.md and .csv');
