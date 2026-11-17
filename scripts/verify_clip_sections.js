// Verify that each acquired clip's cited section really contains the record's
// subject, using the archive's own search index. For every acquired clip whose
// section title shares no token with the record heading/body (or looks like an
// advertisement), extract candidate phrases from the record body and search
// them, checking whether the cited doc id appears in the result set.
//
// Read-only. Writes docs/CLIP_SECTION_VERIFICATION.json for the record.
const fs = require('fs');
const SESSION = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-session.json';
const s = JSON.parse(fs.readFileSync(SESSION, 'utf8'));
const H = { 'User-Agent': s.ua, Cookie: s.cookieHeader, Accept: 'text/html' };
const E = '&e=-------en-20--1--txt-txIN-------';

function rj(p) { let t = fs.readFileSync(p, 'utf8'); if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1); return JSON.parse(t); }
const ROOT = 'D:/news';
const led = rj(ROOT + '/docs/INDIANA_IMAGE_ACQUISITION_LEDGER.json');
const recs = rj(ROOT + '/site/data/records.json');
const arr = Array.isArray(recs) ? recs : (recs.records || Object.values(recs));
const byId = {}; for (const r of arr) byId[r.hn_id] = r;

const stop = new Set('the a an of and in on to for from with by at as is was were be been it its this that which his her their they he she we you i not but or all any no nor so if then than too very can will just now been had has have were'.split(' '));
function norm(t) { return (t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function toks(t) { return norm(t).split(' ').filter(w => w.length > 2 && !stop.has(w)); }

const adRe = /\b(offer|offers|sale|sales|auction|wanted|for rent|to let|bargain|cheap|goods|groceries|clothing|boots|shoes|medicine|patent|agents|business cards|professional card|hotel|boarding)\b/i;

function citedDoc(e) {
  const m = String(e.page_url || '').match(/[?&]d=([A-Za-z0-9]+?\d{8}(?:-\d+)?\.\d+\.\d+)/);
  return m ? m[1] : null;
}

function candidates(body, heading) {
  const out = [];
  const b = body || '';
  // Bolded names/phrases
  for (const m of b.matchAll(/\*\*([^*]{3,60})\*\*/g)) out.push(m[1]);
  // Quoted strings
  for (const m of b.matchAll(/[“"]([^”"]{4,60})[”"]/g)) out.push(m[1]);
  // Capitalised 2-3 word sequences
  for (const m of b.matchAll(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,2})\b/g)) out.push(m[1]);
  const headToks = new Set(toks(heading));
  const generic = /^(source|report|assessment|follow|note|correction|original page|library of congress|see also|image|page)\b/i;
  const seen = new Set(); const ranked = [];
  for (let c of out) {
    c = c.replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '');
    if (generic.test(c)) continue;
    const t = toks(c);
    if (t.length < 1) continue;
    const key = norm(c);
    if (seen.has(key)) continue; seen.add(key);
    // Prefer phrases not already in the heading and with more distinctive tokens
    let score = t.length * 2 + c.length / 20;
    if (t.every(x => headToks.has(x))) score -= 3;
    if (/\d/.test(c)) score += 1;
    ranked.push({ c, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, 3).map(x => x.c);
}

async function search(q, y1, y2) {
  const docs = new Set();
  for (let page = 1; page <= 3; page++) {
    const u = 'https://newspapers.library.in.gov/?a=q&hs=1&r=1&results=1&txq=' +
      encodeURIComponent('"' + q + '"') + '&txf=txIN&ssnip=txt&dafyq=' + y1 +
      '&datyq=' + y2 + '&page=' + page + E;
    const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(90000) });
    const h = await r.text();
    const pageDocs = [...h.matchAll(/[A-Z]{3,6}\d{8}(?:-\d+)?\.[12]\.\d+/g)].map(x => x[0]);
    if (!pageDocs.length) break;
    for (const d of pageDocs) docs.add(d);
    if (pageDocs.length < 20) break;
    await new Promise(res => setTimeout(res, 700));
  }
  return docs;
}

(async () => {
  const acq = Object.values(led.items || {}).filter(e => e.status === 'article_clip_acquired' && e.crop_asset);
  const results = [];
  let n = 0;
  for (const e of acq) {
    const r = byId[e.hn_id] || {};
    const doc = citedDoc(e);
    if (!doc) continue;
    const a = toks(e.headline);
    const b = new Set(toks((r.heading || '') + ' ' + (r.discovery_body || '').slice(0, 900)));
    const hit = a.filter(t => b.has(t));
    const adLike = adRe.test(e.headline || '');
    if (hit.length && !adLike) continue; // title overlaps record; no check needed
    const year = (String(e.issue_date || '').match(/\b(\d{4})\b/) || [])[1];
    if (!year) continue;
    const cands = candidates(r.discovery_body || '', r.heading || '');
    if (!cands.length) { results.push({ hn: e.hn_id, doc, headline: e.headline, verdict: 'NO-PHRASE' }); continue; }
    let found = null, tried = [];
    for (const q of cands) {
      const docs = await search(q, Number(year) - 1, Number(year) + 1);
      tried.push({ q, hits: docs.size, found: docs.has(doc) });
      if (docs.has(doc)) { found = q; break; }
      await new Promise(res => setTimeout(res, 700));
    }
    n++;
    results.push({ hn: e.hn_id, doc, headline: e.headline, verdict: found ? 'CONFIRMED' : 'NOT-FOUND', via: found, tried });
    console.log(String(n).padStart(3) + '  ' + e.hn_id + '  ' + (found ? 'CONFIRMED' : 'NOT-FOUND').padEnd(9) + '  ' + doc.padEnd(22) + ' "' + (e.headline || '').slice(0, 40) + '"' + (found ? '  via "' + found + '"' : ''));
  }
  fs.writeFileSync(ROOT + '/docs/CLIP_SECTION_VERIFICATION.json', JSON.stringify(results, null, 1));
  const nf = results.filter(x => x.verdict === 'NOT-FOUND');
  console.log('\nchecked:', results.length, 'confirmed:', results.filter(x => x.verdict === 'CONFIRMED').length, 'not-found:', nf.length, 'no-phrase:', results.filter(x => x.verdict === 'NO-PHRASE').length);
  for (const x of nf) console.log('  NOT-FOUND ' + x.hn + '  ' + x.doc + '  tried=' + x.tried.map(t => t.q + '(' + t.hits + ')').join(' | '));
})();
