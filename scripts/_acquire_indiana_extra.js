// Add ONE additional Indiana article clip that the main acquirer skipped because
// it picks only the first article-level citation per record. This does NOT
// supersede any existing entry; it adds a new ledger entry keyed hn|url.
//
// Usage: node scripts/_acquire_indiana_extra.js "HN-250|https://newspapers.library.in.gov/?a=d&d=RLRP18810804.2.16"
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'INDIANA_IMAGE_ACQUISITION_LEDGER.json');
const SESSION_PATH = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-session.json';
const TMP = path.join('C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-blocks');
const PROVIDER = 'Hoosier State Chronicles (Indiana State Library)';
const E = '&e=-------en-20--1--txt-txIN-------';

fs.mkdirSync(TMP, { recursive: true });
function readJson(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function decodeEntities(v) {
  return String(v).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)));
}
const session = readJson(SESSION_PATH);
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
  if (buf.length < 3000) throw new Error('suspiciously small image (' + buf.length + ' bytes)');
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) throw new Error('not a JPEG');
  fs.writeFileSync(dest, buf);
}
function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}
function parseViewerData(html) {
  const marker = 'data-viewer-data-base-json=';
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const quote = html[i + marker.length];
  if (quote !== '"' && quote !== "'") return null;
  const start = i + marker.length + 1;
  const end = html.indexOf(quote, start);
  if (end < 0) return null;
  const raw = html.slice(start, end).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function stack(blocks, outFile) {
  if (blocks.length === 1) { fs.copyFileSync(blocks[0].file, outFile); return ffprobeSize(outFile); }
  const maxW = Math.max(...blocks.map(b => b.w));
  const inputs = [], pads = [], labels = [];
  blocks.forEach((b, i) => {
    inputs.push('-i', b.file);
    pads.push(`[${i}:v]pad=${maxW}:ih:(ow-iw)/2:0:color=white[p${i}]`);
    labels.push(`[p${i}]`);
  });
  const filter = pads.join(';') + ';' + labels.join('') + `vstack=inputs=${blocks.length}[out]`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filter, '-map', '[out]', '-q:v', '2', outFile], { stdio: 'pipe' });
  return ffprobeSize(outFile);
}

(async () => {
  const ledger = readJson(LEDGER_PATH);
  if (!ledger.items) ledger.items = {};
  const pairs = process.argv.slice(2).map(s => { const [hn, url] = s.split('|'); return { hn, url }; });
  for (const { hn, url } of pairs) {
    const key = hn + '|' + url;
    const prior = ledger.items[key];
    if (prior && prior.status === 'article_clip_acquired') { console.log(hn + ' already acquired for this URL; skipping'); continue; }
    const clipUrl = url + (url.includes('?') ? '&' : '?') + 'dliv=none' + E;
    const html = await getText(clipUrl);
    const title = decodeEntities((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const headline = title.split(/\s+[\u2014-]\s+/)[0].trim();
    const blocks = [];
    for (const m of html.matchAll(/<img[^>]*alt="Block image"[^>]*>/gi)) {
      const tag = m[0];
      const src = (tag.match(/src="([^"]+)"/i) || [])[1] || '';
      if (!src) continue;
      let abs = decodeEntities(src).replace(/&amp;/g, '&');
      if (abs.startsWith('/')) abs = 'https://newspapers.library.in.gov' + abs;
      blocks.push(abs);
    }
    if (!blocks.length) { console.log(hn + '  NO BLOCKS'); continue; }
    let pageId = null;
    try { const v = parseViewerData(await getText(url + E)); pageId = v && v.initialDisplayPageArea && v.initialDisplayPageArea.pageID; } catch (e) {}
    const d = url.match(/[?&]d=([A-Za-z0-9]+?)(\d{8})\.(\d+)\.(\d+)/);
    const paperCode = d[1], ymd = d[2], pageNo = d[3], section = d[4];
    const actualPage = pageId ? (Number(pageId.split('.')[1]) || Number(pageId.split('.')[0])) : Number(pageNo);
    const base = `hn-${hn.replace('HN-', '')}-in-${paperCode}${ymd}-p${actualPage}-s${section}`;
    const outName = base + '-article.jpg';
    const outPath = path.join(IMG_DIR, outName);
    const workDir = path.join(TMP, base);
    fs.mkdirSync(workDir, { recursive: true });
    const local = [];
    for (let i = 0; i < blocks.length; i++) {
      const nativeUrl = blocks[i].replace(/&width=\d+/, '');
      const file = path.join(workDir, `block-${String(i + 1).padStart(2, '0')}.jpg`);
      if (!fs.existsSync(file)) { await getJpeg(nativeUrl, file); await sleep(400); }
      const s = ffprobeSize(file);
      local.push({ file, w: s.w, h: s.h });
    }
    const dims = stack(local, outPath);
    ledger.items[key] = {
      hn_id: hn,
      provider: PROVIDER,
      status: 'article_clip_acquired',
      page_url: url,
      clip_url: clipUrl,
      newspaper: '',
      headline,
      issue_date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
      page: actualPage,
      section: Number(section) || null,
      page_key: pageId,
      cited_section: `${pageNo}.${section}`,
      block_count: blocks.length,
      crop_asset: 'assets/images/' + outName,
      crop_dimensions: `${dims.w}x${dims.h}`,
      source_dimensions: `${dims.w}x${dims.h}`,
      crop_coordinates: null,
      crop_method: 'archive_article_blocks_native',
      error: null,
      acquired_at: new Date().toISOString(),
      sequence: actualPage || 1,
      additional_cited_article: true,
    };
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
    console.log(`${hn}  OK  ${dims.w}x${dims.h}  blocks=${blocks.length}  ${headline.slice(0, 60)}`);
  }
  const images = buildImages();
  let items = 0, crops = 0;
  for (const k of Object.keys(images)) { items += images[k].length; crops += images[k].filter(i => i.crop).length; }
  console.log(`\nimages.json: records=${Object.keys(images).length} items=${items} crops=${crops}`);
})().catch(e => { console.error(e); process.exit(1); });
