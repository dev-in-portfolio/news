// ============================================================================
// Acquire authentic newspaper page scans from South Carolina Historic
// Newspapers (historicnewspapers.sc.edu), a Chronicling America-derived
// Veridian/OpenSeadragon site.
//
// Each page exposes:
//   - <base>/seq-N.jp2                     full-resolution JPEG 2000 scan
//   - <base>/coordinates/                  word -> [x,y,w,h] JSON
//   - <base>/ocr.txt                       OCR text
//
// ffmpeg (present on this machine) decodes the JP2 and renders:
//   - a 1,200 px-wide page JPEG
//   - an article crop when the batch-report headline matches OCR text >= 0.6
//
// Writes: site/assets/images/*.jpg
//         docs/SC_IMAGE_ACQUISITION_LEDGER.json
//         site/data/images.json   (via lib_image_merge)
//
// Usage: node scripts/acquire_sc_images.js [--limit N] [--only HN-001,HN-002] [--dry]
// ============================================================================
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const SITE = 'D:/news/site';
const IMG_DIR = path.join(SITE, 'assets', 'images');
const DOCS = 'D:/news/docs';
const LEDGER_PATH = path.join(DOCS, 'SC_IMAGE_ACQUISITION_LEDGER.json');
const TMP = path.join(os.tmpdir(), 'sc-jp2');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
function argVal(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
const LIMIT = argVal('--limit') ? Number(argVal('--limit')) : Infinity;
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');
const DELAY = argVal('--delay') ? Number(argVal('--delay')) : 400;

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
function normaliseSc(u) {
  if (!u) return null;
  u = String(u).trim().replace(/[.,;]+$/, '');
  const m = u.match(/^https?:\/\/historicnewspapers\.sc\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)/i);
  if (!m) return null;
  const [, lccn, date, ed, seq] = m;
  const base = `https://historicnewspapers.sc.edu/lccn/${lccn}/${date}/ed-${ed}/seq-${seq}/`;
  return {
    lccn, date, ed, seq: Number(seq),
    base,
    pageUrl: base,
    jp2Url: base.replace(/\/$/, '') + '.jp2',
    coordsUrl: base + 'coordinates/',
    ocrUrl: base + 'ocr.txt',
  };
}
for (const meta of Object.values(hnUrlMeta)) {
  for (const [url, m] of Object.entries(meta || {})) {
    const n = normaliseSc(url);
    if (n) metaByPage[`${n.lccn}|${n.date}|${n.seq}`] = m;
  }
}

