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
// Revisit pages that already have a full-page image but no article crop. This is
// how a quoted headline found in the record text gets a second chance, and how
// earlier crop failures (e.g. IIIF pixel-area 501s) are retried.
const RETRY_CROPS = args.includes('--retry-crops');

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

// Canonical records, used only to recover a quoted headline when the batch-report
// line for this page did not quote one.
const { recordHeadlineCandidates } = require('./lib_headline');
const recordList = (() => {
  const r = readJson(path.join(SITE, 'data', 'records.json'));
  return Array.isArray(r) ? r : (r.records || Object.values(r));
})();
const recordById = {};
for (const r of recordList) recordById[r.hn_id] = r;

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

function scoreText(text, toks) {
  const nb = ' ' + normText(text) + ' ';
  let hit = 0;
  for (const t of toks) if (nb.includes(' ' + t + ' ')) hit++;
  return hit / toks.length;
}

function locateArticle(blocks, headline, imgW, scale) {
  if (!headline) return null;
  const toks = normText(headline).split(' ').filter(t => t.length >= 3 && !STOP.has(t));
  if (toks.length < 2) return null;
  let best = null, bestScore = 0;
  for (const b of blocks) {
    const score = scoreText(b.text, toks);
    if (score > bestScore) { bestScore = score; best = b; }
  }
  if (!best) return { failed: true, score: 0 };

  // A headline is often split across two or three ALTO blocks (overline,
  // second line). Greedily merge vertically adjacent blocks in the same column
  // when that improves the match, so a 0.5 single-block score can become 1.0.
  let group = { hpos: best.hpos, vpos: best.vpos, w: best.w, h: best.h, text: best.text };
  let groupScore = bestScore;
  for (let step = 0; step < 3; step++) {
    let pick = null, pickScore = groupScore;
    for (const b of blocks) {
      if (b === best) continue;
      const sameColumn = b.hpos >= group.hpos - 80 && b.hpos + b.w <= group.hpos + group.w + 80;
      const near = b.vpos >= group.vpos - 900 && b.vpos <= group.vpos + group.h + 900;
      if (!sameColumn || !near) continue;
      const s = scoreText(group.text + ' ' + b.text, toks);
      if (s > pickScore + 1e-9) { pickScore = s; pick = b; }
    }
    if (!pick) break;
    const right = Math.max(group.hpos + group.w, pick.hpos + pick.w);
    const bottom = Math.max(group.vpos + group.h, pick.vpos + pick.h);
    group.hpos = Math.min(group.hpos, pick.hpos);
    group.vpos = Math.min(group.vpos, pick.vpos);
    group.w = right - group.hpos;
    group.h = bottom - group.vpos;
    group.text += ' ' + pick.text;
    groupScore = pickScore;
  }
  if (groupScore > bestScore) { best = group; bestScore = groupScore; }
  if (bestScore < 0.6) return { failed: true, score: bestScore };

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

// ---------- ledger ----------
const ledgerPath = path.join(DOCS, 'IMAGE_ACQUISITION_LEDGER.json');
let ledger = fs.existsSync(ledgerPath) ? readJson(ledgerPath) : { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

// Resume: skip pages already stored. Without this a re-run refetches all 400+
// Oregon pages even though nothing has changed. --retry-crops additionally
// revisits stored pages that still have no article crop.
const pending = work.filter(it => {
  const e = ledger.items[it.hn + '|' + it.pageUrl];
  if (!e) return true;
  if (RETRY_CROPS && !e.crop_asset) {
    // Only revisit pages that have some headline text to test. Pages with no
    // quoted headline anywhere stay as honest full-page-only entries.
    const m = metaByPage[it.pageUrl] || {};
    const rec = recordById[it.hn] || {};
    return !!m.headline || recordHeadlineCandidates(rec).length > 0;
  }
  return !(e.status === 'full_page_acquired' || e.status === 'crop_acquired');
});
console.log(`Already stored: ${work.length - pending.length} of ${work.length} Oregon pages${RETRY_CROPS ? ' (retrying pages without a crop)' : ''}`);

const target = pending.slice(0, LIMIT === Infinity ? pending.length : LIMIT);
console.log(`Work items: ${target.length} (from ${work.length} Oregon page URLs across ${Object.keys(hnUrls).length} records)`);

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

    // 4. article crop located via the archive's ALTO OCR coordinates.
    //    Prefer the batch-report headline; when the report line did not quote
    //    one, fall back to a quoted headline from the record's own text. Either
    //    way the archive's OCR must match it at >= 0.6 before anything is
    //    cropped, so a paraphrase is never turned into a crop.
    const meta = metaByPage[item.pageUrl] || {};
    entry.newspaper = meta.paper || '';
    const record = recordById[item.hn] || {};
    const candidates = [];
    if (meta.headline) candidates.push({ text: meta.headline, source: 'batch_report' });
    // Even when a batch headline exists it can be a different paper's wording
    // (or split across blocks); the record's own quoted headline is a valid
    // second attempt, still gated on >= 0.6 OCR match.
    for (const c of recordHeadlineCandidates(record)) {
      if (!candidates.some(x => x.text.toLowerCase() === c.text.toLowerCase())) {
        candidates.push({ text: c.text, source: 'record_quote' });
      }
    }
    entry.headline = meta.headline || '';
    entry.headline_source = meta.headline ? 'batch_report' : null;
    if (candidates.length && w && h) {
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
        let loc = null, used = null;
        for (const c of candidates.slice(0, 4)) {
          const attempt = locateArticle(blocks, c.text, w, scale);
          if (attempt && !attempt.failed) { loc = attempt; used = c; break; }
          if (!loc || (attempt && (attempt.score || 0) > (loc.score || 0))) { loc = attempt; used = c; }
        }
        if (loc && !loc.failed) {
          const r = loc.region;
          const cx = Math.max(0, Math.min(r.x, w - 1));
          const cy = Math.max(0, Math.min(r.y, h - 1));
          const cw = Math.min(r.w, w - cx);
          const ch = Math.min(r.h, h - cy);
          // A real article is at least a column wide. A tiny region means the
          // match anchored on an OCR fragment (caption, marginal artifact), not
          // the article, so treat it as a failed match rather than store a
          // degenerate sliver.
          if (cw < 150 || ch < 120) {
            entry.crop_status = 'no_confident_match';
            entry.crop_match_score = Number(loc.score.toFixed(2));
            entry.crop_note = `degenerate region ${cw}x${ch}`;
          } else {
            const cropName = base + '-article.jpg';
            const cropPath = path.join(IMG_DIR, cropName);
            // Ask for the region at native resolution. The server returns 501 when
            // the requested output area exceeds maxArea, so retry at half width.
            const region = `${cx},${cy},${cw},${ch}`;
            // Record the attempted region up front so a failed crop still tells us
            // exactly where the headline was located.
            entry.crop_coordinates = region;
            let cb;
            if (fs.existsSync(cropPath)) {
              cb = fs.statSync(cropPath).size;
            } else {
              try {
                cb = await download(`https://oregonnews.uoregon.edu/images/iiif/${entry.iiif_id}/${region}/max/0/default.jpg`, cropPath);
              } catch (e) {
                cb = await download(`https://oregonnews.uoregon.edu/images/iiif/${entry.iiif_id}/${region}/${Math.max(1, Math.round(cw / 2))},/0/default.jpg`, cropPath);
              }
            }
            entry.headline = used.text;
            entry.headline_source = used.source;
            entry.crop_asset = 'assets/images/' + cropName;
            entry.crop_bytes = cb;
            entry.crop_coordinates = `${cx},${cy},${cw},${ch}`;
            entry.crop_match_score = Number(loc.score.toFixed(2));
            entry.crop_status = 'crop_acquired';
          }
        } else {
          entry.crop_status = loc && loc.failed ? 'no_confident_match' : 'no_headline';
          if (loc) entry.crop_match_score = Number((loc.score || 0).toFixed(2));
        }
      } catch (e) {
        entry.crop_status = 'crop_failed';
        entry.crop_error = e.message;
      }
    } else {
      entry.crop_status = candidates.length ? 'missing_dimensions' : 'no_headline';
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
