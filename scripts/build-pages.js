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

// Optional: acquired original page scans
let imagesByHn = {};
try { imagesByHn = readJson(path.join(DATA, 'images.json')); } catch (e) { imagesByHn = {}; }

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
function imageKind(im) {
  const isCrop = !!im.crop;
  const isArticleClip = isCrop && im.crop_method === 'archive_article_blocks_native';
  const isClipping = isCrop && im.crop_method === 'archive_clipping_image';
  const isMosaic = !isCrop && im.mosaic_method === 'openseadragon_tiles_256';
  const isPageImage = !isCrop && im.mosaic_method === 'archive_page_rendition';
  const isPdfPage = !isCrop && im.mosaic_method === 'archive_pdf_page_rendition';
  const isPreview = !isCrop && im.mosaic_method === 'archive_page_preview';
  return isArticleClip ? 'article clip'
    : (isClipping ? 'archive clipping'
      : (isCrop ? 'article crop'
        : (isMosaic ? 'page image (archive tiles)'
          : (isPdfPage ? 'page image (issue PDF)'
            : (isPreview ? 'page image (low-resolution preview)'
              : (isPageImage ? 'page image' : 'page scan'))))));
}
// Pick the image that best represents a record. Page scans show the masthead
// and are the strongest visual; a specific filename can override the choice.
function pickImage(hn, opts) {
  const imgs = imagesByHn[hn] || [];
  if (!imgs.length) return null;
  opts = opts || {};
  if (opts.filename) {
    const wanted = imgs.find(function (im) {
      return [im.crop, im.full_page].filter(Boolean).some(function (src) { return src.indexOf(opts.filename) !== -1; });
    });
    if (wanted) return wanted;
  }
  if (opts.prefer === 'crop') return imgs.find(function (im) { return im.crop; }) || imgs[0];
  return imgs.find(function (im) { return im.full_page; }) || imgs[0];
}
function pickSrc(im, preferFull) {
  if (!im) return '';
  return (preferFull && im.full_page) ? im.full_page : (im.crop || im.full_page || '');
}
function displayName(im) {
  if (!im) return 'Newspaper';
  let n = String(im.newspaper || '').trim();
  // Some acquired images carry placeholder or concatenated metadata
  // ("A —", "Republican 31 July 1916 $25"). Fall back to the provider.
  const junk = !n || n.length <= 3 || /^A\s*[\u2014\u2013-]?$/.test(n);
  if (!junk) {
    n = n.replace(/\s+\d{1,2}\s+[A-Z][a-z]+\s+\d{4}\b.*$/, '').trim();
    if (n) return n;
  }
  const prov = String(im.provider || '').split('(')[0].trim();
  if (prov) return prov;
  return im.lccn ? 'LCCN ' + im.lccn : 'Newspaper';
}
function imageCaption(im) {
  if (!im) return '';
  return displayName(im) + (im.issue_date ? ', ' + im.issue_date : '') + ' — ' + imageKind(im);
}
function heroAlt(im) {
  if (!im) return 'Archive newspaper page scan';
  return 'Archive page scan of ' + displayName(im) + (im.issue_date ? ', ' + im.issue_date : '');
}
function collageItem(im, hnLabel, deskClass) {
  if (!im) return '';
  const src = pickSrc(im, true);
  if (!src) return '';
  return '<div class="desk-item ' + deskClass + '">\n' +
    '<img src="/' + esc(src) + '" alt="' + esc(heroAlt(im)) + '">\n' +
    '<span class="desk-tag">' + esc(hnLabel) + '</span>\n' +
    '</div>\n';
}
function assetCount() {
  const seen = new Set();
  Object.keys(imagesByHn).forEach(function (hn) {
    (imagesByHn[hn] || []).forEach(function (im) {
      [im.crop, im.full_page].filter(Boolean).forEach(function (src) { seen.add(src); });
    });
  });
  return seen.size;
}
// Compact index of one image per record, used for search-result thumbnails.
const thumbMap = {};
Object.keys(imagesByHn).forEach(function (hn) {
  const im = pickImage(hn, { prefer: 'full' });
  if (!im) return;
  thumbMap[hn] = {
    src: pickSrc(im, true),
    newspaper: im.newspaper || '',
    date: im.issue_date || '',
    kind: imageKind(im),
    provider: im.provider || ''
  };
});
fs.writeFileSync(path.join(DATA, 'thumbs.json'), JSON.stringify(thumbMap, null, 2));

