// ============================================================================
// Acquire authentic newspaper page scans from Historic Oregon Newspapers
// (University of Oregon) via its IIIF image service.
//
// Only fetches from providers that respond 200. Never fabricates images.
// Writes: site/assets/images/*.jpg  and  site/data/images.json
// Ledger: docs/IMAGE_ACQUISITION_LEDGER.json
//
// Usage:  node scripts/acquire_oregon_images.js [--limit N] [--only HN-403,HN-404]
// ============================================================================
const fs = require('fs');
const path = require('path');

const SITE = 'D:/news/site';
const IMG_DIR = path.join(SITE, 'assets', 'images');
const DATA = path.join(SITE, 'data');
const DOCS = 'D:/news/docs';

const args = process.argv.slice(2);
function argVal(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const LIMIT = argVal('--limit') ? Number(argVal('--limit')) : Infinity;
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

const hnUrls = readJson('D:/news/scripts/hn_urls.json');
const hnUrlMeta = readJson('D:/news/scripts/hn_url_meta.json');

// index batch-report metadata by normalised page URL
const metaByPage = {};
for (const [hn, meta] of Object.entries(hnUrlMeta)) {
  for (const [url, m] of Object.entries(meta || {})) {
    const n = normalise(url);
    if (n && !metaByPage[n.pageUrl]) metaByPage[n.pageUrl] = m;
  }
}
const recon = readJson(path.join(DOCS, 'reconciliation_ledger.json'));
const reconArr = Array.isArray(recon) ? recon : (recon.records || Object.values(recon));
const reconById = {};
for (const r of reconArr) reconById[r.hn_id] = r;

// ---------- URL normalisation ----------
function normalise(u) {
  // https://oregonnews.uoregon.edu/lccn/{lccn}/{date}/ed-{e}/seq-{n}/ocr/
  // https://oregonnews.uoregon.edu/lccn/{lccn}/{date}/ed-{e}/seq-{n}.pdf
  const m = u.match(/^https?:\/\/oregonnews\.uoregon\.edu\/lccn\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/ed-(\d+)\/seq-(\d+)/);
  if (!m) return null;
  const [, lccn, date, ed, seq] = m;
  return {
    lccn, date, ed, seq: Number(seq),
    pageUrl: `https://oregonnews.uoregon.edu/lccn/${lccn}/${date}/ed-${ed}/seq-${seq}/`,
  };
}

async function get(url, timeoutMs = 60000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'HistoricalNewspaperArchives/1.0 (research; contact via project README)' },
  });
  return res;
}

async function getText(url, timeoutMs = 60000) {
  const res = await get(url, timeoutMs);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.text();
}

async function download(url, dest, timeoutMs = 120000) {
  const res = await get(url, timeoutMs);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error('suspiciously small (' + buf.length + ' bytes)');
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) throw new Error('not a JPEG');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

// ---------- ALTO helpers ----------
function attrOf(tag, name) {
  const m = tag.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1] : null;
}
function normText(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function parseAlto(xml) {
  const unitM = xml.match(/<MeasurementUnit>([^<]+)<\/MeasurementUnit>/);
  const xdpiM = xml.match(/xdpi:(\d+)/);
  const blocks = [];
  const re = /<TextBlock\b([^>]*?)>([\s\S]*?)<\/TextBlock>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const tag = m[1], inner = m[2];
    const hpos = +attrOf(tag, 'HPOS'), vpos = +attrOf(tag, 'VPOS');
    const w = +attrOf(tag, 'WIDTH'), h = +attrOf(tag, 'HEIGHT');
    if (!isFinite(hpos) || !isFinite(vpos) || !w || !h) continue;
    const words = [];
    const wre = /<String\b([^>]*?)\/>/g;
    let wm;
    while ((wm = wre.exec(inner)) !== null) {
      const c = attrOf(wm[1], 'CONTENT');
      if (c) words.push(c);
    }
    blocks.push({ hpos, vpos, w, h, text: words.join(' ') });
  }
  return { blocks, unit: unitM ? unitM[1] : '', xdpi: xdpiM ? +xdpiM[1] : null };
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'his', 'her', 'its', 'not', 'but', 'has', 'have', 'had', 'will', 'would', 'into', 'over', 'than', 'them', 'they', 'their', 'when', 'who', 'all', 'out', 'one', 'two', 'new', 'may', 'now', 'how', 'why']);

