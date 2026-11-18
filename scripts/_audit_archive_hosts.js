// List newspaper-archive-like hosts with cited records that have no stored
// rendition from that host, and show the actual cited URLs. Read-only.
const fs = require('fs');
function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const ROOT = 'D:/news';
const urls = rj(ROOT + '/scripts/hn_urls.json');
const images = rj(ROOT + '/site/data/images.json');
const recs = rj(ROOT + '/site/data/records.json');
const arr = Array.isArray(recs) ? recs : Object.values(recs);
const by = Object.fromEntries(arr.map(r => [r.hn_id, r]));

const norm = u => String(u || '').replace(/&amp;/g, '&').trim();
const host = u => { try { return new URL(norm(u)).hostname.replace(/^www\./, ''); } catch (e) { return '?'; } };

// Hosts that serve historical newspaper page images or article clippings.
const ARCHIVE = /(newspapers?\.|newspaperarchive|rarenewspapers|chroniclingamerica|loc\.gov\/(resource|item)|paperspast|trove\.|nli\.org\.il|nlb\.gov\.sg|virginiachronicle|hrvh|cdnc\.|bl\.iro|britishnewspaperarchive|historyworm|archive\.spectator|scvhistory|okhistory|texashistory|newspapers\.library\.in\.gov|oregonnews|swco\.ttu|digitalnc|nyshistoricnewspapers|utahdigitalnewspapers|idahodigital|genealogybank|newspapers\.com|jta\.org|accessible-archives|newsbank)/i;

const map = new Map(); // host -> { cited: Map(hn->[urls]), imaged: Set(hn) }
for (const [hn, list] of Object.entries(urls)) {
  const imagedHosts = new Set((images[hn] || []).map(i => host(i.page_url)).filter(Boolean));
  for (const raw of list || []) {
    const u = norm(raw);
    const h = host(u);
    if (!ARCHIVE.test(h) && !ARCHIVE.test(u)) continue;
    if (!map.has(h)) map.set(h, { cited: new Map(), imaged: new Set() });
    const e = map.get(h);
    if (!e.cited.has(hn)) e.cited.set(hn, []);
    e.cited.get(hn).push(u);
    if (imagedHosts.has(h)) e.imaged.add(hn);
  }
}

const rows = [...map.entries()].map(([h, e]) => ({ h, cited: e.cited.size, imaged: e.imaged.size, gap: e.cited.size - e.imaged.size }))
  .sort((a, b) => b.gap - a.gap || b.cited - a.cited);
for (const r of rows) console.log(String(r.gap).padStart(4) + ' unimaged / ' + String(r.cited).padStart(4) + ' cited  ' + r.h);

console.log('\n--- records behind the top hosts ---');
for (const r of rows.filter(x => x.gap > 0).slice(0, 12)) {
  console.log('\n### ' + r.h + '  (' + r.gap + ' unimaged)');
  const e = map.get(r.h);
  let n = 0;
  for (const [hn, list] of e.cited) {
    if (e.imaged.has(hn)) continue;
    if (n++ >= 8) break;
    console.log('  ' + hn + '  primary=' + ((by[hn] || {}).url || ''));
    for (const u of list.slice(0, 2)) console.log('     ' + u);
  }
}
