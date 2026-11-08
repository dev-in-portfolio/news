// ============================================================================
// Milestone 5 Build — Step 1: Data preparation
// Reads ingestion_ledger.json + reconciliation_ledger.json, produces normalized
// data JSON files for the static site.
// Outputs:
//   site/data/records.json      lean record array (1,056)
//   site/data/search.json       search index
//   site/data/taxonomy.json     locked taxonomy tree (13 roots / subs / leaves)
//   site/data/comparisons.json  84 curated flags
// ============================================================================
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/news';
const OUT = path.join(ROOT, 'site', 'data');

function readJsonBom(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
// Repair common UTF-8-as-Latin-1 mojibake in display text only (not identifiers/urls).
const MOJI = [
  [/â€”/g, '\u2014'], [/â€“/g, '\u2013'], [/â€”/g, '\u2014'],
  [/â€œ/g, '\u201C'], [/â€\u201D/g, '\u201D'], [/â€\u0093/g, '\u201C'], [/â€\u0094/g, '\u201D'],
  [/â€™/g, '\u2019'], [/â€˜/g, '\u2018'], [/â€\u0099/g, '\u2019'], [/â€\u0098/g, '\u2018'],
  [/â€¢/g, '\u2022'], [/â€¦/g, '\u2026'], [/â€\u00A2/g, '\u2022'], [/â€\u00A6/g, '\u2026'],
  [/Ã©/g, '\u00E9'], [/Ã¨/g, '\u00E8'], [/Ãº/g, '\u00FA'], [/Ã±/g, '\u00F1'],
  [/Ã§/g, '\u00E7'], [/Ã¶/g, '\u00F6'], [/Ã¤/g, '\u00E4'], [/Ã¼/g, '\u00FC'],
  [/Ã±/g, '\u00F1'], [/Ã/g, '\u00C1'], [/Ã‰/g, '\u00C9']
];
function fixMoji(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  MOJI.forEach(([re, ch]) => { out = out.replace(re, ch); });
  return out;
}

const seed = readJsonBom(path.join(ROOT, 'docs', 'ingestion_ledger.json'));
const recon = readJsonBom(path.join(ROOT, 'docs', 'reconciliation_ledger.json'));
const reconById = {};
recon.forEach(r => { reconById[r.hn_id] = r; });

const records = seed.map(r => {
  const rc = reconById[r.hn_id] || {};
  return {
    hn_id: r.hn_id,
    heading: fixMoji(r.seed_heading),
    date: r.seed_publication_date,
    url: r.seed_url,
    report: r.saved_research_report,
    curated_class: r.curated_class === '(none)' ? '' : r.curated_class,
    recorded_finding: fixMoji(r.recorded_finding),
    evidence_tier: r.evidence_tier === '(blank)' ? '' : r.evidence_tier,
    keyword_flag: r.keyword_only_flag,
    identity_peers: r.identity_review_peers,
    taxonomy: {
      root: r.taxonomy_root,
      sub: r.taxonomy_sub,
      leaf: r.taxonomy_leaf
    },
    decision_status: r.decision_status,
    rationale: fixMoji(r.rationale),
    audit_class: r.audit_class === '(none)' ? '' : r.audit_class,
    audit_finding: fixMoji(r.audit_finding),
    audit_assessment: fixMoji(r.audit_assessment),
    audit_prior_evidence: r.audit_prior_evidence,
    audit_links: r.audit_source_links,
    discovery_title: fixMoji(r.discovery_title),
    discovery_body: fixMoji(r.discovery_body),
    batch_count: Number(r.batch_entries_count || 0),
    in_batch: r.in_batch_reports === 'yes',
    import_state: r.import_state,
    recon_category: rc.reconciliation_category || 'indexed_only',
    curated_flag_class: rc.curated_class || '',
    heuristic_flag: rc.heuristic_flag || '',
    identity_candidate: Boolean(rc.identity_candidate),
    identity_pair_count: Number(rc.identity_pair_count || 0)
  };
});

fs.mkdirSync(OUT, { recursive: true });

// records.json
fs.writeFileSync(path.join(OUT, 'records.json'), JSON.stringify(records, null, 2));

// search.json — lean index for client-side search
const searchIndex = records.map(r => ({
  id: r.hn_id,
  h: r.heading,
  d: r.date,
  root: r.taxonomy.root,
  sub: r.taxonomy.sub,
  leaf: r.taxonomy.leaf,
  tier: r.evidence_tier,
  cls: r.curated_class,
  url: r.url,
  s: (r.recorded_finding || r.discovery_body || r.discovery_title || '').slice(0, 300)
}));
fs.writeFileSync(path.join(OUT, 'search.json'), JSON.stringify(searchIndex, null, 2));

// taxonomy.json — tree: root -> sub -> leaf -> record ids
const taxonomy = {};
records.forEach(r => {
  const { root, sub, leaf } = r.taxonomy;
  if (!root) return;
  if (!taxonomy[root]) taxonomy[root] = {};
  if (!taxonomy[root][sub]) taxonomy[root][sub] = {};
  if (!taxonomy[root][sub][leaf]) taxonomy[root][sub][leaf] = [];
  taxonomy[root][sub][leaf].push(r.hn_id);
});
// Convert leaf arrays to counts for display, keep ids for detail linking
const taxonomyTree = Object.entries(taxonomy).map(([root, subs]) => ({
  root,
  subs: Object.entries(subs).map(([sub, leaves]) => ({
    sub,
    leaves: Object.entries(leaves).map(([leaf, ids]) => ({
      leaf,
      count: ids.length,
      ids
    }))
  }))
}));
fs.writeFileSync(path.join(OUT, 'taxonomy.json'), JSON.stringify(taxonomyTree, null, 2));

// comparisons.json — curated flags from reconciliation ledger
const comparisons = records
  .filter(r => r.audit_class)
  .map(r => ({
    hn_id: r.hn_id,
    heading: r.heading,
    date: r.date,
    class: r.audit_class,
    finding: r.audit_finding,
    assessment: r.audit_assessment,
    prior_evidence: r.audit_prior_evidence,
    links: r.audit_links,
    url: r.url,
    taxonomy_leaf: r.taxonomy.leaf
  }))
  .sort((a, b) => {
    const order = { V: 0, R: 1, P: 2, M: 3, F: 4, Q: 5 };
    return (order[a.class] || 9) - (order[b.class] || 9) || a.hn_id.localeCompare(b.hn_id);
  });
fs.writeFileSync(path.join(OUT, 'comparisons.json'), JSON.stringify(comparisons, null, 2));

// Summary stats
const stats = {
  total: records.length,
  curated: records.filter(r => r.curated_class).length,
  heuristic: records.filter(r => r.keyword_flag).length,
  indexedOnly: records.filter(r => !r.curated_class && !r.keyword_flag).length,
  tiers: {},
  classes: {},
  roots: {}
};
records.forEach(r => {
  stats.tiers[r.evidence_tier || '(blank)'] = (stats.tiers[r.evidence_tier || '(blank)'] || 0) + 1;
  stats.classes[r.curated_class || '(none)'] = (stats.classes[r.curated_class || '(none)'] || 0) + 1;
  stats.roots[r.taxonomy.root || '(none)'] = (stats.roots[r.taxonomy.root || '(none)'] || 0) + 1;
});
fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 2));

console.log('Data prep complete.');
console.log('records:', records.length);
console.log('search index:', searchIndex.length);
console.log('taxonomy roots:', Object.keys(taxonomy).length);
console.log('comparisons:', comparisons.length);
console.log('stats:', JSON.stringify(stats, null, 2));