function locateArticle(blocks, headline, imgW, scale) {
  if (!headline) return null;
  const toks = normText(headline).split(' ').filter(t => t.length >= 3 && !STOP.has(t));
  if (toks.length < 2) return null;
  let best = null, bestScore = 0;
  for (const b of blocks) {
    const nb = ' ' + normText(b.text) + ' ';
    let hit = 0;
    for (const t of toks) if (nb.includes(' ' + t + ' ')) hit++;
    const score = hit / toks.length;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  if (!best || bestScore < 0.6) return { failed: true, score: bestScore };

  // Extend down the same column to include the article body.
  const x0 = best.hpos, x1 = best.hpos + best.w;
  const MAX_H = 9600; // ALTO units (~2400 px at 300dpi)
  let region = { x0: best.hpos, y0: best.vpos, x1: best.hpos + best.w, y1: best.vpos + best.h };
  const below = blocks
    .filter(b => b !== best && b.vpos >= best.vpos + best.h - 60)
    .filter(b => {
      const ox = Math.max(0, Math.min(x1, b.hpos + b.w) - Math.max(x0, b.hpos));
      return ox / Math.min(b.w, best.w) > 0.5;
    })
    .sort((a, b) => a.vpos - b.vpos);
  let totalH = region.y1 - region.y0;
  for (const b of below) {
    if (totalH >= MAX_H) break;
    region.y1 = Math.max(region.y1, b.vpos + b.h);
    region.x1 = Math.max(region.x1, b.hpos + b.w);
    totalH = region.y1 - region.y0;
    if (totalH >= MAX_H) break;
  }

  const pad = 20;
  let rx = Math.max(0, region.x0 - pad);
  let ry = Math.max(0, region.y0 - pad);
  let rw = region.x1 - region.x0 + pad * 2;
  let rh = region.y1 - region.y0 + pad * 2;

  // convert ALTO units -> image pixels
  rx = Math.round(rx * scale); ry = Math.round(ry * scale);
  rw = Math.round(rw * scale); rh = Math.round(rh * scale);
  if (rw <= 0 || rh <= 0) return { failed: true, score: bestScore };
  return { failed: false, score: bestScore, region: { x: rx, y: ry, w: rw, h: rh } };
}

// ---------- build work list ----------
const work = [];
for (const [hn, urls] of Object.entries(hnUrls)) {
  if (ONLY && !ONLY.has(hn)) continue;
  const seen = new Set();
  for (const u of urls) {
    const n = normalise(u);
    if (!n) continue;
    const key = n.pageUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    work.push({ hn, ...n });
  }
}
work.sort((a, b) => a.hn.localeCompare(b.hn) || a.seq - b.seq);
const target = work.slice(0, LIMIT === Infinity ? work.length : LIMIT);
console.log(`Work items: ${target.length} (from ${work.length} Oregon page URLs across ${Object.keys(hnUrls).length} records)`);

// ---------- ledger ----------
const ledgerPath = path.join(DOCS, 'IMAGE_ACQUISITION_LEDGER.json');
let ledger = fs.existsSync(ledgerPath) ? readJson(ledgerPath) : { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

// ---------- worker ----------
async function processItem(item, idx) {
  const tag = `[${idx + 1}/${target.length}] ${item.hn} ${item.lccn} ${item.date} seq-${item.seq}`;
  const key = `${item.hn}|${item.pageUrl}`;
  const rec = reconById[item.hn] || {};
  const entry = {
    hn_id: item.hn,
    lccn: item.lccn,
    issue_date: item.date,
    edition: item.ed,
    sequence: item.seq,
    page_url: item.pageUrl,
    provider: 'Historic Oregon Newspapers (University of Oregon)',
    status: 'pending',
    full_page_asset: null,
    crop_asset: null,
    source_dimensions: null,
    iiif_id: null,
    error: null,
    acquired_at: null,
  };

  try {
    // 1. page HTML -> IIIF identifier
    const html = await getText(item.pageUrl);
    const m = html.match(/https:\/\/oregonnews\.uoregon\.edu\/images\/iiif\/([^"' ]+?\.jp2)\//);
    if (!m) throw new Error('no IIIF identifier in page HTML');
    entry.iiif_id = m[1];

    // 2. dimensions
    const infoUrl = `https://oregonnews.uoregon.edu/images/iiif/${entry.iiif_id}/info.json`;
    let w = null, h = null;
    try {
      const info = JSON.parse(await getText(infoUrl, 30000));
      w = info.width; h = info.height;
      entry.source_dimensions = `${w}x${h}`;
    } catch (e) { /* dimensions are optional */ }

    // 3. full page at 1200px wide
    const base = `hn-${item.hn.replace('HN-', '')}-${item.lccn}-${item.date}-seq${item.seq}`;
    const fullName = base + '-page.jpg';
    const fullPath = path.join(IMG_DIR, fullName);
    const fullUrl = `https://oregonnews.uoregon.edu/images/iiif/${entry.iiif_id}/full/1200,/0/default.jpg`;
    let fullBytes = 0;
    if (fs.existsSync(fullPath)) {
      fullBytes = fs.statSync(fullPath).size;
    } else {
      fullBytes = await download(fullUrl, fullPath);
    }
    entry.full_page_asset = 'assets/images/' + fullName;
    entry.full_page_bytes = fullBytes;

    // 4. article crop located via the archive's ALTO OCR coordinates
    const meta = metaByPage[item.pageUrl] || {};
    entry.newspaper = meta.paper || '';
    entry.headline = meta.headline || '';
    if (meta.headline && w && h) {
      try {
        const altoXml = await getText(item.pageUrl + 'ocr.xml', 90000);
        const { blocks, unit, xdpi } = parseAlto(altoXml);
        let scale = null;
        if (unit === 'inch1200' && xdpi) scale = xdpi / 1200;
        else if (unit === 'pixel') scale = 1;
        if (!scale) {
          const maxX = blocks.reduce((a, b) => Math.max(a, b.hpos + b.w), 0);
          scale = maxX ? w / maxX : 0.25;
        }
        const loc = locateArticle(blocks, meta.headline, w, scale);
        if (loc && !loc.failed) {
          const r = loc.region;
          const cx = Math.max(0, Math.min(r.x, w - 1));
          const cy = Math.max(0, Math.min(r.y, h - 1));
          const cw = Math.min(r.w, w - cx);
          const ch = Math.min(r.h, h - cy);
          const cropName = base + '-article.jpg';
          const cropPath = path.join(IMG_DIR, cropName);
          const cropUrl = `https://oregonnews.uoregon.edu/images/iiif/${entry.iiif_id}/${cx},${cy},${cw},${ch}/${cw},/0/default.jpg`;
          const cb = fs.existsSync(cropPath) ? fs.statSync(cropPath).size : await download(cropUrl, cropPath);
          entry.crop_asset = 'assets/images/' + cropName;
          entry.crop_bytes = cb;
          entry.crop_coordinates = `${cx},${cy},${cw},${ch}`;
          entry.crop_match_score = Number(loc.score.toFixed(2));
          entry.crop_status = 'crop_acquired';
        } else {
          entry.crop_status = loc && loc.failed ? 'no_confident_match' : 'no_headline';
          if (loc) entry.crop_match_score = Number((loc.score || 0).toFixed(2));
        }
      } catch (e) {
        entry.crop_status = 'crop_failed';
        entry.crop_error = e.message;
      }
    } else {
      entry.crop_status = meta.headline ? 'missing_dimensions' : 'no_headline';
    }

    entry.status = entry.crop_asset ? 'crop_acquired' : 'full_page_acquired';
    entry.acquired_at = new Date().toISOString();
    console.log(`${tag}  OK  page=${(fullBytes / 1024).toFixed(0)}KB  crop=${entry.crop_status}${entry.crop_match_score != null ? '(' + entry.crop_match_score + ')' : ''}  ${entry.source_dimensions}`);
  } catch (e) {
    entry.status = 'failed';
    entry.error = e.message;
    console.log(`${tag}  FAIL  ${e.message}`);
  }

  ledger.items[key] = entry;
  return entry;
}

async function run() {
  const CONCURRENCY = 5;
  let i = 0;
  const results = [];
  async function worker() {
    while (i < target.length) {
      const my = i++;
      try { results.push(await processItem(target[my], my)); }
      catch (e) { console.log('worker error', e.message); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));

  // ---------- build images.json for the site (merges all ledgers) ----------
  const { buildImages } = require('./lib_image_merge');
  const images = buildImages();

  const ok = results.filter(r => r.status === 'full_page_acquired' || r.status === 'crop_acquired').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`\nAcquired: ${ok}   Failed: ${failed}`);
  console.log(`Records with images: ${Object.keys(images).length}`);
  console.log('Wrote site/data/images.json and docs/IMAGE_ACQUISITION_LEDGER.json');
}

run().catch(e => { console.error(e); process.exit(1); });
