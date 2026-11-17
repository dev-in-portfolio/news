// Acquire authentic article images from Hoosier State Chronicles
// (newspapers.library.in.gov, Indiana State Library).
//
// Full-page downloads on this site require a free account, and the OpenSeadragon
// tile service caps tiles at 256x256. But the site's public "Clip this article"
// view (?&dliv=none) exposes each article block through
//   ?a=is&oid=<page>.<section>&type=blockimage&area=N
// and that endpoint returns the block as a NATIVE-RESOLUTION crop of the
// archive's own scan. We download those blocks and stack them in the archive's
// own clip order, producing the article as the archive itself presents it.
//
// No full-page scan is stored for this provider: the page is only available as
// 256-px tiles or behind a login, so the card links to the archive viewer.
//
// Usage:
//   node scripts/acquire_indiana_images.js [--only HN-378,HN-379] [--limit N] [--dry] [--delay MS]
//   node scripts/acquire_indiana_images.js --retry-failed
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'INDIANA_IMAGE_ACQUISITION_LEDGER.json');
const SESSION_PATH = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-session.json';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-blocks';
const E = '&e=-------en-20--1--txt-txIN-------';
const PROVIDER = 'Hoosier State Chronicles (Indiana State Library)';

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const LIMIT = argVal('--limit') ? Number(argVal('--limit')) : Infinity;
const DELAY = argVal('--delay') ? Number(argVal('--delay')) : 1000;
const DRY = args.includes('--dry');
const RETRY = args.includes('--retry-failed');
const FORCE = args.includes('--force');

// A cited section can be wrong in the source corpus. Each override below was
// checked against the archive's own section list and search index, not guessed.
// The record's original URL is preserved on the new ledger entry as
// `cited_url_original`.
const SECTION_OVERRIDES = {
  // HN-231 cites section 2.12, whose archive title is "A Magnificient Offer."
  // The Schiller report is section 2.4, "The Loss of the Steamer Schiller."
  // (archive search: "Schiller" -> JPRP18750514.2.4), same issue and page 1.
  'HN-231': {
    url: 'https://newspapers.library.in.gov/?a=d&d=JPRP18750514.2.4',
    reason: 'cited section 2.12 is "A Magnificient Offer."; the Schiller report is section 2.4 "The Loss of the Steamer Schiller." in the same issue',
  },
};

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function decodeEntities(v) {
  return v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)));
}

// ---------- work list ----------
const hnUrls = readJsonIf(path.join(ROOT, 'scripts', 'hn_urls.json')) || {};
const hnMeta = readJsonIf(path.join(ROOT, 'scripts', 'hn_url_meta.json')) || {};
const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

// The URL suffix is <edition>.<section>. Page-level citations use edition 1
// (e.g. 1.39 = page 39) and the archive's clip view has no article blocks for
// them; those pages are covered by the full-page mosaic pipeline instead.
// Article-level citations use edition >= 2 (e.g. 2.6 = page 2, article 6) and
// do expose native-resolution block images.
const work = [];
let pageLevelOnly = 0;
for (const hn of Object.keys(hnUrls).sort()) {
  if (ONLY && !ONLY.has(hn)) continue;
  const override = SECTION_OVERRIDES[hn];
  const cands = [];
  if (override) {
    cands.push({ url: override.url, section: 2, override });
  } else {
    for (const raw of hnUrls[hn]) {
      const url = String(raw).replace(/&amp;/g, '&');
      if (!/newspapers\.library\.in\.gov/i.test(url)) continue;
      const m = url.match(/[?&]d=[A-Za-z0-9]+?\d{8}(?:-\d+)?\.(\d+)\.(\d+)/);
      if (!m) continue;
      cands.push({ url, section: Number(m[1]) });
    }
  }
  const articleLevel = cands.filter(c => c.section >= 2);
  if (!articleLevel.length) { if (cands.length) pageLevelOnly++; continue; }
  let picked = null;
  for (const c of articleLevel) {
    const key = hn + '|' + c.url;
    const prior = ledger.items[key] && ledger.items[key].status;
    if (prior === 'article_clip_acquired' && !(FORCE && c.override)) { picked = null; break; }
    if (prior === 'no_article_clip' && !args.includes('--retry-all') && !FORCE) continue;
    picked = { hn, url: c.url, key, override: c.override || null };
    break;
  }
  if (picked) work.push(picked);
}
work.sort((a, b) => a.hn.localeCompare(b.hn));
const target = work.slice(0, LIMIT === Infinity ? work.length : LIMIT);

console.log(`Indiana work items: ${target.length} (from ${work.length})  records=${new Set(target.map(w => w.hn)).size}  page-level-only skipped=${pageLevelOnly}`);
if (DRY) {
  target.slice(0, 40).forEach(w => console.log('  ' + w.hn + '  ' + w.url));
  process.exit(0);
}

