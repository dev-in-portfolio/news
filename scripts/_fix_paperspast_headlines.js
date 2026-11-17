// Post-process the Papers Past ledger:
//  - for entries whose headline is a masthead / truncated, re-fetch the article
//    page and derive the real headline from the page's meta description;
//  - verify each acquired crop exists and matches its recorded dimensions;
//  - report any failed / no-block entries.
// Read/write: docs/PAPERSPAST_IMAGE_ACQUISITION_LEDGER.json
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const LEDGER = path.join(ROOT, 'docs', 'PAPERSPAST_IMAGE_ACQUISITION_LEDGER.json');
const SESSION = 'C:/Users/dtoro/AppData/Local/Temp/opencode/paperspast-session.json';

function readJson(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
function decodeEntities(v) {
  return String(v).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013').replace(/&nbsp;/g, ' ');
}
function dims(p) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p], { encoding: 'utf8' }).trim();
    return out.replace(',', 'x');
  } catch (e) { return null; }
}
function looksLikeMasthead(h) {
  return !h || /\.{3,}$/.test(h) || /\bAND DAILY\b/i.test(h) || /^THE\s+[A-Z][A-Z\s]+\bAND\b/.test(h);
}
function deriveHeadline(html, fallback) {
  const metas = [...html.matchAll(/<meta[^>]+>/gi)].map(m => m[0]);
  let meta = '';
  for (const tag of metas) {
    if (!/(?:name|property)=["'](?:description|og:description|keywords|twitter:description)["']/i.test(tag)) continue;
    const cm = tag.match(/content=["']([^"']+)["']/i);
    if (cm && cm[1].length > meta.length) meta = cm[1];
  }
  if (!meta) return fallback;
  const text = decodeEntities(meta);
  const hm = text.match(/(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+[A-Z]+\s+\d{1,2},?\s+\d{4}\.?\s*([A-Z][^.]{2,140}\.)/);
  return hm ? hm[1].trim() : fallback;
}

(async () => {
  const ledger = readJson(LEDGER);
  const session = readJson(SESSION);
  const items = Object.values(ledger.items || {});
  let fixed = 0, verified = 0, missing = 0;
  for (const e of items) {
    if (e.status === 'article_clip_acquired' && e.crop_asset) {
      const parts = Array.isArray(e.crop_parts) && e.crop_parts.length ? e.crop_parts : null;
      if (parts) {
        for (const part of parts) {
          const pp = path.join(ROOT, 'site', part.asset);
          if (!fs.existsSync(pp)) { missing++; console.log('MISSING ' + e.hn_id + ' ' + part.asset); continue; }
          const pd = dims(pp);
          if (pd && part.dimensions && pd !== part.dimensions) console.log('DIM MISMATCH ' + e.hn_id + ' part' + part.part + ' ' + pd + ' vs ' + part.dimensions);
          verified++;
        }
      } else {
        const p = path.join(ROOT, 'site', e.crop_asset);
        if (!fs.existsSync(p)) { missing++; console.log('MISSING ' + e.hn_id + ' ' + e.crop_asset); continue; }
        const d = dims(p);
        if (d && e.crop_dimensions && d !== e.crop_dimensions) console.log('DIM MISMATCH ' + e.hn_id + ' ' + d + ' vs ' + e.crop_dimensions);
        verified++;
      }
    }
    if (e.status === 'article_clip_acquired' && looksLikeMasthead(e.headline)) {
      try {
        const r = await fetch(e.page_url, { headers: { 'User-Agent': session.ua, Cookie: session.cookieHeader, Accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
        const html = await r.text();
        const h = deriveHeadline(html, e.headline);
        if (h && h !== e.headline) {
          console.log('HEADLINE ' + e.hn_id + ': "' + String(e.headline).slice(0, 70) + '" -> "' + h.slice(0, 70) + '"');
          e.headline = h;
          fixed++;
        }
      } catch (err) { console.log('FETCH FAIL ' + e.hn_id + ' ' + err.message); }
      await new Promise(r => setTimeout(r, 700));
    }
  }
  ledger.generated_at = ledger.generated_at || new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const images = buildImages();
  let entries = 0, crops = 0;
  for (const k of Object.keys(images)) { entries += images[k].length; crops += images[k].filter(i => i.crop).length; }
  console.log(`\nverified crops=${verified}  missing=${missing}  headlines fixed=${fixed}`);
  console.log(`images.json: records=${Object.keys(images).length} items=${entries} crops=${crops}`);
  const bad = items.filter(e => e.status === 'failed' || e.status === 'no_article_blocks');
  console.log('failed/no-block entries: ' + bad.length);
  for (const e of bad) console.log('  ' + e.hn_id + '  ' + e.status + '  ' + e.page_url + '  ' + (e.error || ''));
})();
