// ============================================================================
// Milestone 5 Build — Step 2: Static page generator
// Generates homepage, 1,056 event detail pages, search, taxonomy, timeline,
// comparisons, and about pages from normalized data JSON.
// ============================================================================
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/news';
const DATA = path.join(ROOT, 'site', 'data');
const SITE = path.join(ROOT, 'site');

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

const records = readJson(path.join(DATA, 'records.json'));
const comparisons = readJson(path.join(DATA, 'comparisons.json'));
const stats = readJson(path.join(DATA, 'stats.json'));
const taxonomy = readJson(path.join(DATA, 'taxonomy.json'));

// Read acquisition manifest (keyed by seed_url)
let manifestByUrl = {};
try {
  const mRaw = fs.readFileSync(path.join(ROOT, 'docs', 'SOURCE_ACQUISITION_MANIFEST.csv'), 'utf8');
  const lines = mRaw.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  lines.slice(1).forEach(line => {
    // simple CSV parse (fields may contain commas in URLs? URLs have no commas)
    const cols = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = (cols[i] || '').replace(/"/g, ''); });
    if (row.original_url_exact) manifestByUrl[row.original_url_exact] = row;
  });
} catch (e) { console.warn('manifest not loaded:', e.message); }

// ---------- helpers ----------
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function nl2br(s) {
  if (!s) return '';
  return String(s).replace(/\n/g, '<br>');
}
// Mini markdown renderer for source text (bold, italic, markdown links, bare URLs).
// Escapes HTML first so injected tags are safe.
function renderMd(text) {
  if (!text) return '';
  let s = esc(String(text));
  s = s.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="external">$1</a>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/\n/g, '<br>');
  return s;
}
// Render a list of bare URLs extracted from audit source-links text.
function renderLinks(text) {
  if (!text) return '';
  const urls = String(text).match(/https?:\/\/[^\s)\]]+/g) || [];
  return urls.map(function (u) {
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" class="external">' + esc(u) + '</a>';
  }).join(' ');
}
function badgeForClass(cls) {
  const map = { V: 'cls-v', R: 'cls-r', P: 'cls-p', M: 'cls-m', F: 'cls-f', Q: 'cls-q' };
  return map[cls] || 'tier-blank';
}
function badgeLabel(cls) {
  const map = {
    V: 'Printed differences', R: 'Revision/retraction', P: 'Competing accounts',
    M: 'Metadata/identity', F: 'Different measures', Q: 'Unverified lead'
  };
  return map[cls] || 'No curated flag';
}
function tierBadge(tier) {
  if (!tier) return '<span class="badge tier-blank">Evidence not assigned</span>';
  return '<span class="badge tier-a">Evidence tier ' + esc(tier) + '</span>';
}
function curBadge(cls) {
  if (!cls) return '';
  return '<span class="badge ' + badgeForClass(cls) + '">Curated flag: ' + badgeLabel(cls) + '</span>';
}
function linkify(text) {
  if (!text) return '';
  return String(text).replace(/https?:\/\/[^\s)\]]+/g, function (u) {
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" class="external">' + esc(u) + '</a>';
  });
}
// ---------- shared shell ----------
function head(title) {
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(title) + ' — Historical Newspaper Archives</title>\n<link rel="stylesheet" href="../assets/style.css">\n</head>\n<body>\n<header class="site-header">\n  <div class="header-inner">\n    <a class="brand" href="/">Historical Newspaper Archives<em></em></a>\n    <nav class="nav">\n      <a href="/">Home</a>\n      <a href="search.html">All Stories</a>\n      <a href="taxonomy.html">Categories</a>\n      <a href="timeline.html">Timeline</a>\n      <a href="comparisons.html">Comparisons</a>\n      <a href="about.html">Methodology</a>\n    </nav>\n  </div>\n</header>\n';
}
function foot() {
  return '<div class="site-footer">\n  Historical Newspaper Archives &middot; Evidence-aware historical newspaper research.\n  <br><small>Source URLs preserved verbatim from the HN seed queue. No original source files modified.</small>\n</div>\n<script src="../assets/app.js"></script>\n</body>\n</html>\n';
}
// ---------- homepage ----------
function buildHomepage() {
  const featured = ['HN-403', 'HN-753', 'HN-894'].map(id => records.find(r => r.hn_id === id)).filter(Boolean);
  const featuredHtml = featured.map(r => {
    const status = r.recon_category === 'curated_flag' ? 'Curated flag (' + badgeLabel(r.curated_flag_class) + ')' : 'Indexed';
    return '<div class="card">\n' +
      '<h2><a href="stories/' + esc(r.hn_id) + '.html">' + esc(r.hn_id) + ': ' + esc(r.heading) + '</a></h2>\n' +
      '<div class="meta">' + esc(r.date) + ' &middot; ' + esc(r.taxonomy.root) + '</div>\n' +
      tierBadge(r.evidence_tier) + curBadge(r.curated_class) + '\n' +
      '<p>' + renderMd(r.recorded_finding || r.discovery_body || '') + '</p>\n' +
      '<p class="note"><strong>Source status:</strong> ' + esc(status) + '. Original seed URL: ' +
      '<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" class="external">' + esc(r.url) + '</a></p>\n' +
      '</div>';
  }).join('\n');

  return head('Home') +
    '<div class="container">\n' +
    '<h1>Historical Newspaper Archives</h1>\n' +
    '<p class="lead">An evidence-aware research and discovery archive of unusual, forgotten, consequential, and sometimes disputed newspaper reporting covering 1777&ndash;2026. Newspaper reports record what publications printed &mdash; they do not establish claims as fact.</p>\n' +
    '<div class="stat-grid">\n' +
    '  <div class="stat"><div class="val">' + stats.total + '</div><div class="lbl">HN research records indexed</div></div>\n' +
    '  <div class="stat"><div class="val">' + stats.curated + '</div><div class="lbl">Curated inconsistency/revision flags</div></div>\n' +
    '  <div class="stat"><div class="val">' + stats.heuristic + '</div><div class="lbl">Heuristic keyword leads</div></div>\n' +
    '  <div class="stat"><div class="val">' + stats.indexedOnly + '</div><div class="lbl">Indexed records (no discrepancy asserted)</div></div>\n' +
    '</div>\n' +
    '<h2 class="section-title">Featured reference stories</h2>\n' +
    '<p>End-to-end local pages with authentic sources and honest media-availability records. These are technical/editorial integration tests, not a sample standing in for the full archive.</p>\n' +
    featuredHtml +
    '<h2 class="section-title">Browse by category</h2>\n' +
    '<p>Explore the locked taxonomy &mdash; 13 main categories, 100 subcategories, 361 third-level labels.</p>\n' +
    '<a href="taxonomy.html" class="btn">Open category explorer &rarr;</a>\n' +
    '<h2 class="section-title">Search the catalog</h2>\n' +
    '<p>Search by event, newspaper, person, place, year, claim, headline, or HN ID.</p>\n' +
    '<input type="search" id="search-input" placeholder="Search 1,056 records&hellip;" autofocus>\n' +
    '<div id="count"><span id="count-label">records in index</span>: <span id="count">' + stats.total + '</span></div>\n' +
    '<div id="results"></div>\n' +
    '</div>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'index.html'), buildHomepage());
// ---------- detail pages ----------
const storiesDir = path.join(SITE, 'stories');
fs.mkdirSync(storiesDir, { recursive: true });

function buildDetail(r) {
  const m = manifestByUrl[r.url] || {};
  const acquisition = m.acquisition_status || 'untried';
  const failure = m.failure_reason || '';
  const nextAction = m.next_action || '';
  const provider = m.provider || '';
  const reuse = m.reuse_status || '';

  const taxBread = [esc(r.taxonomy.root), esc(r.taxonomy.sub), esc(r.taxonomy.leaf)].filter(Boolean).join(' &gt; ');
  const peersHtml = r.identity_peers ? '<p><strong>Identity-review candidate peers:</strong> ' + renderMd(r.identity_peers) + '</p>' : '';
  const auditHtml = r.audit_class ?
    '<div class="card">\n' +
    '<h3>Curated audit flag</h3>\n' +
    '<p><strong>Class:</strong> ' + badgeLabel(r.audit_class) + ' (' + esc(r.audit_class) + ')</p>\n' +
    '<p><strong>Recorded difference/concern:</strong> ' + renderMd(r.audit_finding) + '</p>\n' +
    (r.audit_assessment ? '<p><strong>Assessment:</strong> ' + renderMd(r.audit_assessment) + '</p>' : '') +
    (r.audit_links ? '<p><strong>Source links:</strong> ' + renderLinks(r.audit_links) + '</p>' : '') +
    '</div>' : '';

  const acquisitionHtml = acquisition !== 'untried' ?
    '<div class="card">\n' +
    '<h3>Source acquisition</h3>\n' +
    '<p><strong>Provider:</strong> ' + esc(provider) + '</p>\n' +
    '<p><strong>Status:</strong> <span class="badge status-' + (acquisition.includes('blocked') ? 'blocked' : (acquisition.includes('verified') ? 'verified' : 'link')) + '">' + esc(acquisition) + '</span></p>\n' +
    (failure ? '<p><strong>Note:</strong> ' + esc(failure) + '</p>' : '') +
    (nextAction ? '<p><strong>Next action:</strong> ' + esc(nextAction) + '</p>' : '') +
    '</div>' :
    '<div class="card note">\n' +
    '<h3>Source acquisition</h3>\n' +
    '<p>Not yet acquired. Queued for provider-specific acquisition testing (see <a href="comparisons.html">source-acquisition manifest</a>).</p>\n' +
    '</div>';

  return head(r.hn_id + ': ' + r.heading) +
    '<div class="container">\n' +
    '<div class="detail-head">\n' +
    '<h1>' + esc(r.hn_id) + ': ' + esc(r.heading) + '</h1>\n' +
    '<div class="badges-row">' + tierBadge(r.evidence_tier) + curBadge(r.curated_class) + '\n' +
    '<span class="badge status-link">External source link</span>\n' +
    '</div>\n' +
    '</div>\n' +
    '<p class="tagline"><strong>HN ' + esc(r.hn_id) + '</strong> &middot; ' + esc(r.date) + ' &middot; ' +
    taxBread + '</p>\n' +
    '<div class="meta-grid">\n' +
    '<div class="meta-item"><div class="lbl">Seed heading</div><div>' + esc(r.heading) + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Seed publication date</div><div>' + esc(r.date) + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Taxonomy (root &gt; sub &gt; leaf)</div><div>' + taxBread + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Decision status</div><div>' + esc(r.decision_status) + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Reconciliation category</div><div>' + esc(r.recon_category.replace(/_/g, ' ')) + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Batch-report entries</div><div>' + r.batch_count + '</div></div>\n' +
    '</div>\n' +
    '<div class="card">\n' +
    '<h3>Recorded finding</h3>\n' +
    '<p>' + renderMd(r.recorded_finding) + '</p>\n' +
    (r.discovery_body ? '<h4>Discovery narrative</h4>\n<p class="discovery-body">' + renderMd(r.discovery_body) + '</p>' : '') +
    peersHtml +
    '</div>\n' +
    auditHtml +
    acquisitionHtml +
    '<div class="card">\n' +
    '<h3>Original seed</h3>\n' +
    '<p><strong>URL (preserved verbatim):</strong> <a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" class="external">' + esc(r.url) + '</a></p>\n' +
    '<p><strong>Saved research report:</strong> ' + esc(r.report) + '</p>\n' +
    '<p class="note"><strong>Evidence note:</strong> A newspaper report means a historical publication made a claim; it does not establish that claim as fact. Contemporary reporting is separated from later scholarly context and our own assessment.</p>\n' +
    '</div>\n' +
    '<div class="back-top"><a href="#top">Back to top &uarr;</a></div>\n' +
    '</div>\n' +
    foot();
}
records.forEach(function (r) {
  fs.writeFileSync(path.join(storiesDir, r.hn_id + '.html'), buildDetail(r));
});
console.log('Detail pages generated:', records.length);
// ---------- search page ----------
function buildSearch() {
  const urlParams = new URLSearchParams();
  // read q from a placeholder; replaced at write time below
  return head('All Stories — Searchable Catalog') +
    '<div class="container">\n' +
    '<h1>All Stories</h1>\n' +
    '<p class="lead">Full searchable and filterable catalog of all <strong id="count">' + stats.total + '</strong> imported HN research records. Show research status for incomplete entries.</p>\n' +
    '<input type="search" id="search-input" placeholder="Search by event, newspaper, person, place, year, claim, headline, or HN ID&hellip;" autofocus>\n' +
    '<div id="count-label">records match</div>\n' +
    '<div id="results"></div>\n' +
    '</div>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'search.html'), buildSearch());
// ---------- taxonomy page ----------
function buildTaxonomy() {
  let html = head('Categories — Locked Taxonomy') +
    '<div class="container">\n' +
    '<h1>Categories</h1>\n' +
    '<p class="lead">The locked taxonomy: <strong>13 main categories</strong>, <strong>100 subcategories</strong>, and <strong>361 third-level labels</strong>. Populated leaves are shown; empty leaves are retained in the schema but not displayed as destinations.</p>\n';
  taxonomy.forEach(function (root) {
    html += '<div class="tax-root">\n' +
      '<div class="root-name" onclick="toggleTax(this)">' + esc(root.root) + ' <span class="tax-count">(' + root.subs.reduce((s, sub) => s + sub.leaves.reduce((l, leaf) => l + leaf.count, 0), 0) + ' records)</span></div>\n';
    root.subs.forEach(function (sub) {
      const subCount = sub.leaves.reduce((l, leaf) => l + leaf.count, 0);
      html += '<div class="tax-sub"><span class="sub-name">' + esc(sub.sub) + '</span> <span class="tax-count">(' + subCount + ')</span></div>\n';
      sub.leaves.forEach(function (leaf) {
        html += '<div class="tax-leaf">' +
          '<a href="search.html?q=' + esc(leaf.leaf) + '">' + esc(leaf.leaf) + '</a>' +
          ' <span class="tax-count">(' + leaf.count + ')</span>' +
          '</div>\n';
      });
    });
    html += '</div>\n';
  });
  return html + '</div>\n' +
    '<script>\nfunction toggleTax(el) {\n  const parent = el.parentElement;\n  const expanded = parent.getAttribute(\'data-expanded\') === \'true\';\n  parent.setAttribute(\'data-expanded\', !expanded);\n  const subs = parent.querySelectorAll(\'.tax-sub, .tax-leaf\');\n  subs.forEach(s => s.style.display = expanded ? \'none\' : \'\');\n}\n// Collapse all by default\ndocument.querySelectorAll(\'.tax-root\').forEach(r => { r.setAttribute(\'data-expanded\',\'false\'); r.querySelectorAll(\'.tax-sub,.tax-leaf\').forEach(s=>s.style.display=\'none\'); });\n</script>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'taxonomy.html'), buildTaxonomy());
// ---------- timeline page ----------
function buildTimeline() {
  // Group by decade
  const byDecade = {};
  records.forEach(r => {
    const m = r.date.match(/(\d{4})/);
    const year = m ? m[1] : 'undated';
    const decade = year !== 'undated' ? (Math.floor(Number(year) / 10) * 10) + 's' : 'undated';
    if (!byDecade[decade]) byDecade[decade] = [];
    byDecade[decade].push(r);
  });
  const decades = Object.keys(byDecade).sort((a, b) => a === 'undated' ? 1 : b === 'undated' ? -1 : a - b);
  let html = head('Timeline — 1777&ndash;2026') +
    '<div class="container">\n' +
    '<h1>Timeline</h1>\n' +
    '<p class="lead">Browse records by decade (1777&ndash;2026). Printing dates are not necessarily event dates &mdash; papers frequently reproduced reports weeks or months old.</p>\n' +
    '<div class="timeline">\n';
  decades.forEach(function (dec) {
    const items = byDecade[dec];
    html += '<h3>' + esc(dec) + ' <span class="tax-count">(' + items.length + ')</span></h3>\n';
    items.slice(0, 12).forEach(function (r) {
      html += '<div class="event"><span class="when">' + esc(r.date) + '</span> ' +
        '<a href="stories/' + esc(r.hn_id) + '.html">' + esc(r.heading) + '</a>' +
        (r.curated_class ? ' <span class="badge ' + badgeForClass(r.curated_class) + '">' + esc(r.curated_class) + '</span>' : '') +
        '</div>\n';
    });
    if (items.length > 12) {
      html += '<p class="note">+' + (items.length - 12) + ' more records in this decade.</p>\n';
    }
  });
  return html + '</div>\n' +
    '</div>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'timeline.html'), buildTimeline());
// ---------- comparisons page ----------
function buildComparisons() {
  const byClass = {};
  comparisons.forEach(c => { if (!byClass[c.class]) byClass[c.class] = []; byClass[c.class].push(c); });
  const order = ['V', 'R', 'P', 'M', 'F', 'Q'];
  let html = head('Comparisons — Inconsistency Register') +
    '<div class="container">\n' +
    '<h1>Comparisons</h1>\n' +
    '<p class="lead">Substantiated newspaper-to-newspaper differences, reporting revisions, competing explanations, and openly marked unresolved leads. Curated flags (84) are tracked separately from heuristic keyword leads (105) and are never summed into a "confirmed contradiction" count.</p>\n';
  order.forEach(function (cls) {
    const items = byClass[cls] || [];
    if (!items.length) return;
    html += '<div class="comparison">\n' +
      '<h3>' + badgeLabel(cls) + ' <span class="tax-count">(' + items.length + ')</span></h3>\n' +
      '<div class="vs">\n';
    items.forEach(function (c) {
      html += '<div class="side">\n' +
        '<div class="side-head">' + esc(c.hn_id) + ': ' + esc(c.heading) + '</div>\n' +
        '<div class="source">' + esc(c.date) + ' &middot; ' + esc(c.taxonomy_leaf || '(none)') + '</div>\n' +
        '<p>' + renderMd(c.finding) + '</p>\n' +
        (c.assessment ? '<p class="note"><strong>Assessment:</strong> ' + renderMd(c.assessment) + '</p>' : '') +
        '<div class="links" style="margin-top:10px"><a href="stories/' + esc(c.hn_id) + '.html">View record &rarr;</a></div>\n' +
        '</div>\n';
    });
    html += '</div>\n</div>\n';
  });
  return html + '</div>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'comparisons.html'), buildComparisons());
// ---------- about page ----------
function buildAbout() {
  return head('About the Archive — Methodology') +
    '<div class="container">\n' +
    '<h1>About the Archive / Methodology</h1>\n' +
    '<p class="lead">What this collection is, how sources are gathered, the A/B/C evidence language, limitations, corrections, and contact information.</p>\n' +
    '<div class="card">\n' +
    '<h2>What this archive is</h2>\n' +
    '<p>A living, interactive historical newspaper research and discovery archive covering 1777&ndash;2026. The central experience is seeing what newspapers actually printed and how reports evolved across time and publications.</p>\n' +
    '<p>The initial collection contains <strong>1,056 HN research/source records</strong>, not necessarily 1,056 distinct historical events. Multiple HN rows may be separate reporting stages or overlapping records of one event.</p>\n' +
    '</div>\n' +
    '<div class="card">\n' +
    '<h2>Editorial commitments</h2>\n' +
    '<ul>\n' +
    '<li><strong>Newspaper report</strong> means a historical publication made a claim; it does <strong>not</strong> establish that claim as fact.</li>\n' +
    '<li>Separate contemporary reporting, later scholarly/historical context, and our own analytical assessment.</li>\n' +
    '<li>Preserve exact attribution, publication dates, dispatch dates, time zones, numerical units, uncertainty, and later revisions.</li>\n' +
    '<li>Distinguish genuine incompatibility from evolving estimates, changed denominators, attribution disputes, metadata mistakes, and multiple stages of the same event.</li>\n' +
    '<li>Do not frame the collection as evidence of a cover-up or suppression. Avoid sensationalist certainty.</li>\n' +
    '<li>Original scanned articles are the primary visual artifact wherever legitimately available.</li>\n' +
    '</ul>\n' +
    '</div>\n' +
    '<div class="card">\n' +
    '<h2>Evidence language (A / B / C)</h2>\n' +
    '<ul>\n' +
    '<li><strong>A:</strong> Accessible/inspected original article or primary page, as justified by the underlying source report.</li>\n' +
    '<li><strong>B:</strong> Identified dated issue/headline/index or catalog lead, but article content uninspected.</li>\n' +
    '<li><strong>C:</strong> Unresolved candidate, secondary/retrospective context, or ambiguous association.</li>\n' +
    '<li>Early batches use P/I/N naming; those codes are preserved and mapped to A/B/C only after explicit review.</li>\n' +
    '</ul>\n' +
    '</div>\n' +
    '<div class="card">\n' +
    '<h2>Inconsistency classes (V / R / P / M / F / Q)</h2>\n' +
    '<ul>\n' +
    '<li><strong>V:</strong> Printed counts/wordings differ. Requires same-measure attribution and date context before calling it an incompatibility.</li>\n' +
    '<li><strong>R:</strong> Reporting was corrected/retracted/revised. Show the chronology.</li>\n' +
    '<li><strong>P:</strong> Competing accusations, explanations, eyewitness accounts or editorials. Neither side is presumed true.</li>\n' +
    '<li><strong>M:</strong> Metadata/identity/date/place/catalog mismatch; may be source-data error rather than a newspaper contradiction.</li>\n' +
    '<li><strong>F:</strong> Apparently conflicting values measure different things, moments, populations, or denominators; do not label as false reporting.</li>\n' +
    '<li><strong>Q:</strong> Potential divergence mentioned in notes but lacking original-text comparison; remains open.</li>\n' +
    '</ul>\n' +
    '<p class="note">Curated flags (84) and heuristic keyword leads (105) are tracked separately and never summed into a "confirmed contradiction" count.</p>\n' +
    '</div>\n' +
    '<div class="card">\n' +
    '<h2>Source-first media policy</h2>\n' +
    '<p>Authentic article scans/crops are displayed only where acquisition and permitted reuse allow. Where permissions or access are unclear, an external source link is used instead of an unauthorized copied image. No AI-generated images, fabricated archive photos, or altered newspaper typography are used as historical evidence.</p>\n' +
    '</div>\n' +
    '<div class="card">\n' +
    '<h2>Corrections</h2>\n' +
    '<p>Story pages show the most recent reviewed date and distinguish newly added evidence from corrections to prior interpretations. A visible correction/contact route is provided. Historical record and earlier published interpretations are preserved for audit without silently changing source evidence. Private research notes are never exposed in public builds.</p>\n' +
    '<p><strong>No live deployment has been authorized.</strong> A later possible path is darkstarconsultinggroup.com/newspaper-archives, but it is not an established deployment target.</p>\n' +
    '</div>\n' +
    '</div>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'about.html'), buildAbout());

console.log('All pages generated.');
console.log('Homepage, search, taxonomy, timeline, comparisons, about +', records.length, 'detail pages.');
