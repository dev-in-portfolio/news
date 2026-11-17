// Final article-level sweep.
//
// Classifies every cited URL by the archive's own URL grammar and reports
// article-level citations that do not yet have a stored article crop/clip.
// Page-level citations are intentionally excluded: they are covered by the
// page-scan pipelines.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');
const records = rj(ROOT + '/site/data/records.json');
const recArr = Array.isArray(records) ? records : Object.values(records);
const recById = Object.fromEntries(recArr.map(r => [r.hn_id, r]));
const ppLedger = rj(ROOT + '/docs/PAPERSPAST_IMAGE_ACQUISITION_LEDGER.json');
const otherLedger = rj(ROOT + '/docs/OTHER_IMAGE_ACQUISITION_LEDGER.json');
const indianaLedger = rj(ROOT + '/docs/INDIANA_IMAGE_ACQUISITION_LEDGER.json');

function norm(u) {
  return String(u).replace(/&amp;/g, '&').replace(/\/+$/, '');
}
function articleId(u) {
  let m = u.match(/[?&]d=([^&]+)/);
  if (m) return m[1];
  m = u.match(/\/article\/([^/?#]+)/);
  if (m) return m[1];
  m = u.match(/\/newspapers\/([A-Za-z]+\d{8}\.\d+\.\d+(?:\.\d+)?)/);
  if (m) return m[1];
  return null;
}

// Does the record already have a stored crop/clip for this URL/id?
function hasClip(hn, u) {
  const list = images[hn] || [];
  const id = articleId(u);
  for (const i of list) {
    if (!i.crop) continue;
    const pu = norm(i.page_url || '');
    if (pu === u) return true;
    if (id && (pu.includes(id) || String(i.crop).includes(id.replace(/[^a-z0-9]+/gi, '-')))) return true;
  }
  // Papers Past ledger keys are hn|url.
  if (ppLedger.items && ppLedger.items[hn + '|' + u] && ppLedger.items[hn + '|' + u].status === 'image_acquired') return true;
  if (otherLedger.items && otherLedger.items[hn + '|' + u] && otherLedger.items[hn + '|' + u].status === 'image_acquired') return true;
  return false;
}

function classify(u) {
  const host = new URL(u).hostname.replace(/^www\./, '');

  // Veridian-style citations: ?a=d&d=<doc>.<page>.<section>[.<block>]
  // For Indiana the second number is the edition: 1 = page-level, 2+ = article.
  // For other Veridian hosts the second number is the page: 1 = page-level,
  // 2+ = article. A fourth number is always an article block index.
  if (/[?&]d=/.test(u)) {
    const m = u.match(/[?&]d=([^&]+)/);
    if (m) {
      const parts = m[1].split('.');
      if (parts.length >= 3) {
        const second = Number(parts[1]);
        const hasBlock = parts.length >= 4;
        if (second >= 2 || hasBlock) {
          return { level: 'article', host, kind: host.includes('indiana') ? 'indiana' : 'veridian', id: m[1] };
        }
      }
    }
  }

  if (/paperspast\.natlib\.govt\.nz\/newspapers\/[A-Za-z]+\d{8}\.\d+\.\d+/.test(u)) {
    return { level: 'article', host, kind: 'paperspast', id: articleId(u) };
  }
  if (/nli\.org\.il\/[^?#]*\/article\/\d+\.\d+/.test(u)) {
    return { level: 'article', host, kind: 'nli', id: articleId(u) };
  }
  if (/eresources\.nlb\.gov\.sg\/newspapers\/digitised\/article\//.test(u)) {
    return { level: 'article', host, kind: 'newspapersg', id: articleId(u) };
  }
  if (/trove\.nla\.gov\.au\/(?:newspaper\/)?article\//.test(u)) {
    return { level: 'article', host, kind: 'trove', id: articleId(u) };
  }
  if (/newspapers\.com\/article\//.test(u)) {
    return { level: 'article', host, kind: 'newspapers_com', id: articleId(u) };
  }
  return { level: 'page', host, kind: 'page', id: articleId(u) };
}

const rows = [];
for (const [hn, list] of Object.entries(urls)) {
  for (const raw of list || []) {
    const u = norm(raw);
    let c;
    try { c = classify(u); } catch (e) { continue; }
    if (c.level !== 'article') continue;
    rows.push({ hn, u, ...c, covered: hasClip(hn, u) });
  }
}

const byKind = {};
for (const r of rows) {
  byKind[r.kind] = byKind[r.kind] || { total: 0, covered: 0, missing: [] };
  byKind[r.kind].total++;
  if (r.covered) byKind[r.kind].covered++;
  else byKind[r.kind].missing.push(r);
}
console.log('ARTICLE-LEVEL CITATIONS');
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${k}: cited=${v.total} covered=${v.covered} missing=${v.missing.length}`);
}
const missing = rows.filter(r => !r.covered);
console.log('\nMISSING ARTICLE CLIPS: ' + missing.length);
for (const r of missing) {
  const rec = recById[r.hn] || {};
  console.log(`  ${r.hn}  ${r.kind}  ${(rec.heading || '').slice(0, 60)}`);
  console.log(`       ${r.u}`);
}
