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

const work = [];
for (const hn of Object.keys(hnUrls).sort()) {
  if (ONLY && !ONLY.has(hn)) continue;
  for (const raw of hnUrls[hn]) {
    const url = String(raw).replace(/&amp;/g, '&');
    if (!/newspapers\.library\.in\.gov/i.test(url)) continue;
    if (!/[?&]d=[A-Za-z0-9]+?\d{8}\.\d+\.\d+/.test(url)) continue;
    const key = hn + '|' + url;
    const prior = ledger.items[key] && ledger.items[key].status;
    if (prior === 'article_clip_acquired') continue;
    if (prior === 'no_article_clip' && !args.includes('--retry-all')) continue;
    work.push({ hn, url, key });
    break; // one article URL per record is enough
  }
}
work.sort((a, b) => a.hn.localeCompare(b.hn));
const target = work.slice(0, LIMIT === Infinity ? work.length : LIMIT);

console.log(`Indiana work items: ${target.length} (from ${work.length})  records=${new Set(target.map(w => w.hn)).size}`);
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
    entry.newspaper = (p.volumeLine.split(',')[0] || '').trim();
    entry.headline = p.headline;
    entry.issue_date = p.ymd ? `${p.ymd.slice(0, 4)}-${p.ymd.slice(4, 6)}-${p.ymd.slice(6, 8)}` : '';
    entry.page = Number(p.pageNo) || null;
    entry.section = Number(p.section) || null;
    entry.sequence = Number(p.pageNo) || 1;
    entry.block_count = p.blocks.length;
    if (!p.blocks.length) throw new Error('no article blocks on clip page');

    const base = `hn-${item.hn.replace('HN-', '')}-in-${p.paperCode}${p.ymd}-p${p.pageNo}-s${p.section}`;
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