// ---------- HTTP ----------
let session = readJsonIf(SESSION_PATH);
if (!session) {
  console.error('No session file. Run: node scripts/indiana_session.js');
  process.exit(1);
}
const headers = () => ({ 'User-Agent': session.ua, Cookie: session.cookieHeader, Accept: '*/*' });

class ChallengeError extends Error {}

async function getText(url) {
  const r = await fetch(url, { headers: headers(), redirect: 'follow', signal: AbortSignal.timeout(90000) });
  const text = await r.text();
  if (/Just a moment|Performing security verification/i.test(text.slice(0, 4000))) throw new ChallengeError('cloudflare challenge');
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return text;
}

async function getJpeg(url, dest) {
  const r = await fetch(url, { headers: headers(), redirect: 'follow', signal: AbortSignal.timeout(120000) });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 3000) {
    const head = buf.slice(0, 200).toString('utf8');
    if (/Just a moment|security verification/i.test(head)) throw new ChallengeError('cloudflare challenge');
    throw new Error('suspiciously small image (' + buf.length + ' bytes)');
  }
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) {
    if (buf.slice(0, 3).toString() === 'GIF') throw new Error('blank tile GIF returned');
    throw new Error('not a JPEG');
  }
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}

// The cited URL's suffix is a SECTION id, not a page key. The viewer's
// initialDisplayPageArea names the page that actually holds the section.
function parseViewerData(html) {
  const marker = 'data-viewer-data-base-json=';
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const quote = html[i + marker.length];
  if (quote !== '"' && quote !== "'") return null;
  const start = i + marker.length + 1;
  const end = html.indexOf(quote, start);
  if (end < 0) return null;
  let raw = html.slice(start, end)
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function resolvePageId(sectionUrl) {
  const html = await getText(sectionUrl + E);
  const v = parseViewerData(html);
  const area = v && v.initialDisplayPageArea;
  return area && area.pageID ? area.pageID : null;
}

function stack(blocks, outFile) {
  if (blocks.length === 1) {
    fs.copyFileSync(blocks[0].file, outFile);
    return ffprobeSize(outFile);
  }
  const maxW = Math.max(...blocks.map(b => b.w));
  const inputs = [];
  const pads = [];
  const labels = [];
  blocks.forEach((b, i) => {
    inputs.push('-i', b.file);
    pads.push(`[${i}:v]pad=${maxW}:ih:(ow-iw)/2:0:color=white[p${i}]`);
    labels.push(`[p${i}]`);
  });
  const filter = pads.join(';') + ';' + labels.join('') + `vstack=inputs=${blocks.length}[out]`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filter,
    '-map', '[out]', '-q:v', '2', outFile], { stdio: 'pipe' });
  return ffprobeSize(outFile);
}

// ---------- parse the clip page ----------
function parseClip(html, url) {
  const rawTitle = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const title = decodeEntities(rawTitle).trim();
  const parts = title.split(/\s+[\u2014-]\s+/);
  const headline = (parts[0] || '').trim();
  const citation = (parts[1] || '').trim();

  const blocks = [];
  const re = /<img[^>]*alt="Block image"[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const src = (tag.match(/src="([^"]+)"/i) || [])[1] || '';
    const style = (tag.match(/style="([^"]*)"/i) || [])[1] || '';
    const w = Number((style.match(/width:\s*(\d+)px/) || [])[1] || 0);
    const h = Number((style.match(/height:\s*(\d+)px/) || [])[1] || 0);
    if (!src) continue;
    let abs = decodeEntities(src).replace(/&amp;/g, '&');
    if (abs.startsWith('/')) abs = 'https://newspapers.library.in.gov' + abs;
    blocks.push({ url: abs, w, h });
  }

  // Newspaper / volume line, e.g. "Jasper County Democrat, Volume 14, Number 69, Rensselaer, Jasper County, 6 December 1911"
  const plain = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  const vol = plain.match(/([A-Z][^.]{2,80}?),\s*Volume\s+\d+[^—]{0,200}/);

  const d = url.match(/[?&]d=([A-Za-z0-9]+?)(\d{8})\.(\d+)\.(\d+)/);
  const paperCode = d ? d[1] : '';
  const ymd = d ? d[2] : '';
  const pageNo = d ? d[3] : '';
  const section = d ? d[4] : '';

  return {
    title, headline, citation, blocks,
    paperCode, ymd, pageNo, section,
    volumeLine: vol ? vol[0].trim() : '',
  };
}