// ---------- HTTP ----------
async function get(url, timeoutMs = 120000, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json, image/jp2, text/plain, */*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await sleep(2000 * attempt);
      return get(url, timeoutMs, attempt + 1);
    }
    return res;
  } catch (e) {
    if (attempt < 4) { await sleep(2000 * attempt); return get(url, timeoutMs, attempt + 1); }
    throw e;
  }
}
async function getJson(url) {
  const res = await get(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.json();
}
async function download(url, dest) {
  const res = await get(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error('suspiciously small (' + buf.length + ' bytes)');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

// ---------- crop location ----------
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'his', 'her', 'its', 'not', 'but', 'has', 'have', 'had', 'will', 'would', 'into', 'over', 'than', 'them', 'they', 'their', 'when', 'who', 'all', 'out', 'one', 'two', 'new', 'may', 'now', 'how', 'why']);
function normText(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }

function flattenCoords(j) {
  const W = Number(j.width) || 0;
  const H = Number(j.height) || 0;
  const occ = [];
  for (const [term, arr] of Object.entries(j.coords || {})) {
    if (!Array.isArray(arr)) continue;
    for (const c of arr) {
      if (Array.isArray(c) && c.length === 4) {
        occ.push({ x: Number(c[0]), y: Number(c[1]), w: Number(c[2]), h: Number(c[3]), term: String(term).toLowerCase() });
      }
    }
  }
  return { W, H, occ };
}

function locate(occ, headline, coordsW, coordsH, imgW, imgH) {
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

  const MAX_H = 9200;
  const colX0 = x0 - 220, colX1 = x1 + 220;
  const below = occ
    .filter(o => o.y >= y0 && o.y <= y0 + MAX_H)
    .filter(o => { const cx = o.x + o.w / 2; return cx >= colX0 && cx <= colX1; })
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

// ---------- ffmpeg helpers ----------
function probe(jp2) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', jp2], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}
function renderPage(jp2, dest, width = 1200) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', jp2, '-vf', `scale=${width}:-1`, '-q:v', '5', dest], { stdio: 'pipe' });
  return fs.statSync(dest).size;
}
function renderCrop(jp2, dest, r, maxWidth = 1000) {
  const vf = `crop=${r.w}:${r.h}:${r.x}:${r.y},scale='min(${maxWidth},iw)':-1`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', jp2, '-vf', vf, '-q:v', '4', dest], { stdio: 'pipe' });
  return fs.statSync(dest).size;
}
function jpegSize(p) {
  const b = fs.readFileSync(p);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    const len = b.readUInt16BE(i + 2); i += 2 + len;
  }
  return null;
}

// ---------- enumerate work ----------
const work = [];
const seen = new Set();
function addWork(hn, url) {
  if (ONLY && !ONLY.has(hn)) return;
  const n = normaliseSc(url);
  if (!n) return;
  const key = hn + '|' + n.pageUrl;
  if (seen.has(key)) return;
  seen.add(key);
  work.push({ hn, ...n });
}

const hnUrls = readJsonIf('D:/news/scripts/hn_urls.json') || {};
for (const [hn, urls] of Object.entries(hnUrls)) {
  for (const u of urls) if (/historicnewspapers\.sc\.edu/i.test(u)) addWork(hn, u);
}
const manifest = fs.readFileSync(path.join(DOCS, 'SOURCE_ACQUISITION_MANIFEST.csv'), 'utf8').replace(/^\uFEFF/, '');
const mlines = manifest.split(/\r?\n/).filter(Boolean);
const mheader = parseCsvLine(mlines[0]).map(s => s.trim());
const MI = {}; mheader.forEach((h, i) => MI[h] = i);
for (let i = 1; i < mlines.length; i++) {
  const f = parseCsvLine(mlines[i]);
  if (!/historicnewspapers\.sc\.edu/i.test(f[MI.original_url_exact] || '')) continue;
  const hn = (f[MI.hn_ids] || '').split(/[;,]/)[0].trim();
  if (hn) addWork(hn, f[MI.original_url_exact]);
}

work.sort((a, b) => a.hn.localeCompare(b.hn) || a.date.localeCompare(b.date) || a.seq - b.seq);
const target = work.slice(0, LIMIT === Infinity ? work.length : LIMIT);
console.log(`SC work items: ${target.length} (from ${work.length})  records=${new Set(target.map(w => w.hn)).size}`);
if (DRY) {
  target.forEach(w => console.log(`  ${w.hn}  ${w.lccn}  ${w.date}  seq${w.seq}  ${w.jp2Url}`));
  process.exit(0);
}

let ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

async function processItem(item, idx) {
  const tag = `[${idx + 1}/${target.length}] ${item.hn} ${item.lccn} ${item.date} seq-${item.seq}`;
  const key = `${item.hn}|${item.pageUrl}`;
  const meta = metaByPage[`${item.lccn}|${item.date}|${item.seq}`] || {};
  const base = `hn-${item.hn.replace('HN-', '')}-sc-${item.lccn}-${item.date}-seq${item.seq}`;
  const fullName = base + '-page.jpg';
  const fullPath = path.join(IMG_DIR, fullName);
  const jp2Path = path.join(TMP, base + '.jp2');

  const entry = {
    hn_id: item.hn,
    lccn: item.lccn,
    issue_date: item.date,
    edition: item.ed,
    sequence: item.seq,
    page_url: item.pageUrl,
    provider: 'South Carolina Historic Newspapers (University of South Carolina)',
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
    if (!fs.existsSync(jp2Path)) {
      await download(item.jp2Url, jp2Path);
    }
    const dim = probe(jp2Path);
    entry.source_dimensions = `${dim.w}x${dim.h}`;

    entry.full_page_bytes = renderPage(jp2Path, fullPath, 1200);
    entry.full_page_asset = 'assets/images/' + fullName;

    if (meta.headline) {
      try {
        const coords = await getJson(item.coordsUrl);
        const { W, H, occ } = flattenCoords(coords);
        if (W && H && occ.length) {
          const loc = locate(occ, meta.headline, W, H, dim.w, dim.h);
          if (!loc.failed) {
            const r = loc.region;
            const cropName = base + '-article.jpg';
            const cropPath = path.join(IMG_DIR, cropName);
            entry.crop_bytes = renderCrop(jp2Path, cropPath, r);
            entry.crop_asset = 'assets/images/' + cropName;
            entry.crop_coordinates = `${r.x},${r.y},${r.w},${r.h}`;
            entry.crop_match_score = Number(loc.score.toFixed(2));
            entry.crop_status = 'crop_acquired';
            const cs = jpegSize(cropPath);
            entry.crop_dimensions = cs ? `${cs.w}x${cs.h}` : null;
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
      entry.crop_status = 'no_headline';
    }

    entry.status = entry.crop_asset ? 'crop_acquired' : 'full_page_acquired';
    entry.acquired_at = new Date().toISOString();
    console.log(`${tag}  OK  page=${(entry.full_page_bytes / 1024).toFixed(0)}KB  crop=${entry.crop_status}${entry.crop_match_score != null ? '(' + entry.crop_match_score + ')' : ''}  ${entry.source_dimensions}`);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log(`${tag}  FAIL  ${e.message}`);
  } finally {
    try { if (fs.existsSync(jp2Path)) fs.unlinkSync(jp2Path); } catch (e) {}
  }

  ledger.items[key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  return entry;
}

async function run() {
  const results = [];
  for (let i = 0; i < target.length; i++) {
    await sleep(DELAY);
    results.push(await processItem(target[i], i));
  }
  const images = buildImages();
  const ok = results.filter(r => r.status === 'full_page_acquired' || r.status === 'crop_acquired').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const crops = results.filter(r => r.crop_asset).length;
  console.log(`\nAcquired: ${ok}   Failed: ${failed}   Crops: ${crops}`);
  console.log(`Total records with images (all providers): ${Object.keys(images).length}`);
  console.log('Wrote docs/SC_IMAGE_ACQUISITION_LEDGER.json and site/data/images.json');
}

run().catch(e => { console.error(e); process.exit(1); });
