// ============================================================================
// Milestone 7 — Verification and polish (corrected)
// End-to-end verification of the Historical Newspaper Archives static site.
// ============================================================================
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SITE = 'D:/news/site';
const DOCS = 'D:/news/docs';
const RESULTS = [];

function check(name, condition, detail = '') {
  RESULTS.push({ name, pass: Boolean(condition), detail });
  console.log((condition ? 'PASS' : 'FAIL') + ': ' + name + (detail ? ' — ' + detail : ''));
}

function readJsonBom(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function unescapeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ---------- 1. Detail pages exist (1,056 HN + 3 reference) ----------
const storiesDir = path.join(SITE, 'stories');
const storyFiles = fs.readdirSync(storiesDir).filter(f => f.endsWith('.html'));
const hnPages = storyFiles.filter(f => /^HN-\d{3,4}\.html$/.test(f));
const refPages = storyFiles.filter(f => /^hn-\d+-.+\.html$/.test(f));
check('1,056 HN detail pages exist', hnPages.length === 1056, `found ${hnPages.length}`);
check('3 reference story pages exist', refPages.length === 3, `found ${refPages.length}: ${refPages.join(', ')}`);
check('Total story pages = 1,059', storyFiles.length === 1059, `found ${storyFiles.length}`);

// ---------- 2. Each HN detail page has required elements ----------
let detailFailures = 0;
for (const f of hnPages) {
  const content = fs.readFileSync(path.join(storiesDir, f), 'utf8');
  const checks = {
    h1: content.includes('<h1>'),
    tierBadge: /badge tier-/.test(content),
    taxonomyBreadcrumb: content.includes('&gt;'),
    verbatimSeedUrl: content.includes('preserved verbatim'),
    backToTop: content.includes('Back to top'),
  };
  const failed = Object.entries(checks).filter(([, v]) => !v);
  if (failed.length > 0) {
    detailFailures++;
    if (detailFailures <= 5) console.log('  FAIL detail content: ' + f + ' missing ' + failed.map(([k]) => k).join(', '));
  }
}
check('All 1,056 detail pages have required elements', detailFailures === 0, `${detailFailures} pages failed`);

// Spot-check the three reference stories
for (const id of ['hn-403-black-tom', 'hn-753-mexico-city', 'hn-894-sago-mine']) {
  const content = fs.readFileSync(path.join(storiesDir, id + '.html'), 'utf8');
  check(id + ' detail page loads', content.includes('<h1>'), '');
  check(id + ' has evidence tier', /badge tier-/.test(content), '');
  check(id + ' has acquisition card', content.includes('Source acquisition'), '');
  check(id + ' has canonical link', content.includes('rel="canonical"'), '');
}

// ---------- 3. Homepage ----------
const home = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
check('Homepage has stat grid', home.includes('stat-grid'), '');
check('Homepage shows 1,056 records', /1,?056/.test(home), '');
check('Homepage shows 84 curated flags', /84/.test(home), '');
check('Homepage shows 105 heuristic leads', /105/.test(home), '');
check('Homepage shows 867 indexed-only', /867/.test(home), '');
check('Homepage links to all 3 reference stories', ['hn-403-black-tom', 'hn-753-mexico-city', 'hn-894-sago-mine'].every(id => home.includes('stories/' + id + '.html')), '');
check('Homepage has search input', home.includes('id="search-input"'), '');
check('Homepage links to taxonomy', home.includes('taxonomy.html'), '');

// ---------- 4. Search page ----------
const search = fs.readFileSync(path.join(SITE, 'search.html'), 'utf8');
check('Search page has search input', search.includes('id="search-input"'), '');
check('Search page has results container', search.includes('id="results"'), '');
check('Search page loads app.js (fetches search.json)', search.includes('app.js'), '');

// ---------- 5. Taxonomy page ----------
const tax = fs.readFileSync(path.join(SITE, 'taxonomy.html'), 'utf8');
const taxData = readJsonBom(path.join(SITE, 'data', 'taxonomy.json'));
check('Taxonomy page has 13 roots', taxData.length === 13, `found ${taxData.length}`);
const unescapedTax = unescapeHtml(tax);
check('Taxonomy page renders all root names', taxData.every(r => unescapedTax.includes(r.root)), '');
check('Taxonomy page has collapse script', tax.includes('toggleTax'), '');

// ---------- 6. Comparisons page ----------
const comp = fs.readFileSync(path.join(SITE, 'comparisons.html'), 'utf8');
const compData = readJsonBom(path.join(SITE, 'data', 'comparisons.json'));
check('Comparisons page has 84 flags', compData.length === 84, `found ${compData.length}`);
const classNames = ['Printed differences', 'Revision/retraction', 'Competing accounts', 'Metadata/identity', 'Different measures', 'Unverified lead'];
check('Comparisons page grouped by all 6 classes', classNames.every(c => comp.includes(c)), '');
check('Comparisons page links to detail pages', compData.every(c => comp.includes('stories/' + c.hn_id + '.html')), '');

// ---------- 7. Timeline page ----------
const tl = fs.readFileSync(path.join(SITE, 'timeline.html'), 'utf8');
check('Timeline page has decade headings', /\d\d0s/.test(tl), '');
check('Timeline page links to detail pages', tl.includes('stories/HN-'), '');

// ---------- 8. About page ----------
const about = fs.readFileSync(path.join(SITE, 'about.html'), 'utf8');
check('About page has evidence language', about.includes('A / B / C') || about.includes('Evidence tier'), '');
check('About page has inconsistency classes', about.includes('Printed differences') || about.includes('V / R / P / M / F / Q'), '');

// ---------- 9. Internal link integrity ----------
const internalLinkRe = /href="([^"]+\.html)"/g;
const allHtml = fs.readdirSync(SITE).filter(f => f.endsWith('.html'));
const storyHtml = fs.readdirSync(storiesDir).filter(f => f.endsWith('.html'));
const existingPages = new Set([...allHtml, ...storyHtml.map(f => 'stories/' + f)]);
const brokenLinks = [];
let totalLinks = 0;
function scanFile(filePath, baseDir) {
  const content = fs.readFileSync(path.join(baseDir, filePath), 'utf8');
  let m;
  while ((m = internalLinkRe.exec(content)) !== null) {
    totalLinks++;
    let target = m[1];
    if (target.startsWith('http')) continue;
    target = target.replace(/^\//, ''); // strip leading slash for absolute-path links
    if (!existingPages.has(target)) {
      brokenLinks.push({ file: baseDir + '/' + filePath, target });
    }
  }
}
for (const f of allHtml) scanFile(f, SITE);
for (const f of storyHtml) scanFile(f, storiesDir);
check('No broken internal page links', brokenLinks.length === 0, `${brokenLinks.length} broken (${totalLinks} total links checked)`);
if (brokenLinks.length > 0) brokenLinks.forEach(b => console.log('  BROKEN: ' + b.file + ' -> ' + b.target));

// ---------- 10. Re-import idempotence ----------
const dataJsonBefore = fs.readFileSync(path.join(SITE, 'data', 'records.json'), 'utf8');
try {
  execSync('node scripts/build-data.js', { cwd: 'D:/news', stdio: 'pipe' });
  const dataJsonAfter = fs.readFileSync(path.join(SITE, 'data', 'records.json'), 'utf8');
  check('Re-import idempotent (records.json unchanged)', dataJsonBefore === dataJsonAfter, '');
} catch (e) {
  check('Re-import idempotent', false, e.message);
}

// ---------- 11. Public/private content separation ----------
const privateMarkers = ['private note', 'internal only', 'not for publication', 'research notes'];
let publicLeaks = 0;
for (const f of storyFiles) {
  const content = fs.readFileSync(path.join(storiesDir, f), 'utf8').toLowerCase();
  for (const m of privateMarkers) {
    if (content.includes(m)) { publicLeaks++; break; }
  }
}
check('No private research notes in public pages', publicLeaks === 0, `${publicLeaks} pages with potential leaks`);

// ---------- Report ----------
let passed = RESULTS.filter(r => r.pass).length;
let failed = RESULTS.filter(r => !r.pass).length;
const report = [
  '# Milestone 7 — Verification and polish',
  '',
  '**Project:** Historical Newspaper Archives',
  '**Research path:** `D:\\news`',
  '**Milestone:** 7 — Verification and polish',
  '**Status:** ' + (failed === 0 ? 'COMPLETE — all checks passed' : 'ISSUES FOUND'),
  '',
  '## Test results',
  '',
  '| Check | Status | Detail |',
  '|-------|--------|--------|',
  ...RESULTS.map(r => `| ${r.name} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail || ''} |`),
  '',
  '## Summary',
  '',
  '- Checks passed: ' + passed,
  '- Checks failed: ' + failed,
  '- Total internal links checked: ' + totalLinks,
  '- Story pages: ' + storyFiles.length + ' (1,056 HN + 3 reference)',
  '- Data files: records.json, search.json, taxonomy.json, comparisons.json, stats.json',
  '',
  failed === 0 ? '**All verification checks passed. Site is ready for Milestone 8 (deployment handoff).**' : '**Some checks failed. Review and fix before proceeding to Milestone 8.**',
  '',
  '---',
  '*Generated by Milestone 7 verification harness.*'
];
fs.writeFileSync(path.join(DOCS, 'MILESTONE7_VERIFICATION_REPORT.md'), report.join('\n'));
console.log('\n=== REPORT WRITTEN: docs/MILESTONE7_VERIFICATION_REPORT.md ===');
console.log('Passed: ' + passed + ' / ' + RESULTS.length);
process.exit(failed === 0 ? 0 : 1);
