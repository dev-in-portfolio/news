// ============================================================================
// Acquire authentic article images from Papers Past
// (paperspast.natlib.govt.nz, National Library of New Zealand).
//
// Papers Past sits behind an Incapsula (Imperva) JS challenge. A real Chrome
// session (scripts/paperspast_session.js) clears it; the resulting cookies let
// plain HTTP requests through.
//
// Each article page exposes the archive's own article blocks as
//   /imageserver/newspapers/<base64 token>
// where the token decodes to
//   ?oid=<article id>&colours=32&ext=gif&area=N&width=<display px>
// Dropping `width` and setting `ext=png` returns the block at its native scan
// resolution (exactly 2x the displayed width on the pages tested). The image
// server requires a Referer header pointing at the article page.
//
// This script downloads those blocks in the archive's own presentation order,
// stacks them vertically with white padding, and stores the result as the
// article as the archive itself presents it. No retouching, no generated art.
//
// The Papers Past URLs in scripts/hn_urls.json come from the records' cited
// audit links: contemporaneous reports the record cites as corroborating
// evidence. They are stored as additional, separately-labelled article clips;
// they are never used as a substitute for a record's primary cited article.
//
// Writes: site/assets/images/*.jpg
//         docs/PAPERSPAST_IMAGE_ACQUISITION_LEDGER.json
//         site/data/images.json   (via lib_image_merge)
//
// Usage:
//   node scripts/acquire_paperspast_images.js [--only HN-350,HN-366] [--limit N] [--dry] [--force]
// ============================================================================
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'PAPERSPAST_IMAGE_ACQUISITION_LEDGER.json');
const SESSION_PATH = 'C:/Users/dtoro/AppData/Local/Temp/opencode/paperspast-session.json';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/paperspast-blocks';
const PROVIDER = 'Papers Past (National Library of New Zealand)';

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const LIMIT = argVal('--limit') ? Number(argVal('--limit')) : Infinity;
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- session ----------
const session = readJsonIf(SESSION_PATH);
if (!session || !session.cookieHeader) {
  console.error('No Papers Past session. Run: node scripts/paperspast_session.js');
  process.exit(1);
}

// ---------- work list ----------
const hnUrls = readJsonIf(path.join(ROOT, 'scripts', 'hn_urls.json')) || {};
const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, provider: PROVIDER, items: {} };
if (!ledger.items) ledger.items = {};

// Article pages only. Skip search-result and date-browse URLs.
const ARTICLE_RE = /paperspast\.natlib\.govt\.nz\/newspapers\/([A-Za-z0-9]+?)(\d{8})\.(\d+)\.(\d+)(?:\.(\d+))?/;

const work = [];
for (const hn of Object.keys(hnUrls).sort()) {
  if (ONLY && !ONLY.has(hn)) continue;
  const seen = new Set();
  let seq = 0;
  for (const raw of hnUrls[hn]) {
    const url = String(raw).replace(/&amp;/g, '&');
    const m = url.match(ARTICLE_RE);
    if (!m) continue;
    const clean = url.split('?')[0];
    if (seen.has(clean)) continue;
    seen.add(clean);
    seq++;
    const key = hn + '|' + clean;
    const prior = ledger.items[key] && ledger.items[key].status;
    if (prior === 'article_clip_acquired' && !FORCE) continue;
    work.push({
      hn, url: clean, key, sequence: seq,
      paperId: m[1] + m[2], edition: Number(m[3]), page: Number(m[4]),
      article: m[5] != null ? Number(m[5]) : null,
    });
  }
}
work.sort((a, b) => a.hn.localeCompare(b.hn) || a.sequence - b.sequence);
const target = work.slice(0, LIMIT === Infinity ? work.length : LIMIT);
console.log(`Papers Past work items: ${target.length} (from ${work.length})  records=${new Set(target.map(w => w.hn)).size}`);
if (DRY) {
  target.forEach(w => console.log('  ' + w.hn + '  ' + w.url));
  process.exit(0);
}

// ---------- HTTP ----------
class ChallengeError extends Error {}
const headers = (extra) => ({ 'User-Agent': session.ua, Cookie: session.cookieHeader, Accept: '*/*', ...(extra || {}) });

async function getText(url, referer) {
  const r = await fetch(url, { headers: headers(referer ? { Referer: referer } : null), redirect: 'follow', signal: AbortSignal.timeout(90000) });
  const text = await r.text();
  if (/incapsula|request unsuccessful|access denied|pardon our interruption/i.test(text.slice(0, 3000))) {
    throw new ChallengeError('Incapsula challenge');
  }
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return text;
}

