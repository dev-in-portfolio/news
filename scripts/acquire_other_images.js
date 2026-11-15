// Acquire authentic newspaper images from the smaller public archives that
// expose them directly:
//
//   - Baylor University Digital Collections (Quartex) -> IIIF Image API
//   - Birmingham Public Library (CONTENTdm)          -> IIIF Image API
//   - SCVHistory.com (Santa Clarita Valley Historical Society) -> page JPEGs
//
// Each stored file is a rendition the archive itself serves. No image is
// generated, retouched, or re-cropped.
//
// Usage:
//   node scripts/acquire_other_images.js [--only HN-456] [--dry] [--retry-failed]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');
const RETRY = args.includes('--retry-failed');

fs.mkdirSync(IMG_DIR, { recursive: true });

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
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)));
}
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}

async function getBuffer(url, timeout = 120000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return { buf: Buffer.from(await r.arrayBuffer()), ct: r.headers.get('content-type') || '' };
}
async function getText(url, timeout = 60000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json' }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.text();
}
async function saveJpeg(url, dest) {
  const { buf, ct } = await getBuffer(url);
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) throw new Error('not a JPEG (' + ct + ')');
  fs.writeFileSync(dest, buf);
  return ffprobeSize(dest);
}

// ---------- work list ----------
const hnUrls = readJsonIf(path.join(ROOT, 'scripts', 'hn_urls.json')) || {};
const images = readJsonIf(path.join(ROOT, 'site', 'data', 'images.json')) || {};
const records = readJsonIf(path.join(ROOT, 'site', 'data', 'records.json'));
const recArr = Array.isArray(records) ? records : (records.records || Object.values(records));
const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};
const withImage = new Set(Object.keys(images));

