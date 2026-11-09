// ============================================================================
// Acquire authentic newspaper page scans from the Library of Congress
// (Chronicling America / loc.gov) via its IIIF image service and
// word-coordinates (ALTO) service.
//
// www.loc.gov HTML is 403 to automation, but with a browser User-Agent the
// JSON API ( ?fo=json ) and tile.loc.gov image/text services respond 200.
//
// Writes: site/assets/images/*.jpg
//         docs/LOC_IMAGE_ACQUISITION_LEDGER.json
//         site/data/images.json   (via lib_image_merge)
//
// Usage: node scripts/acquire_loc_images.js [--limit N] [--only HN-001,HN-002] [--dry]
// ============================================================================
const fs = require('fs');
const path = require('path');
const { buildImages } = require('./lib_image_merge');

const SITE = 'D:/news/site';
const IMG_DIR = path.join(SITE, 'assets', 'images');
const DOCS = 'D:/news/docs';
const LEDGER_PATH = path.join(DOCS, 'LOC_IMAGE_ACQUISITION_LEDGER.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
function argVal(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
const LIMIT = argVal('--limit') ? Number(argVal('--limit')) : Infinity;
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');
const DELAY = argVal('--delay') ? Number(argVal('--delay')) : 1200;
const CONCURRENCY = argVal('--conc') ? Number(argVal('--conc')) : 1;
const RETRY_FAILED = args.includes('--retry-failed');

fs.mkdirSync(IMG_DIR, { recursive: true });

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }

// ---------- CSV ----------
function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur); return out;
}

// ---------- headline metadata ----------
const hnUrlMeta = readJsonIf('D:/news/scripts/hn_url_meta.json') || {};
const metaByPage = {};
function metaKey(lccn, date, seq) { return `${lccn}|${date}|${seq}`; }
for (const meta of Object.values(hnUrlMeta)) {
  for (const [url, m] of Object.entries(meta || {})) {
    const n = normaliseLoc(url);
    if (n && n.lccn && n.date && n.seq) metaByPage[metaKey(n.lccn, n.date, n.seq)] = m;
  }
}