async function getPng(url, dest, referer) {
  const r = await fetch(url, { headers: headers({ Referer: referer, Accept: 'image/*,*/*' }), redirect: 'follow', signal: AbortSignal.timeout(90000) });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 200) throw new Error('suspiciously small block (' + buf.length + ' bytes)');
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    const head = buf.slice(0, 200).toString('utf8');
    if (/incapsula|request unsuccessful|access denied/i.test(head)) throw new ChallengeError('Incapsula challenge on image server');
    throw new Error('not a PNG (magic ' + buf.slice(0, 4).toString('hex') + ')');
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

function decodeToken(tok) {
  const b64 = tok.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}
function encodeToken(query) {
  return Buffer.from(query).toString('base64');
}

// ---------- parse article page ----------
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
function decodeEntities(v) {
  return String(v).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013').replace(/&nbsp;/g, ' ');
}
function parseTitle(html) {
  const raw = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const title = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  const parts = title.split(' | ');
  // Papers Past | Newspapers | <paper> | <date> | <headline>
  const newspaper = parts.length >= 3 ? parts[2].trim() : '';
  const dateStr = parts.length >= 4 ? parts[3].trim() : '';
  let headline = parts.length >= 5 ? parts.slice(4).join(' | ').trim() : '';
  let issueDate = '';
  const dm = dateStr.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dm && MONTHS[dm[2].toLowerCase()]) {
    issueDate = dm[3] + '-' + String(MONTHS[dm[2].toLowerCase()]).padStart(2, '0') + '-' + String(dm[1]).padStart(2, '0');
  }
  // Some article pages open with the masthead and date, so the <title> headline
  // is the masthead (or truncated). The page's meta description carries the
  // full article opening; the real headline follows the date there.
  if (!headline || /\.{3,}$/.test(headline) || /\bAND DAILY\b/i.test(headline) || /^THE\s+[A-Z][A-Z\s]+\bAND\b/.test(headline)) {
    const metas = [...html.matchAll(/<meta[^>]+>/gi)].map(m => m[0]);
    let meta = '';
    for (const tag of metas) {
      if (!/(?:name|property)=["'](?:description|og:description|keywords|twitter:description)["']/i.test(tag)) continue;
      const cm = tag.match(/content=["']([^"']+)["']/i);
      if (cm && cm[1].length > meta.length) meta = cm[1];
    }
    if (meta) {
      const text = decodeEntities(meta);
      const hm = text.match(/(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+[A-Z]+\s+\d{1,2},?\s+\d{4}\.?\s*([A-Z][^.]{2,140}\.)/);
      if (hm) headline = hm[1].trim();
    }
  }
  return { title, newspaper, issueDate, headline };
}

function blockTokens(html) {
  const toks = [];
  const seen = new Set();
  for (const m of html.matchAll(/\/imageserver\/newspapers\/([A-Za-z0-9_\-=]+)/g)) {
    const t = m[1];
    if (seen.has(t)) continue;
    seen.add(t);
    toks.push(t);
  }
  return toks;
}

// JPEG cannot encode a frame taller than 65,500 px. Very long article sections
// (e.g. a full wartime news page presented as one article) can exceed that when
// their native blocks are stacked. Split such a clip into vertical parts that
// each stay well under the limit; every part is still the archive's own blocks,
// in the archive's own order, with white padding only.
const MAX_PART_H = 60000;

function stackGroup(blocks, outFile) {
  if (!blocks.length) throw new Error('no blocks');
  if (blocks.length === 1) {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', blocks[0].file, '-q:v', '2', outFile], { stdio: 'pipe' });
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

// Returns [{ file, w, h, part }]. A clip that fits is a single part named
// <base>.jpg; an oversized clip becomes <base>-part1.jpg, <base>-part2.jpg, ...
function stackParts(blocks, outBase) {
  const groups = [];
  let cur = [];
  let curH = 0;
  for (const b of blocks) {
    if (cur.length && curH + b.h > MAX_PART_H) {
      groups.push(cur);
      cur = [];
      curH = 0;
    }
    cur.push(b);
    curH += b.h;
  }
  if (cur.length) groups.push(cur);
  return groups.map((g, i) => {
    const file = groups.length === 1 ? outBase : outBase.replace(/\.jpg$/i, `-part${i + 1}.jpg`);
    const dim = stackGroup(g, file);
    return { file, w: dim.w, h: dim.h, part: i + 1 };
  });
}

// ---------- main ----------
(async () => {
  let acquired = 0, failed = 0, noBlocks = 0;
  for (const w of target) {
    const entry = {
      hn_id: w.hn,
      provider: PROVIDER,
      status: null,
      page_url: w.url,
      newspaper: '',
      headline: '',
      issue_date: '',
      page: w.page,
      edition: w.edition,
      article: w.article,
      cited_section: w.article != null ? `2.${w.page}.${w.article}` : `2.${w.page}`,
      page_key: `2.${w.page}`,
      block_count: 0,
      crop_asset: null,
      crop_dimensions: null,
      source_dimensions: null,
      crop_coordinates: null,
      error: null,
      acquired_at: null,
      sequence: w.sequence,
      crop_method: 'archive_article_blocks_native',
      source_kind: 'audit_link_report',
    };
    try {
      const html = await getText(w.url);
      const meta = parseTitle(html);
      entry.newspaper = meta.newspaper;
      entry.headline = meta.headline;
      entry.issue_date = meta.issueDate;
      const toks = blockTokens(html);
      if (!toks.length) {
        entry.status = 'no_article_blocks';
        noBlocks++;
        ledger.items[w.key] = entry;
        console.log(`${w.hn}  NO BLOCKS  ${w.url}`);
        continue;
      }
      const blocks = [];
      for (const tok of toks) {
        const q = decodeToken(tok);
        const params = new URLSearchParams(q.replace(/^\?/, ''));
        const area = params.get('area') || String(blocks.length + 1);
        params.delete('width');
        params.set('ext', 'png');
        const url = 'https://paperspast.natlib.govt.nz/imageserver/newspapers/' + encodeToken('?' + params.toString());
        const dest = path.join(TMP, `${w.hn}-${w.paperId}-${w.edition}-${w.page}-${w.article || 0}-area${area}.png`);
        await getPng(url, dest, w.url);
        const dim = ffprobeSize(dest);
        blocks.push({ file: dest, w: dim.w, h: dim.h, area });
        await sleep(500);
      }
      entry.block_count = blocks.length;
      entry.source_dimensions = `${Math.max(...blocks.map(b => b.w))}x${blocks.reduce((n, b) => n + b.h, 0)}`;
      const safeId = `${w.paperId}-${w.edition}-${w.page}${w.article != null ? '-' + w.article : ''}`.toLowerCase();
      const outFile = path.join(IMG_DIR, `hn-${w.hn.replace(/^HN-/, '')}-pp-${safeId}-article.jpg`);
      const parts = stackParts(blocks, outFile);
      const totalH = parts.reduce((n, p) => n + p.h, 0);
      const maxW = Math.max(...parts.map(p => p.w));
      if (maxW < 150 || totalH < 120) {
        for (const p of parts) { try { fs.unlinkSync(p.file); } catch (e) { /* ignore */ } }
        entry.status = 'no_confident_match';
        entry.error = 'degenerate stacked region ' + maxW + 'x' + totalH;
        noBlocks++;
        ledger.items[w.key] = entry;
        console.log(`${w.hn}  DEGENERATE ${maxW}x${totalH}  ${w.url}`);
        continue;
      }
      entry.status = 'article_clip_acquired';
      entry.crop_asset = 'assets/images/' + path.basename(parts[0].file);
      entry.crop_dimensions = parts.length === 1 ? `${parts[0].w}x${parts[0].h}` : `${maxW}x${totalH}`;
      if (parts.length > 1) {
        entry.crop_parts = parts.map(p => ({
          part: p.part,
          asset: 'assets/images/' + path.basename(p.file),
          dimensions: `${p.w}x${p.h}`,
        }));
      }
      entry.acquired_at = new Date().toISOString();
      ledger.items[w.key] = entry;
      acquired++;
      console.log(`${w.hn}  OK  ${maxW}x${totalH}${parts.length > 1 ? ' (' + parts.length + ' parts)' : ''}  blocks=${blocks.length}  ${entry.newspaper}  ${entry.issue_date}  ${entry.headline.slice(0, 60)}`);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      ledger.items[w.key] = entry;
      failed++;
      console.log(`${w.hn}  FAIL  ${e.message}  ${w.url}`);
      if (e instanceof ChallengeError) {
        console.error('\nPapers Past challenge expired. Run: node scripts/paperspast_session.js');
        break;
      }
    }
    await sleep(1000);
  }

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  const images = buildImages();
  let items = 0, crops = 0;
  for (const k of Object.keys(images)) { items += images[k].length; crops += images[k].filter(i => i.crop).length; }
  console.log(`\nacquired=${acquired}  failed=${failed}  no_blocks/degenerate=${noBlocks}`);
  console.log(`images.json: records=${Object.keys(images).length} items=${items} crops=${crops}`);
})();