// ---------- shared shell ----------
function head(title) {
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="theme-color" content="#15130f">\n<title>' + esc(title) + ' — Historical Newspaper Archives</title>\n<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">\n<link rel="stylesheet" href="../assets/style.css">\n</head>\n<body>\n<a class="skip-link" href="#main">Skip to content</a>\n<header class="site-header">\n  <div class="header-inner">\n    <a class="brand" href="/">Historical Newspaper Archives<em></em></a>\n    <nav class="nav" aria-label="Primary">\n      <a href="/">Home</a>\n      <a href="/search.html">All Stories</a>\n      <a href="/taxonomy.html">Categories</a>\n      <a href="/timeline.html">Timeline</a>\n      <a href="/comparisons.html">Comparisons</a>\n      <a href="/about.html">Methodology</a>\n    </nav>\n  </div>\n</header>\n';
}
function foot() {
  return '<footer class="site-footer">\n' +
    '<div class="footer-inner">\n' +
    '<div class="footer-brand-col">\n' +
    '<div class="footer-brand">Historical Newspaper Archives</div>\n' +
    '<p>An evidence-aware archive of what newspapers actually printed, 1777&ndash;2026. Reports are presented as historical claims, not established fact.</p>\n' +
    '</div>\n' +
    '<div class="footer-col"><h4>Explore</h4>\n' +
    '<a href="/search.html">All stories</a>\n' +
    '<a href="/taxonomy.html">Categories</a>\n' +
    '<a href="/timeline.html">Timeline</a>\n' +
    '<a href="/comparisons.html">Comparisons</a>\n' +
    '</div>\n' +
    '<div class="footer-col"><h4>About</h4>\n' +
    '<a href="/about.html">Methodology</a>\n' +
    '<a href="/about.html#media">Image standards</a>\n' +
    '<a href="/about.html#evidence">Evidence notes</a>\n' +
    '</div>\n' +
    '</div>\n' +
    '<div class="footer-base"><span>Source URLs preserved verbatim from the HN seed queue.</span><span>No original source files modified.</span></div>\n' +
    '</footer>\n' +
    '<script src="../assets/app.js"></script>\n</body>\n</html>\n';
}
// ---------- homepage ----------
function buildHomepage() {
  const refStoryMap = {
    'HN-403': 'hn-403-black-tom.html',
    'HN-753': 'hn-753-mexico-city.html',
    'HN-894': 'hn-894-sago-mine.html'
  };
  const featured = ['HN-403', 'HN-753', 'HN-894']
    .map(function (id) { return records.find(function (r) { return r.hn_id === id; }); })
    .filter(Boolean);
  const featuredHtml = featured.map(function (r) {
    const im = pickImage(r.hn_id, { prefer: 'full' });
    const src = pickSrc(im, true);
    const refFile = refStoryMap[r.hn_id] || (r.hn_id + '.html');
    const finding = renderMd(r.recorded_finding || r.discovery_body || '');
    return '<article class="story-card">\n' +
      (src ? '<a class="story-media" href="stories/' + esc(refFile) + '" tabindex="-1" aria-hidden="true">' +
        '<img src="/' + esc(src) + '" alt="" loading="lazy" decoding="async">' +
        '<span class="story-media-tag">' + esc(displayName(im)) + '</span></a>' : '') +
      '<div class="story-body">\n' +
      '<p class="story-kicker">' + esc(r.date) + ' <span aria-hidden="true">/</span> ' + esc(r.taxonomy.root) + '</p>\n' +
      '<h3><a href="stories/' + esc(refFile) + '">' + esc(r.hn_id) + ': ' + esc(r.heading) + '</a></h3>\n' +
      '<div class="story-badges">' + tierBadge(r.evidence_tier) + curBadge(r.curated_class) + '</div>\n' +
      '<div class="story-dek">' + finding + '</div>\n' +
      '<a class="story-link" href="stories/' + esc(refFile) + '">Read the record <span aria-hidden="true">&rarr;</span></a>\n' +
      '</div>\n</article>';
  }).join('\n');

  const heroIm = pickImage('HN-645', { filename: 'shapell-dallas-morning-news', prefer: 'full' }) || pickImage('HN-645');
  const heroSrc = pickSrc(heroIm, true);
  const heroCaption = imageCaption(heroIm);

  // One image from eight different decades, so the range is visible at a glance.
  const decadeTargets = [1770, 1830, 1890, 1910, 1930, 1950, 1970, 2000];
  const used = new Set(['HN-403', 'HN-753', 'HN-894', 'HN-645']);
  const mosaic = [];
  decadeTargets.forEach(function (decade) {
    const candidates = records.filter(function (r) {
      const m = String(r.date).match(/\d{4}/);
      const y = m ? parseInt(m[0], 10) : 0;
      return y >= decade && y < decade + 10 && !used.has(r.hn_id) && (imagesByHn[r.hn_id] || []).length;
    });
    const chosen = candidates.find(function (r) { return (imagesByHn[r.hn_id] || []).some(function (im) { return im.full_page; }); }) || candidates[0];
    if (!chosen) return;
    used.add(chosen.hn_id);
    const im = pickImage(chosen.hn_id, { prefer: 'full' });
    const src = pickSrc(im, true);
    if (!src) return;
    mosaic.push({ r: chosen, im: im, src: src });
  });
  const mosaicHtml = mosaic.map(function (item, i) {
    return '<a class="mosaic-item mosaic-item-' + (i + 1) + '" href="stories/' + esc(item.r.hn_id) + '.html">' +
      '<img src="/' + esc(item.src) + '" alt="" loading="lazy" decoding="async">' +
      '<span><strong>' + esc(item.r.date) + '</strong> ' + esc(item.r.taxonomy.root) + '</span></a>';
  }).join('\n');

  const categoryHtml = taxonomy.map(function (root) {
    const count = root.subs.reduce(function (sum, sub) {
      return sum + sub.leaves.reduce(function (n, leaf) { return n + leaf.count; }, 0);
    }, 0);
    return '<a class="category-tile" href="search.html?q=' + encodeURIComponent(root.root) + '">' +
      '<span class="category-count">' + count + '</span>' +
      '<span class="category-name">' + esc(root.root) + '</span>' +
      '<span class="category-arrow" aria-hidden="true">&rarr;</span></a>';
  }).join('\n');

  const illustrated = Object.keys(imagesByHn).filter(function (hn) { return (imagesByHn[hn] || []).length; }).length;
  const assets = assetCount();

  return head('Home') +
    '<main id="main" class="home">\n' +
    '<section class="home-hero">\n' +
    '<div class="hero-copy">\n' +
    '<p class="eyebrow">Independent newspaper archive <span aria-hidden="true">/</span> 1777&ndash;2026</p>\n' +
    '<h1>What the papers<br><em>actually printed.</em></h1>\n' +
    '<p class="hero-dek">Unusual, forgotten, consequential and disputed reporting, preserved with its original citation and paired with authentic archive scans. A newspaper report records what a publication printed &mdash; not proof that its claim was true.</p>\n' +
    '<form class="hero-search" action="/search.html" method="get" role="search">\n' +
    '<label class="visually-hidden" for="search-input">Search the archive</label>\n' +
    '<input type="search" id="search-input" class="js-search-input" name="q" placeholder="Search a person, place or year&hellip;" autocomplete="off">\n' +
    '<button type="submit">Search</button>\n' +
    '</form>\n' +
    '<div class="hero-actions"><a href="/search.html">Browse all 1,056 records</a><a href="/about.html">How the archive works</a></div>\n' +
    '</div>\n' +
    (heroSrc ? '<figure class="hero-visual">\n' +
      '<div class="hero-collage">\n' +
      collageItem(heroIm, 'HN-645', 'desk-1') +
      collageItem(pickImage('HN-403', { prefer: 'full' }), 'HN-403', 'desk-2') +
      collageItem(pickImage('HN-753', { prefer: 'full' }), 'HN-753', 'desk-3') +
      collageItem(pickImage('HN-894', { prefer: 'full' }), 'HN-894', 'desk-4') +
      '</div>\n' +
      '<div class="ink-blot ink-1"></div>\n' +
      '<div class="ink-blot ink-2"></div>\n' +
      '<div class="ink-blot ink-3"></div>\n' +
      '<div class="press-stamp" aria-hidden="true">PRESS</div>\n' +
      '<figcaption>Four records, four scans &mdash; authentic archive pages, not screenshots. Open a record to see the full scan.</figcaption>\n' +
      '</figure>\n' : '') +
    '</section>\n' +
    '<div class="hero-ledger stat-grid">\n' +
    '<div class="ledger-item"><strong>' + stats.total.toLocaleString('en-US') + '</strong><span>research records</span></div>\n' +
    '<div class="ledger-item"><strong>' + stats.curated.toLocaleString('en-US') + '</strong><span>curated revision flags</span></div>\n' +
    '<div class="ledger-item"><strong>' + stats.heuristic.toLocaleString('en-US') + '</strong><span>heuristic keyword leads</span></div>\n' +
    '<div class="ledger-item"><strong>' + stats.indexedOnly.toLocaleString('en-US') + '</strong><span>indexed only</span></div>\n' +
    '</div>\n' +
    '<section class="home-section">\n' +
    '<div class="section-head"><div><p class="eyebrow">Selected records</p><h2>Featured stories</h2></div><a class="section-link" href="/search.html">All stories <span aria-hidden="true">&rarr;</span></a></div>\n' +
    '<p class="section-dek">Three records with full editorial treatment: source comparison, reporting chronology, and the original scans side by side.</p>\n' +
    '<div class="story-grid">' + featuredHtml + '</div>\n' +
    '</section>\n' +
    '<section class="home-section">\n' +
    '<div class="section-head"><div><p class="eyebrow">1777&ndash;2026</p><h2>Across the decades</h2></div><a class="section-link" href="/timeline.html">Open timeline <span aria-hidden="true">&rarr;</span></a></div>\n' +
    '<p class="section-dek">' + illustrated.toLocaleString('en-US') + ' of the ' + stats.total.toLocaleString('en-US') + ' records carry at least one authentic archive scan &mdash; ' + assets.toLocaleString('en-US') + ' image assets in all. One page from each decade below; open a scan to see the record it belongs to.</p>\n' +
    '<div class="mosaic">' + mosaicHtml + '</div>\n' +
    '</section>\n' +
    '<section class="home-section">\n' +
    '<div class="section-head"><div><p class="eyebrow">13 categories</p><h2>Browse the archive</h2></div><a class="section-link" href="/taxonomy.html">Full taxonomy <span aria-hidden="true">&rarr;</span></a></div>\n' +
    '<div class="category-grid">' + categoryHtml + '</div>\n' +
    '</section>\n' +
    '<section class="home-section home-search-section" id="search">\n' +
    '<div class="section-head"><div><p class="eyebrow">The catalog</p><h2>Search 1,056 records</h2></div></div>\n' +
    '<form class="catalog-search" action="/search.html" method="get" role="search">\n' +
    '<label class="visually-hidden" for="search-input-bottom">Search the catalog</label>\n' +
    '<input type="search" id="search-input-bottom" class="js-search-input" name="q" placeholder="Try a newspaper, a year, a person, or an HN number&hellip;" autocomplete="off">\n' +
    '<button type="submit">Search</button>\n' +
    '</form>\n' +
    '<div class="search-status"><span id="count-label">records in index</span> <strong id="result-count">' + stats.total + '</strong></div>\n' +
    '<div id="results" class="results-list"></div>\n' +
    '</section>\n' +
    '</main>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'index.html'), buildHomepage());
// ---------- detail pages ----------
const storiesDir = path.join(SITE, 'stories');
fs.mkdirSync(storiesDir, { recursive: true });

function detailLead(hn) {
  const im = pickImage(hn, { prefer: 'full' });
  if (!im) return '';
  const src = pickSrc(im, true);
  if (!src) return '';
  // Skip low-resolution renditions; a stretched banner would look worse than none.
  const dims = String(im.dimensions || '').split('x').map(Number);
  if (dims[0] && dims[0] < 800) return '';
  if (im.mosaic_method === 'archive_page_preview') return '';
  const label = displayName(im);
  const kindText = (im.crop && src === im.crop)
    ? imageKind(im)
    : imageKind(Object.assign({}, im, { crop: null }));
  const total = (imagesByHn[hn] || []).length;
  return '<figure class="detail-lead">\n' +
    '<a class="detail-lead-link" href="../' + esc(src) + '" data-lightbox data-caption="' + esc(imageCaption(im)) + '">\n' +
    '<img src="../' + esc(src) + '" alt="' + esc(label + ', ' + im.issue_date + ' — ' + kindText) + '">\n' +
    '<span class="detail-lead-label">' + esc(kindText) + '</span>\n' +
    '</a>\n' +
    '<figcaption><span><strong>' + esc(label) + '</strong> &middot; ' + esc(im.issue_date) + ' &middot; ' + esc(kindText) + '</span>' +
    '<span class="detail-lead-more">' + total + ' archive image' + (total === 1 ? '' : 's') + '</span></figcaption>\n' +
    '</figure>\n';
}

function imagesCard(hn) {
  const imgs = imagesByHn[hn];
  if (!imgs || !imgs.length) return '';
  const providers = [...new Set(imgs.map(i => i.provider).filter(Boolean))];
  const providerText = providers.length > 1
    ? providers.slice(0, -1).join(', ') + ' and ' + providers[providers.length - 1]
    : (providers[0] || 'the archive');
  const figures = imgs.map(function (im) {
    const label = displayName(im);
    const isCrop = !!im.crop;
    const isArticleClip = isCrop && im.crop_method === 'archive_article_blocks_native';
    const isClipping = isCrop && im.crop_method === 'archive_clipping_image';
    const src = isCrop ? im.crop : im.full_page;
    const kindText = imageKind(im);
    const linkText = isCrop
      ? 'Open full-resolution ' + (isArticleClip ? 'clip' : (isClipping ? 'clipping' : 'crop'))
      : 'Open larger view';
    const pageLink = (isCrop && im.full_page)
      ? '<a href="../' + esc(im.full_page) + '" target="_blank" rel="noopener">Page scan</a> &middot; '
      : '';
    const alt = label + ', ' + im.issue_date + ' - ' + kindText;
    return '<figure class="scan ' + (isCrop ? 'scan-crop' : 'scan-page') + '">\n' +
      '<div class="scan-frame"><a class="scan-open" href="../' + esc(src) + '" data-lightbox data-caption="' + esc(imageCaption(im)) + '">' +
      '<img src="../' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy">' +
      '<span class="scan-open-label">View full scan</span></a></div>\n' +
      '<figcaption><strong>' + esc(label) + '</strong> &middot; ' + esc(im.issue_date) + ' &middot; image ' + im.sequence +
      ' &mdash; ' + kindText +
      '<br><span class="scan-provider">' + esc(im.provider || '') + '</span><br>' +
      '<a href="../' + esc(src) + '" target="_blank" rel="noopener">' + linkText + '</a> &middot; ' +
      pageLink +
      '<a href="' + esc(im.page_url) + '" target="_blank" rel="noopener">Archive viewer (full resolution)</a></figcaption>\n' +
      '</figure>';
  }).join('\n');
  return '<div class="card">\n' +
    '<h3>Original archive images (' + imgs.length + ')</h3>\n' +
    '<p class="note">Authentic images retrieved from ' + esc(providerText) +
    '. Article crops are located using the archive\'s own OCR word coordinates and rendered at native crop resolution; article clips are assembled from the archive\'s own article-block images; page images marked "archive tiles" are stitched from the archive\'s own tiled page service at its 256-px tile cap; page images marked "issue PDF" are single pages rasterised from the archive\'s own issue PDF, with the page chosen by matching the headline against the PDF\'s text layer; page scans are reduced-size access renditions. No images were generated, mocked, or retouched.</p>\n' +
    '<div class="scan-grid">' + figures + '</div>\n' +
    '</div>\n';
}

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

  // The manifest is a milestone-3 feasibility snapshot recorded before any
  // images existed. Every record that now has images is still marked "untried"
  // there, so showing that status would contradict the scans displayed above.
  // Report the actual current state instead; keep the manifest status only as
  // historical context on records that genuinely have no acquired image.
  const hasImages = !!(imagesByHn[r.hn_id] || []).length;
  const acquisitionHtml = hasImages ?
    '<div class="card">\n' +
    '<h3>Source acquisition</h3>\n' +
    '<p><strong>Status:</strong> <span class="badge status-verified">Archive images acquired</span></p>\n' +
    '<p>Authentic archive-owned image renditions were retrieved for this record and are displayed above. The <a href="comparisons.html">source-acquisition manifest</a> preserves the original pre-acquisition feasibility assessment.</p>\n' +
    '</div>' :
    (acquisition !== 'untried' ?
      '<div class="card">\n' +
      '<h3>Source acquisition</h3>\n' +
      '<p><strong>Provider:</strong> ' + esc(provider) + '</p>\n' +
      '<p><strong>Status:</strong> <span class="badge status-' + (acquisition.includes('blocked') ? 'blocked' : (acquisition.includes('verified') ? 'verified' : 'link')) + '">' + esc(acquisition) + '</span></p>\n' +
      (failure ? '<p><strong>Note:</strong> ' + esc(failure) + '</p>' : '') +
      (nextAction ? '<p><strong>Next action:</strong> ' + esc(nextAction) + '</p>' : '') +
      '</div>' :
      '<div class="card note">\n' +
      '<h3>Source acquisition</h3>\n' +
      '<p>No archive-owned image was obtainable for this record under the project\'s access and reuse rules. The original citation is preserved verbatim below (see <a href="comparisons.html">source-acquisition manifest</a>).</p>\n' +
      '</div>');

  return head(r.hn_id + ': ' + r.heading) +
    '<main id="main" class="container detail-page">\n' +
    '<div class="detail-head">\n' +
    '<h1>' + esc(r.hn_id) + ': ' + esc(r.heading) + '</h1>\n' +
    '<div class="badges-row">' + tierBadge(r.evidence_tier) + curBadge(r.curated_class) + '\n' +
    '<span class="badge status-link">External source link</span>\n' +
    '</div>\n' +
    '</div>\n' +
    '<p class="tagline"><strong>' + esc(r.hn_id) + '</strong> &middot; ' + esc(r.date) + ' &middot; ' +
    taxBread + '</p>\n' +
    '<div class="meta-grid">\n' +
    '<div class="meta-item"><div class="lbl">Seed heading</div><div>' + esc(r.heading) + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Seed publication date</div><div>' + esc(r.date) + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Taxonomy (root &gt; sub &gt; leaf)</div><div>' + taxBread + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Decision status</div><div>' + esc(r.decision_status) + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Reconciliation category</div><div>' + esc(r.recon_category.replace(/_/g, ' ')) + '</div></div>\n' +
    '<div class="meta-item"><div class="lbl">Batch-report entries</div><div>' + r.batch_count + '</div></div>\n' +
    '</div>\n' +
    detailLead(r.hn_id) +
    '<div class="card">\n' +
    '<h3>Recorded finding</h3>\n' +
    '<p>' + renderMd(r.recorded_finding) + '</p>\n' +
    (r.discovery_body ? '<h4>Discovery narrative</h4>\n<p class="discovery-body">' + renderMd(r.discovery_body) + '</p>' : '') +
    peersHtml +
    '</div>\n' +
    auditHtml +
    imagesCard(r.hn_id) +
    acquisitionHtml +
    '<div class="card">\n' +
    '<h3>Original seed</h3>\n' +
    '<p><strong>URL (preserved verbatim):</strong> <a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" class="external">' + esc(r.url) + '</a></p>\n' +
    '<p><strong>Saved research report:</strong> ' + esc(r.report) + '</p>\n' +
    '<p class="note"><strong>Evidence note:</strong> A newspaper report means a historical publication made a claim; it does not establish that claim as fact. Contemporary reporting is separated from later scholarly context and our own assessment.</p>\n' +
    '</div>\n' +
    '<div class="back-top"><a href="#main">Back to top &uarr;</a></div>\n' +
    '</main>\n' +
    foot();
}
records.forEach(function (r) {
  fs.writeFileSync(path.join(storiesDir, r.hn_id + '.html'), buildDetail(r));
});
console.log('Detail pages generated:', records.length);
// ---------- search page ----------
function buildSearch() {
  return head('All Stories — Searchable Catalog') +
    '<main id="main" class="container">\n' +
    '<section class="page-intro">\n' +
    '<p class="eyebrow">The complete catalog</p>\n' +
    '<h1>All stories</h1>\n' +
    '<p class="lead">Search and filter all <strong>' + stats.total + '</strong> research records by event, newspaper, person, place, year, claim, headline, or HN number. Newspaper reports record what publications printed; they do not establish claims as fact.</p>\n' +
    '<form class="catalog-search" action="/search.html" method="get" role="search">\n' +
    '<label class="visually-hidden" for="search-input">Search the archive</label>\n' +
    '<input type="search" id="search-input" class="js-search-input" name="q" placeholder="Search a person, place, year, newspaper or headline&hellip;" autocomplete="off" autofocus>\n' +
    '<button type="submit">Search</button>\n' +
    '</form>\n' +
    '<div class="search-status"><span id="count-label">records in index</span> <strong id="result-count">' + stats.total + '</strong></div>\n' +
    '</section>\n' +
    '<div id="results" class="results-list"></div>\n' +
    '</main>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'search.html'), buildSearch());
// ---------- taxonomy page ----------
function buildTaxonomy() {
  let html = head('Categories — Locked Taxonomy') +
    '<main id="main" class="container">\n' +
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
  return html + '</main>\n' +
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
    '<main id="main" class="container">\n' +
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
    '</main>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'timeline.html'), buildTimeline());
// ---------- comparisons page ----------
function buildComparisons() {
  const byClass = {};
  comparisons.forEach(c => { if (!byClass[c.class]) byClass[c.class] = []; byClass[c.class].push(c); });
  const order = ['V', 'R', 'P', 'M', 'F', 'Q'];
  let html = head('Comparisons — Inconsistency Register') +
    '<main id="main" class="container">\n' +
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
  return html + '</main>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'comparisons.html'), buildComparisons());
// ---------- about page ----------
function buildAbout() {
  return head('About the Archive — Methodology') +
    '<main id="main" class="container">\n' +
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
    '<div class="card" id="evidence">\n' +
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
    '<div class="card" id="media">\n' +
    '<h2>Source-first media policy</h2>\n' +
    '<p>Authentic article scans/crops are displayed only where acquisition and permitted reuse allow. Where permissions or access are unclear, an external source link is used instead of an unauthorized copied image. No AI-generated images, fabricated archive photos, or altered newspaper typography are used as historical evidence.</p>\n' +
    '</div>\n' +
    '<div class="card">\n' +
    '<h2>Corrections</h2>\n' +
    '<p>Story pages show the most recent reviewed date and distinguish newly added evidence from corrections to prior interpretations. A visible correction/contact route is provided. Historical record and earlier published interpretations are preserved for audit without silently changing source evidence. Private research notes are never exposed in public builds.</p>\n' +
    '<p><strong>No live deployment has been authorized.</strong> A later possible path is darkstarconsultinggroup.com/newspaper-archives, but it is not an established deployment target.</p>\n' +
    '</div>\n' +
    '</main>\n' +
    foot();
}
fs.writeFileSync(path.join(SITE, 'about.html'), buildAbout());

console.log('All pages generated.');
console.log('Homepage, search, taxonomy, timeline, comparisons, about +', records.length, 'detail pages.');