// ---------- per item ----------
async function processItem(item, idx) {
  const tag = `[${idx + 1}/${target.length}] ${item.hn}`;
  const clipUrl = item.url + (item.url.includes('?') ? '&' : '?') + 'dliv=none' + E;
  const entry = {
    hn_id: item.hn,
    provider: PROVIDER,
    status: 'pending',
    page_url: item.url,
    clip_url: clipUrl,
    newspaper: '',
    headline: '',
    issue_date: '',
    page: null,
    section: null,
    page_key: null,
    cited_section: null,
    block_count: 0,
    crop_asset: null,
    crop_dimensions: null,
    source_dimensions: null,
    crop_coordinates: null,
    error: null,
    acquired_at: null,
  };

  try {
    const html = await getText(clipUrl);
    const p = parseClip(html, item.url);
    let pageId = null;
    try { pageId = await resolvePageId(item.url); } catch (e) { if (e instanceof ChallengeError) throw e; }
    const actualPage = pageId
      ? (Number(pageId.split('.')[1]) || Number(pageId.split('.')[0]))
      : (Number(p.pageNo) || null);
    entry.newspaper = (p.volumeLine.split(',')[0] || '').trim();
    entry.headline = p.headline;
    entry.issue_date = p.ymd ? `${p.ymd.slice(0, 4)}-${p.ymd.slice(4, 6)}-${p.ymd.slice(6, 8)}` : '';
    entry.page_key = pageId;
    entry.cited_section = `${p.pageNo}.${p.section}`;
    entry.page = actualPage;
    entry.section = Number(p.section) || null;
    entry.sequence = actualPage || 1;
    entry.block_count = p.blocks.length;
    if (!p.blocks.length) throw new Error('no article blocks on clip page');

    const base = `hn-${item.hn.replace('HN-', '')}-in-${p.paperCode}${p.ymd}-p${actualPage}-s${p.section}`;
    const outName = base + '-article.jpg';
    const outPath = path.join(IMG_DIR, outName);
    const workDir = path.join(TMP, base);
    fs.mkdirSync(workDir, { recursive: true });

    const local = [];
    for (let i = 0; i < p.blocks.length; i++) {
      const b = p.blocks[i];
      // Native resolution: drop the display width parameter.
      const nativeUrl = b.url.replace(/&width=\d+/, '');
      const file = path.join(workDir, `block-${String(i + 1).padStart(2, '0')}.jpg`);
      if (!fs.existsSync(file)) {
        await getJpeg(nativeUrl, file);
        await sleep(400);
      }
      const size = ffprobeSize(file);
      local.push({ file, w: size.w, h: size.h });
    }

    const dims = stack(local, outPath);
    entry.crop_asset = 'assets/images/' + outName;
    entry.crop_dimensions = `${dims.w}x${dims.h}`;
    entry.source_dimensions = `${dims.w}x${dims.h}`;
    entry.crop_coordinates = null;
    entry.crop_method = 'archive_article_blocks_native';
    entry.status = 'article_clip_acquired';
    entry.acquired_at = new Date().toISOString();

    // A section override replaces an earlier clip acquired from a wrong citation.
    // Mark the old entry superseded and delete its file so the site never shows
    // the wrong section alongside the right one.
    if (item.override) {
      entry.cited_url_original = (hnUrls[item.hn] || [])[0] || null;
      entry.section_override_reason = item.override.reason;
      for (const [k, v] of Object.entries(ledger.items)) {
        if (!v || v.hn_id !== item.hn || k === item.key) continue;
        if (v.status !== 'article_clip_acquired') continue;
        v.status = 'superseded';
        v.superseded_by = item.key;
        v.superseded_reason = item.override.reason;
        if (v.crop_asset) {
          const stale = path.join(ROOT, 'site', v.crop_asset);
          try { if (fs.existsSync(stale)) fs.unlinkSync(stale); } catch (e) {}
        }
      }
    }
    console.log(`${tag}  OK  blocks=${p.blocks.length}  ${dims.w}x${dims.h}  ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB  ${entry.headline.slice(0, 60)}`);
  } catch (e) {
    if (/no article blocks/i.test(e.message)) {
      entry.status = 'no_article_clip';
      entry.error = 'page-level citation: the archive clip view has no article blocks for this URL';
      console.log(`${tag}  NO CLIP  ${entry.error}`);
    } else {
      entry.status = 'failed';
      entry.error = e.message;
      console.log(`${tag}  FAIL  ${e.message}`);
    }
    if (e instanceof ChallengeError) throw e;
  }

  ledger.items[item.key] = entry;
  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  return entry;
}

(async () => {
  const results = [];
  for (let i = 0; i < target.length; i++) {
    await sleep(DELAY);
    try {
      results.push(await processItem(target[i], i));
    } catch (e) {
      console.log('\nStopping: ' + e.message + '. Run `node scripts/indiana_session.js` to refresh the session, then re-run with --retry-failed.');
      break;
    }
  }
  const images = buildImages();
  const ok = results.filter(r => r.status === 'article_clip_acquired').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const noclip = results.filter(r => r.status === 'no_article_clip').length;
  console.log(`\nAcquired: ${ok}   No article clip: ${noclip}   Failed: ${failed}`);
  console.log(`Total records with images (all providers): ${Object.keys(images).length}`);
  console.log('Wrote docs/INDIANA_IMAGE_ACQUISITION_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