function hostKind(u) {
  if (/quartexcollections\.com\/Documents\/Detail\//i.test(u)) return 'quartex';
  if (/contentdm\.oclc\.org\/digital\/collection\//i.test(u)) return 'contentdm';
  if (/scvhistory\.com\/scvhistory\//i.test(u)) return 'scvhistory';
  return null;
}

const work = [];
for (const r of recArr) {
  if (ONLY && !ONLY.has(r.hn_id)) continue;
  if (withImage.has(r.hn_id) && !ONLY && !RETRY) continue;
  for (const raw of hnUrls[r.hn_id] || []) {
    const url = String(raw).replace(/&amp;/g, '&');
    const kind = hostKind(url);
    if (!kind) continue;
    const key = r.hn_id + '|' + url;
    const prior = ledger.items[key] && ledger.items[key].status;
    if (prior === 'image_acquired' && !RETRY) continue;
    work.push({ hn: r.hn_id, url, kind, key, date: r.date || '', heading: r.heading || '' });
  }
}
work.sort((a, b) => a.hn.localeCompare(b.hn) || a.url.localeCompare(b.url));
console.log(`Work items: ${work.length}  records=${new Set(work.map(w => w.hn)).size}`);
if (DRY) { work.forEach(w => console.log('  ' + w.hn + '  ' + w.kind + '  ' + w.url)); process.exit(0); }

// ---------- providers ----------
async function doQuartex(item) {
  const html = await getText(item.url);
  const manifestUrl = (html.match(/https:\/\/iiif\.quartexcollections\.com\/[^"'\s]+\/manifest/i) || [])[0];
  if (!manifestUrl) throw new Error('no IIIF manifest link on page');
  const manifest = JSON.parse(await getText(manifestUrl));
  const canvas = (manifest.sequences || [])[0] && (manifest.sequences[0].canvases || [])[0];
  if (!canvas) throw new Error('manifest has no canvas');
  const resource = canvas.images[0].resource;
  const service = (resource.service && (resource.service['@id'] || resource.service.id)) || '';
  if (!service) throw new Error('canvas image has no IIIF service');
  const width = Number(canvas.width || resource.width || 0);
  const height = Number(canvas.height || resource.height || 0);
  const meta = {};
  for (const m of manifest.metadata || []) meta[m.label] = Array.isArray(m.value) ? m.value.join(' ') : m.value;
  const outName = `hn-${item.hn.replace('HN-', '')}-quartex-${slug(meta['Digital ID'] || manifest.label || 'page')}-page.jpg`;
  const dims = await saveJpeg(service.replace(/\/$/, '') + '/full/full/0/default.jpg', path.join(IMG_DIR, outName));
  return {
    provider: 'Baylor University Digital Collections (Quartex)',
    newspaper: (meta['Title'] || manifest.label || '').split(' - ')[0],
    headline: '',
    issue_date: item.date,
    page_url: item.url,
    manifest_url: manifestUrl,
    full_page_asset: 'assets/images/' + outName,
    source_dimensions: `${width}x${height}`,
    output_dimensions: `${dims.w}x${dims.h}`,
    mosaic_method: 'archive_page_rendition',
  };
}

const CONTENTDM_PROVIDERS = {
  'bplonline.contentdm.oclc.org': 'Birmingham Public Library Digital Collections (CONTENTdm)',
  'bnl.contentdm.oclc.org': 'Bermuda National Library (CONTENTdm)',
};

async function doContentdm(item) {
  const m = item.url.match(/\/digital\/collection\/([^/]+)\/id\/(\d+)/i);
  if (!m) throw new Error('unrecognised CONTENTdm URL');
  const [, coll, id] = m;
  const host = new URL(item.url).hostname;

  // Compound items point at their display image through og:image; the item id
  // itself may not have an image service.
  const page = await getText(item.url);
  const ogImage = (page.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
  const svcMatch = ogImage.replace(/^http:/, 'https:').match(/^(https:\/\/[^/]+)\/iiif\/2\/([^/]+)\//);
  if (!svcMatch) throw new Error('no IIIF image service on CONTENTdm page');
  const service = svcMatch[1] + '/iiif/2/' + svcMatch[2];
  const info = JSON.parse(await getText(service + '/info.json'));
  const width = info.width, height = info.height;

  let fields = {};
  try {
    const api = JSON.parse(await getText(`https://${host}/digital/api/singleitem/collection/${coll}/id/${id}`));
    for (const f of api.fields || []) fields[f.key] = f.value;
  } catch (e) { /* metadata is optional */ }

  const title = decodeEntities(fields.title || '').trim();
  const publisher = decodeEntities(fields.publis || fields.masthe || '').trim();
  const type = (fields.type || '').toLowerCase();
  const isClipping = /clipping/.test(type);
  const outName = `hn-${item.hn.replace('HN-', '')}-contentdm-${coll}-${id}-${isClipping ? 'clipping' : 'page'}.jpg`;
  const dims = await saveJpeg(service + '/full/full/0/default.jpg', path.join(IMG_DIR, outName));
  return {
    provider: CONTENTDM_PROVIDERS[host] || host + ' (CONTENTdm)',
    newspaper: publisher || title,
    headline: isClipping ? title : '',
    issue_date: (fields.date || item.date || '').slice(0, 10),
    page_url: item.url,
    iiif_id: service,
    ...(isClipping
      ? { crop_asset: 'assets/images/' + outName, crop_method: 'archive_clipping_image' }
      : { full_page_asset: 'assets/images/' + outName, mosaic_method: 'archive_page_rendition' }),
    source_dimensions: `${width}x${height}`,
    output_dimensions: `${dims.w}x${dims.h}`,
  };
}

async function doScvhistory(item) {
  const html = await getText(item.url);
  const raw = [...html.matchAll(/<img[^>]+src=["']?([^"' >]+)/gi)].map(x => x[1])
    .filter(s => !/scvhist|quant|logo|pixel|spacer|icon/i.test(s));
  if (!raw.length) throw new Error('no page image on page');
  let abs = raw[0];
  if (abs.startsWith('../')) abs = 'https://scvhistory.com/' + abs.slice(3);
  else if (abs.startsWith('/')) abs = 'https://scvhistory.com' + abs;
  else if (!/^http/i.test(abs)) abs = new URL(abs, item.url).href;
  const title = decodeEntities((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
  // Titles are one of:
  //   "SCVHistory.com AL2040 | St. Francis Dam Disaster | The Oakland Tribune: headline"
  //   "Albany Evening News: headline, 3-13-1928"
  let paper = title.includes('|') ? title.split('|').pop() : title;
  paper = paper.split(':')[0].trim()
    .replace(/\s*,?\s*\d{1,2}-\d{1,2}-\d{4}\.?$/, '')
    .replace(/^SCVHistory\.com\s*/i, '').trim();
  const headline = title.includes(':') ? title.slice(title.indexOf(':') + 1).trim() : '';
  const outName = `hn-${item.hn.replace('HN-', '')}-scvhistory-${slug(new URL(item.url).pathname.split('/').pop().replace('.htm', ''))}-page.jpg`;
  const dims = await saveJpeg(abs, path.join(IMG_DIR, outName));
  return {
    provider: 'SCVHistory.com (Santa Clarita Valley Historical Society)',
    newspaper: paper,
    headline,
    issue_date: item.date,
    page_url: item.url,
    image_url: abs,
    full_page_asset: 'assets/images/' + outName,
    source_dimensions: `${dims.w}x${dims.h}`,
    output_dimensions: `${dims.w}x${dims.h}`,
    mosaic_method: 'archive_page_rendition',
  };
}

const HANDLERS = { quartex: doQuartex, contentdm: doContentdm, scvhistory: doScvhistory };

(async () => {
  let ok = 0, fail = 0;
  for (let i = 0; i < work.length; i++) {
    const item = work[i];
    const tag = `[${i + 1}/${work.length}] ${item.hn} ${item.kind}`;
    const entry = { hn_id: item.hn, status: 'pending', page_url: item.url, error: null, acquired_at: null };
    try {
      await sleep(600);
      const res = await HANDLERS[item.kind](item);
      Object.assign(entry, res);
      entry.status = 'image_acquired';
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(`${tag}  OK  ${res.output_dimensions}  ${entry.newspaper.slice(0, 40)}`);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      fail++;
      console.log(`${tag}  FAIL  ${e.message}`);
    }
    ledger.items[item.key] = entry;
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  }
  const imgs = buildImages();
  console.log(`\nAcquired: ${ok}   Failed: ${fail}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
  console.log('Wrote docs/OTHER_IMAGE_ACQUISITION_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
