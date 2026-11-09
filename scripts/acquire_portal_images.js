// ============================================================================
// Acquire authentic newspaper page scans from the UNT-hosted newspaper portals:
//   - Gateway to Oklahoma History  (gateway.okhistory.org)
//   - The Portal to Texas History  (texashistory.unt.edu)
//
// Both expose a public IIIF Image API (1500 px access rendition) and an
// OCR text endpoint, but no word-coordinate service, so only full pages are
// acquired here — no guessed crops.
//
// Writes: site/assets/images/*.jpg
//         docs/PORTAL_IMAGE_ACQUISITION_LEDGER.json
//         site/data/images.json   (via lib_image_merge)
//
// Usage: node scripts/acquire_portal_images.js [--limit N] [--only HN-001] [--dry]
// ============================================================================
const fs = require('fs');
const path = require('path');
const { buildImages } = require('./lib_image_merge');

const SITE = 'D:/news/site';
const IMG_DIR = path.join(SITE, 'assets', 'images');
const DOCS = 'D:/news/docs';
const LEDGER_PATH = path.join(DOCS, 'PORTAL_IMAGE_ACQUISITION_LEDGER.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
function argVal(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
const LIMIT = argVal('--limit') ? Number(argVal('--limit')) : Infinity;
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');
const DELAY = argVal('--delay') ? Number(argVal('--delay')) : 400;

fs.mkdirSync(IMG_DIR, { recursive: true });

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
function normalisePortal(u) {
  if (!u) return null;
  u = String(u).trim().replace(/[.,;]+$/, '');
  const m = u.match(/^https?:\/\/(gateway\.okhistory\.org|texashistory\.unt\.edu)\/ark:\/67531\/([^/]+)\/m(\d+)\/(\d+)\//i);
  if (!m) return null;
  const [, host, id, mpart, ppart] = m;
  const base = `https://${host}/ark:/67531/${id}/m${mpart}/${ppart}/`;
  return {
    host, ark: `ark:/67531/${id}`, id, mpart, seq: Number(ppart),
    pageUrl: base,
    iiifBase: `https://${host}/iiif/ark:/67531/${id}/m${mpart}/${ppart}`,
    metaUrl: `https://${host}/ark:/67531/${id}/metadata.untl.xml`,
    ocrUrl: base + 'ocr.txt',
  };
}
for (const meta of Object.values(hnUrlMeta)) {
  for (const [url, m] of Object.entries(meta || {})) {
    const n = normalisePortal(url);
    if (n) metaByPage[n.pageUrl] = m;
  }
}

async function get(url, timeoutMs = 90000, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json, image/jpeg, text/xml, text/plain, */*' },
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
async function getText(url) {
  const res = await get(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.text();
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
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) throw new Error('not a JPEG');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&#13;/g, '').trim() : '';
}

// ---------- enumerate work ----------
const work = [];
const seen = new Set();
function addWork(hn, url) {
  if (ONLY && !ONLY.has(hn)) return;
  const n = normalisePortal(url);
  if (!n) return;
  if (/\.pdf(\?|$)/i.test(url)) return; // a PDF companion file, not a page
  const key = hn + '|' + n.pageUrl;
  if (seen.has(key)) return;
  seen.add(key);
  work.push({ hn, ...n });
}

const hnUrls = readJsonIf('D:/news/scripts/hn_urls.json') || {};
for (const [hn, urls] of Object.entries(hnUrls)) {
  for (const u of urls) if (/gateway\.okhistory\.org|texashistory\.unt\.edu/i.test(u)) addWork(hn, u);
}
const manifest = fs.readFileSync(path.join(DOCS, 'SOURCE_ACQUISITION_MANIFEST.csv'), 'utf8').replace(/^\uFEFF/, '');
const mlines = manifest.split(/\r?\n/).filter(Boolean);
const mheader = parseCsvLine(mlines[0]).map(s => s.trim());
const MI = {}; mheader.forEach((h, i) => MI[h] = i);
for (let i = 1; i < mlines.length; i++) {
  const f = parseCsvLine(mlines[i]);
  const u = f[MI.original_url_exact] || '';
  if (!/gateway\.okhistory\.org|texashistory\.unt\.edu/i.test(u)) continue;
  const hn = (f[MI.hn_ids] || '').split(/[;,]/)[0].trim();
  if (hn) addWork(hn, u);
}

work.sort((a, b) => a.hn.localeCompare(b.hn) || a.host.localeCompare(b.host) || a.id.localeCompare(b.id) || a.seq - b.seq);
const target = work.slice(0, LIMIT === Infinity ? work.length : LIMIT);
const byHost = {};
for (const w of target) byHost[w.host] = (byHost[w.host] || 0) + 1;
console.log(`Portal work items: ${target.length} (from ${work.length})  hosts=${JSON.stringify(byHost)}  records=${new Set(target.map(w => w.hn)).size}`);
if (DRY) {
  target.slice(0, 40).forEach(w => console.log(`  ${w.hn}  ${w.host}  ${w.ark}  seq${w.seq}`));
  process.exit(0);
}

let ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

const PROVIDER = {
  'gateway.okhistory.org': 'Gateway to Oklahoma History (Oklahoma Historical Society)',
  'texashistory.unt.edu': 'The Portal to Texas History (University of North Texas)',
};

async function processItem(item, idx) {
  const tag = `[${idx + 1}/${target.length}] ${item.hn} ${item.host} ${item.ark} seq-${item.seq}`;
  const key = `${item.hn}|${item.pageUrl}`;
  const meta = metaByPage[item.pageUrl] || {};
  const base = `hn-${item.hn.replace('HN-', '')}-${item.host.startsWith('gateway') ? 'ok' : 'tx'}-${item.id}-m${item.mpart}p${item.seq}`;
  const fullName = base + '-page.jpg';
  const fullPath = path.join(IMG_DIR, fullName);

  const entry = {
    hn_id: item.hn,
    lccn: '',
    issue_date: '',
    edition: '',
    sequence: item.seq,
    page_url: item.pageUrl,
    provider: PROVIDER[item.host] || item.host,
    newspaper: meta.paper || '',
    headline: meta.headline || '',
    status: 'pending',
    full_page_asset: null,
    crop_asset: null,
    source_dimensions: null,
    iiif_id: `${item.ark}/m${item.mpart}/${item.seq}`,
    error: null,
    acquired_at: null,
  };

  try {
    const info = await getJson(item.iiifBase + '/info.json');
    const w = info.width, h = info.height;
    entry.source_dimensions = `${w}x${h}`;

    const renderW = Math.min(1200, w);
    if (!fs.existsSync(fullPath)) {
      // Gateway to Oklahoma History rejects sizeByW requests ("terminated"),
      // so fall back to the native full-size rendition.
      const candidates = [
        `${item.iiifBase}/full/${renderW},/0/default.jpg`,
        `${item.iiifBase}/full/full/0/default.jpg`,
      ];
      let lastErr = null;
      for (const url of candidates) {
        try { entry.full_page_bytes = await download(url, fullPath); lastErr = null; break; }
        catch (e) { lastErr = e; }
      }
      if (lastErr) throw lastErr;
    } else {
      entry.full_page_bytes = fs.statSync(fullPath).size;
    }
    entry.full_page_asset = 'assets/images/' + fullName;

    // Bibliographic metadata (public domain newspaper).
    try {
      const xml = await getText(item.metaUrl);
      entry.newspaper = entry.newspaper || xmlTag(xml, 'title') || '';
      entry.issue_date = xmlTag(xml, 'date') || '';
      entry.lccn = (xml.match(/<identifier[^>]*qualifier="LCCN"[^>]*>([^<]+)</) || [])[1] || '';
      entry.rights = xmlTag(xml, 'rights') || '';
    } catch (e) {
      entry.metadata_status = 'metadata_unavailable';
    }

    entry.crop_status = 'no_coordinates';
    entry.status = 'full_page_acquired';
    entry.acquired_at = new Date().toISOString();
    console.log(`${tag}  OK  page=${(entry.full_page_bytes / 1024).toFixed(0)}KB  ${entry.source_dimensions}  ${entry.newspaper.slice(0, 40)}`);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log(`${tag}  FAIL  ${e.message}`);
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
  const ok = results.filter(r => r.status === 'full_page_acquired').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`\nAcquired: ${ok}   Failed: ${failed}`);
  console.log(`Total records with images (all providers): ${Object.keys(images).length}`);
  console.log('Wrote docs/PORTAL_IMAGE_ACQUISITION_LEDGER.json and site/data/images.json');
}

run().catch(e => { console.error(e); process.exit(1); });