// ---------- URL normalisation ----------
function normaliseLoc(u) {
  if (!u) return null;
  u = String(u).trim().replace(/[.,;]+$/, '');
  let m = u.match(/^https?:\/\/(?:www\.)?loc\.gov\/resource\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\//i);
  if (m) {
    const spm = u.match(/[?&]sp=(\d+)/);
    const seq = spm ? Number(spm[1]) : 1;
    const [, lccn, date, ed] = m;
    const pageUrl = `https://www.loc.gov/resource/${lccn}/${date}/ed-${ed}/?sp=${seq}`;
    return {
      kind: 'resource', lccn, date, ed, seq, pageUrl,
      jsonUrl: pageUrl + '&fo=json',
      viewerUrl: pageUrl,
    };
  }
  m = u.match(/^https?:\/\/chroniclingamerica\.loc\.gov\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)/i);
  if (m) {
    const [, lccn, date, ed, seq] = m;
    const pageUrl = `https://www.loc.gov/resource/${lccn}/${date}/ed-${ed}/?sp=${seq}`;
    return {
      kind: 'resource', lccn, date, ed, seq: Number(seq), pageUrl,
      jsonUrl: pageUrl + '&fo=json',
      viewerUrl: pageUrl,
    };
  }
  m = u.match(/^https?:\/\/tile\.loc\.gov\/storage-services\/(service\/.+)\.pdf$/i);
  if (m) {
    const segPath = m[1]; // service/ndnp/.../0295
    const serviceId = segPath.replace(/\//g, ':');
    const dm = segPath.match(/\/data\/([^/]+)\/\d+\/(\d{8})\d*\/(\d+)$/);
    const lccn = dm ? dm[1] : 'loc';
    const date = dm ? `${dm[2].slice(0, 4)}-${dm[2].slice(4, 6)}-${dm[2].slice(6, 8)}` : '';
    const seq = dm ? Number(dm[3]) : 1;
    const segment = '/' + segPath + '.xml';
    return {
      kind: 'tile', lccn, date, ed: '1', seq, serviceId,
      pageUrl: `https://www.loc.gov/resource/${lccn}/${date}/ed-1/?sp=${seq}`,
      iiifBase: `https://tile.loc.gov/image-services/iiif/${serviceId}`,
      coordsUrl: `https://tile.loc.gov/text-services/word-coordinates-service?segment=${segment}&format=alto_xml`,
      viewerUrl: u,
    };
  }
  return null;
}

// ---------- HTTP ----------
async function get(url, timeoutMs = 60000, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json, image/jpeg, text/xml, */*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 429 && attempt < 6) {
      const wait = Math.min(60000, 20000 * attempt);
      console.log(`  rate-limited (429), waiting ${wait / 1000}s...`);
      await sleep(wait);
      return get(url, timeoutMs, attempt + 1);
    }
    if (res.status >= 500 && attempt < 4) {
      await sleep(1000 * attempt * 2);
      return get(url, timeoutMs, attempt + 1);
    }
    return res;
  } catch (e) {
    if (attempt < 4) { await sleep(1000 * attempt * 2); return get(url, timeoutMs, attempt + 1); }
    throw e;
  }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getJson(url, timeoutMs = 60000) {
  const res = await get(url, timeoutMs);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.json();
}

async function download(url, dest, timeoutMs = 120000) {
  const res = await get(url, timeoutMs);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error('suspiciously small (' + buf.length + ' bytes)');
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) throw new Error('not a JPEG (magic ' + buf[0].toString(16) + buf[1].toString(16) + ')');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

// ---------- crop location ----------
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'his', 'her', 'its', 'not', 'but', 'has', 'have', 'had', 'will', 'would', 'into', 'over', 'than', 'them', 'they', 'their', 'when', 'who', 'all', 'out', 'one', 'two', 'new', 'may', 'now', 'how', 'why']);
function normText(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }

function flattenCoords(j) {
  const k = Object.keys(j)[0];
  const v = j[k] || {};
  const W = Number(v.width) || 0;
  const H = Number(v.height) || 0;
  const occ = [];
  for (const [term, arr] of Object.entries(v.coords || {})) {
    if (!Array.isArray(arr)) continue;
    for (const o of arr) {
      const c = o.coordinates;
      if (Array.isArray(c) && c.length === 4) {
        occ.push({ x: c[0], y: c[1], w: c[2], h: c[3], term: String(term).toLowerCase() });
      }
    }
  }
  return { W, H, occ };
}

function locateLoc(occ, headline, coordsW, coordsH, imgW, imgH) {
  if (!headline) return { failed: true, reason: 'no_headline' };
  const tokens = [...new Set(normText(headline).split(' ').filter(t => t.length >= 3 && !STOP.has(t)))];
  if (tokens.length < 2) return { failed: true, reason: 'short_headline' };

  const heights = occ.map(o => o.h).sort((a, b) => a - b);
  const median = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
  const bigThreshold = Math.max(median * 1.25, 110);
  const big = occ.filter(o => o.h >= bigThreshold);

  const byTerm = new Map();
  for (const o of occ) {
    if (!byTerm.has(o.term)) byTerm.set(o.term, []);
    byTerm.get(o.term).push(o);
  }
  const bigByTerm = new Map();
  for (const o of big) {
    if (!bigByTerm.has(o.term)) bigByTerm.set(o.term, []);
    bigByTerm.get(o.term).push(o);
  }

  // Anchor on the rarest headline token (prefer large-font occurrences).
  let anchorTerm = null, anchorList = null;
  for (const t of tokens) {
    const list = (bigByTerm.get(t) || byTerm.get(t) || []);
    if (!list.length) continue;
    if (!anchorList || list.length < anchorList.length) { anchorTerm = t; anchorList = list; }
  }
  if (!anchorList) return { failed: true, reason: 'no_token_match', score: 0 };

  const WX = 3600, WY = 900;
  let best = null;
  for (const anchor of anchorList.slice(0, 60)) {
    const matched = [];
    for (const t of tokens) {
      const cands = (bigByTerm.get(t) || byTerm.get(t) || []);
      let pick = null, bestD = Infinity;
      for (const o of cands) {
        if (Math.abs(o.x - anchor.x) > WX) continue;
        if (Math.abs(o.y - anchor.y) > WY) continue;
        const d = Math.abs(o.y - anchor.y) * 2 + Math.abs(o.x - anchor.x);
        if (d < bestD) { bestD = d; pick = o; }
      }
      if (pick) matched.push(pick);
    }
    const score = matched.length / tokens.length;
    if (!best || score > best.score) best = { score, anchor, matched };
  }
  if (!best || best.score < 0.6) {
    return { failed: true, reason: 'no_confident_match', score: best ? best.score : 0 };
  }

  let x0 = Math.min(...best.matched.map(o => o.x));
  let y0 = Math.min(...best.matched.map(o => o.y));
  let x1 = Math.max(...best.matched.map(o => o.x + o.w));
  let y1 = Math.max(...best.matched.map(o => o.y + o.h));

  // Extend down the same column to include article body.
  const MAX_H = 9200; // ALTO units (~2,300 px at 300 dpi)
  const colX0 = x0 - 220, colX1 = x1 + 220;
  const below = occ
    .filter(o => o.y >= y0 && o.y <= y0 + MAX_H)
    .filter(o => {
      const cx = o.x + o.w / 2;
      return cx >= colX0 && cx <= colX1;
    })
    .sort((a, b) => a.y - b.y);
  for (const o of below) {
    if (o.y + o.h - y0 > MAX_H) break;
    x0 = Math.min(x0, o.x); x1 = Math.max(x1, o.x + o.w);
    y1 = Math.max(y1, o.y + o.h);
  }

  const pad = 45;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0);
  x1 = Math.min(coordsW, x1); y1 = Math.min(coordsH, y1);

  const scale = imgW / coordsW;
  let rx = Math.round(x0 * scale), ry = Math.round(y0 * scale);
  let rw = Math.round((x1 - x0) * scale), rh = Math.round((y1 - y0) * scale);
  rx = Math.max(0, Math.min(rx, imgW - 1));
  ry = Math.max(0, Math.min(ry, imgH - 1));
  rw = Math.min(rw, imgW - rx);
  rh = Math.min(rh, imgH - ry);
  if (rw <= 0 || rh <= 0) return { failed: true, reason: 'empty_region', score: best.score };
  return { failed: false, score: best.score, region: { x: rx, y: ry, w: rw, h: rh } };
}

// ---------- enumerate work ----------
const work = [];
const seen = new Set();
function addWork(hn, url) {
  if (ONLY && !ONLY.has(hn)) return;
  const n = normaliseLoc(url);
  if (!n) return;
  const key = hn + '|' + n.pageUrl + '|' + (n.serviceId || '');
  if (seen.has(key)) return;
  seen.add(key);
  work.push({ hn, ...n });
}

// 1. manifest LOC rows
const manifest = fs.readFileSync(path.join(DOCS, 'SOURCE_ACQUISITION_MANIFEST.csv'), 'utf8').replace(/^\uFEFF/, '');
const mlines = manifest.split(/\r?\n/).filter(Boolean);
const mheader = parseCsvLine(mlines[0]).map(s => s.trim());
const MI = {}; mheader.forEach((h, i) => MI[h] = i);
for (let i = 1; i < mlines.length; i++) {
  const f = parseCsvLine(mlines[i]);
  if (!/Library of Congress/i.test(f[MI.provider] || '')) continue;
  const hn = (f[MI.hn_ids] || '').split(/[;,]/)[0].trim();
  if (hn) addWork(hn, f[MI.original_url_exact]);
}

// 2. batch-report URLs
const hnUrls = readJsonIf('D:/news/scripts/hn_urls.json') || {};
for (const [hn, urls] of Object.entries(hnUrls)) {
  for (const u of urls) {
    if (/loc\.gov/i.test(u)) addWork(hn, u);
  }
}

work.sort((a, b) => a.hn.localeCompare(b.hn) || (a.date || '').localeCompare(b.date || '') || a.seq - b.seq);

// ---------- ledger ----------
let ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

let selected = work;
if (RETRY_FAILED) {
  selected = work.filter(w => {
    const k = `${w.hn}|${w.pageUrl}|${w.serviceId || ''}`;
    const e = ledger.items[k];
    return !e || e.status === 'failed';
  });
  console.log(`Retry-failed: ${selected.length} of ${work.length} items need another attempt`);
}

const target = selected.slice(0, LIMIT === Infinity ? selected.length : LIMIT);
const byKind = {};
for (const w of target) byKind[w.kind] = (byKind[w.kind] || 0) + 1;
console.log(`LOC work items: ${target.length} (from ${work.length})  kinds=${JSON.stringify(byKind)}  records=${new Set(target.map(w => w.hn)).size}`);
if (DRY) {
  target.slice(0, 25).forEach(w => console.log(`  ${w.hn}  ${w.kind}  ${w.lccn}  ${w.date}  seq${w.seq}`));
  process.exit(0);
}

async function processItem(item, idx) {
  const tag = `[${idx + 1}/${target.length}] ${item.hn} ${item.lccn} ${item.date} seq-${item.seq}`;
  const key = `${item.hn}|${item.pageUrl}|${item.serviceId || ''}`;
  const meta = metaByPage[metaKey(item.lccn, item.date, item.seq)] || {};
  const entry = {
    hn_id: item.hn,
    lccn: item.lccn,
    issue_date: item.date,
    edition: item.ed,
    sequence: item.seq,
    page_url: item.pageUrl,
    provider: 'Library of Congress / Chronicling America',
    newspaper: meta.paper || '',
    headline: meta.headline || '',
    status: 'pending',
    full_page_asset: null,
    crop_asset: null,
    source_dimensions: null,
    iiif_id: null,
    error: null,
    acquired_at: null,
  };

  try {
    let iiifBase, coordsUrl, w = null, h = null;

    if (item.kind === 'tile') {
      iiifBase = item.iiifBase;
      coordsUrl = item.coordsUrl;
      const info = await getJson(iiifBase + '/info.json', 45000);
      w = info.width; h = info.height;
      entry.iiif_id = item.serviceId;
    } else {
      const j = await getJson(item.jsonUrl, 60000);
      const page = (j.page && j.page[0]) || null;
      if (!page || !page.info) throw new Error('no page info in JSON');
      w = page.width; h = page.height;
      iiifBase = page.info.replace(/\/info\.json$/, '');
      entry.iiif_id = (page.info.match(/iiif\/(.+)\/info\.json/) || [])[1] || null;
      coordsUrl = j.resource && j.resource.fulltext_file ? String(j.resource.fulltext_file).replace(/&full_text=\d+/, '') : null;
    }
    entry.source_dimensions = `${w}x${h}`;

    // full page at 1200px
    const base = `hn-${item.hn.replace('HN-', '')}-loc-${item.lccn}-${item.date}-seq${item.seq}`;
    const fullName = base + '-page.jpg';
    const fullPath = path.join(IMG_DIR, fullName);
    let fullBytes;
    if (fs.existsSync(fullPath)) fullBytes = fs.statSync(fullPath).size;
    else fullBytes = await download(`${iiifBase}/full/1200,/0/default.jpg`, fullPath);
    entry.full_page_asset = 'assets/images/' + fullName;
    entry.full_page_bytes = fullBytes;

    // crop via word coordinates
    if (meta.headline && coordsUrl && w && h) {
      try {
        const coordsJson = await getJson(coordsUrl, 90000);
        const { W, H, occ } = flattenCoords(coordsJson);
        if (W && H && occ.length) {
          const loc = locateLoc(occ, meta.headline, W, H, w, h);
          if (!loc.failed) {
            const r = loc.region;
            const cropName = base + '-article.jpg';
            const cropPath = path.join(IMG_DIR, cropName);
            const cropUrl = `${iiifBase}/${r.x},${r.y},${r.w},${r.h}/${r.w},/0/default.jpg`;
            const cb = fs.existsSync(cropPath) ? fs.statSync(cropPath).size : await download(cropUrl, cropPath);
            entry.crop_asset = 'assets/images/' + cropName;
            entry.crop_bytes = cb;
            entry.crop_coordinates = `${r.x},${r.y},${r.w},${r.h}`;
            entry.crop_match_score = Number(loc.score.toFixed(2));
            entry.crop_status = 'crop_acquired';
          } else {
            entry.crop_status = loc.reason || 'no_confident_match';
            if (loc.score != null) entry.crop_match_score = Number(loc.score.toFixed(2));
          }
        } else {
          entry.crop_status = 'no_coordinates';
        }
      } catch (e) {
        entry.crop_status = 'crop_failed';
        entry.crop_error = e.message;
      }
    } else {
      entry.crop_status = meta.headline ? 'missing_coords' : 'no_headline';
    }

    entry.status = entry.crop_asset ? 'crop_acquired' : 'full_page_acquired';
    entry.acquired_at = new Date().toISOString();
    console.log(`${tag}  OK  page=${(fullBytes / 1024).toFixed(0)}KB  crop=${entry.crop_status}${entry.crop_match_score != null ? '(' + entry.crop_match_score + ')' : ''}  ${entry.source_dimensions}`);
  } catch (e) {
    const prev = ledger.items[key];
    const prevOk = prev && (prev.status === 'full_page_acquired' || prev.status === 'crop_acquired')
      && prev.full_page_asset && fs.existsSync(path.join(SITE, prev.full_page_asset));
    if (prevOk) {
      // A transient failure must not erase a previously acquired asset.
      entry.status = prev.status;
      entry.error = e.message + ' (previous acquisition retained)';
      entry.full_page_asset = prev.full_page_asset;
      entry.full_page_bytes = prev.full_page_bytes;
      entry.crop_asset = prev.crop_asset;
      entry.crop_bytes = prev.crop_bytes;
      entry.crop_coordinates = prev.crop_coordinates;
      entry.crop_match_score = prev.crop_match_score;
      entry.crop_status = prev.crop_status;
      entry.source_dimensions = prev.source_dimensions;
      entry.iiif_id = prev.iiif_id;
      entry.newspaper = entry.newspaper || prev.newspaper;
      entry.headline = entry.headline || prev.headline;
      entry.acquired_at = prev.acquired_at;
      console.log(`${tag}  FAIL-TRANSIENT  ${e.message}  (kept prior asset)`);
    } else {
      entry.status = 'failed';
      entry.error = e.message;
      console.log(`${tag}  FAIL  ${e.message}`);
    }
  }

  ledger.items[key] = entry;
  return entry;
}

async function run() {
  let i = 0;
  const results = [];
  function saveLedger() {
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  }
  async function worker() {
    while (i < target.length) {
      const my = i++;
      await sleep(DELAY);
      try { results.push(await processItem(target[my], my)); }
      catch (e) { console.log('worker error', e.message); }
      saveLedger();
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  const images = buildImages();

  const ok = results.filter(r => r.status === 'full_page_acquired' || r.status === 'crop_acquired').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const crops = results.filter(r => r.crop_asset).length;
  console.log(`\nAcquired: ${ok}   Failed: ${failed}   Crops: ${crops}`);
  console.log(`Total records with images (all providers): ${Object.keys(images).length}`);
  console.log('Wrote docs/LOC_IMAGE_ACQUISITION_LEDGER.json and site/data/images.json');
}

run().catch(e => { console.error(e); process.exit(1); });
