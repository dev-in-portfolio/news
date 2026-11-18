// Acquire article-level clippings for supporting NewspaperSG (National Library
// Board, Singapore) citations.
//
// The records cite an issue page. The issue page exposes the archive's own
// article list (link + article title), which identifies the specific article
// each record is about. The archive serves its own article clipping in one or
// more numbered areas:
//
//   https://eservice.nlb.gov.sg/newspapercontent/digitised/article/<id>.webp
//     ?area=N&width=1200&ct=ARTICLE&ns=&coord=
//
// but only when the request carries a Referer for the article page; without it
// the endpoint returns a 512x68 placeholder. Each real area is the archive's own
// clipping of one block of the article (headline, body, continuation), in the
// archive's own order. Areas past the article return a 322x68 placeholder.
//
// The stored file stacks the real areas vertically, in archive order, with white
// padding only (the same method used for multi-block Papers Past clips). No
// content is generated, retouched, or re-cropped. A stacked clip taller than the
// JPEG limit is split into ordered parts.
//
// Article text is not readable: NewspaperSG article pages sit behind an AWS WAF
// challenge that the browser cannot clear. Identity is therefore established by
// the archive's own article title on the cited issue page, recorded in the
// ledger as `article_title_match`.
//
// Usage:
//   node scripts/acquire_newspapersg_support.js [--only HN-460] [--dry]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'NEWSPAPERSG_SUPPORT_LEDGER.json');
const SESSION = 'C:/Users/dtoro/AppData/Local/Temp/opencode/newspapersg-session.json';
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/nlb-support';
const WIDTH = 1200;
const MAX_PART_H = 60000;
const PROVIDER = 'NewspaperSG (National Library Board, Singapore)';

const JOBS = [
  {
    hn: 'HN-460', issue: 'maltribune19281113-1', article: 'maltribune19281113-1.2.37',
    article_title: 'SHIPPING DISASTER.', newspaper: 'Malaya Tribune',
    issue_date: '1928-11-13', page: 9,
  },
  {
    hn: 'HN-461', issue: 'maltribune19281117-1', article: 'maltribune19281117-1.2.56',
    article_title: '"VESTRIS" DISASTER INQUIRY.', newspaper: 'Malaya Tribune',
    issue_date: '1928-11-17', page: 7,
  },
  {
    hn: 'HN-473', issue: 'straitstimes19310921-1', article: 'straitstimes19310921-1.2.68',
    article_title: 'Japanese Occupying Manchuria.', newspaper: 'The Straits Times',
    issue_date: '1931-09-21', page: 12,
  },
  {
    hn: 'HN-475', issue: 'straitstimes19311102-1', article: 'straitstimes19311102-1.2.39',
    article_title: 'WILL SOVIET RUSSIA INTERVENE IN MANCHURIA ?', newspaper: 'The Straits Times',
    issue_date: '1931-11-02', page: 9,
  },
  {
    hn: 'HN-483', issue: 'straitsbudget19330928-1', article: 'straitsbudget19330928-1.2.71.21',
    article_title: 'REICHSTAG FIRE TRIAL.', newspaper: 'The Straits Budget',
    issue_date: '1933-09-28', page: 13,
  },
  {
    hn: 'HN-591', issue: 'freepress19530306-1', article: 'freepress19530306-1.2.2',
    article_title: 'STALIN IS DEAD', newspaper: 'The Singapore Free Press',
    issue_date: '1953-03-06', page: 1,
  },
];

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

function readJson(p) { let raw = fs.readFileSync(p, 'utf8'); if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); return JSON.parse(raw); }
function readJsonIf(p) { try { return readJson(p); } catch (e) { return null; } }

const session = readJson(SESSION);
const UA = session.ua || 'Mozilla/5.0';
const COOKIE = session.cookieHeader || '';
if (!COOKIE) { console.error('No NewspaperSG session cookie; run scripts/newspapersg_session.js first.'); process.exit(1); }

const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
if (!ledger.items) ledger.items = {};

function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}

// 64x64 grayscale statistics, used to reject blank or degenerate clippings.
function grayStats(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=64:64,format=gray',
    '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  let sum = 0, sum2 = 0, min = 255;
  for (const v of raw) { sum += v; sum2 += v * v; if (v < min) min = v; }
  const n = raw.length;
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return { mean, sd, min, n };
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

async function fetchArea(job, area) {
  const articleUrl = 'https://eresources.nlb.gov.sg/newspapers/digitised/article/' + job.article;
  const imgUrl = `https://eservice.nlb.gov.sg/newspapercontent/digitised/article/${job.article}.webp?area=${area}&width=${WIDTH}&ct=ARTICLE&ns=&coord=`;
  const r = await fetch(imgUrl, {
    headers: {
      'User-Agent': UA, Cookie: COOKIE, Accept: 'image/webp,image/*,*/*',
      Referer: articleUrl,
    },
    redirect: 'follow', signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const isWebp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
  return { buf, isWebp, imgUrl, articleUrl };
}

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

(async () => {
  const jobs = ONLY ? JOBS.filter(j => ONLY.has(j.hn)) : JOBS;
  console.log(`NewspaperSG supporting jobs: ${jobs.length}`);
  if (DRY) { for (const j of jobs) console.log('  ' + j.hn + '  ' + j.article + '  ' + j.article_title); process.exit(0); }

  let ok = 0, fail = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const tag = `[${i + 1}/${jobs.length}] ${job.hn} ${job.article}`;
    const base = `hn-${job.hn.replace('HN-', '')}-newspapersg-${slug(job.article)}-clipping`;
    const outPath = path.join(IMG_DIR, base + '.jpg');
    const entry = {
      hn_id: job.hn, provider: PROVIDER, status: 'pending',
      page_url: 'https://eresources.nlb.gov.sg/newspapers/digitised/issue/' + job.issue,
      article_url: 'https://eresources.nlb.gov.sg/newspapers/digitised/article/' + job.article,
      newspaper: job.newspaper, issue_date: job.issue_date, page: job.page,
      article_id: job.article, archive_article_title: job.article_title,
      article_title_match: 'archive_issue_article_title',
      error: null, acquired_at: null,
    };
    const workDir = path.join(TMP, base);
    fs.mkdirSync(workDir, { recursive: true });
    try {
      const blocks = [];
      const areas = [];
      let placeholderRun = 0;
      for (let area = 1; area <= 10; area++) {
        const { buf, isWebp, imgUrl, articleUrl } = await fetchArea(job, area);
        if (!isWebp) {
          placeholderRun++;
          if (placeholderRun >= 2) break;
          continue;
        }
        placeholderRun = 0;
        const webp = path.join(workDir, `area-${area}.webp`);
        const jpg = path.join(workDir, `area-${area}.jpg`);
        fs.writeFileSync(webp, buf);
        execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', webp, '-q:v', '2', jpg], { stdio: 'pipe' });
        const dim = ffprobeSize(jpg);
        if (dim.w < 600 || dim.h < 20) { placeholderRun++; continue; }
        blocks.push({ file: jpg, w: dim.w, h: dim.h, area });
        areas.push({ area, dimensions: `${dim.w}x${dim.h}`, image_url: imgUrl, article_url: articleUrl });
      }
      if (!blocks.length) throw new Error('no real article areas returned');
      const parts = stackParts(blocks, outPath);
      const totalH = parts.reduce((n, p) => n + p.h, 0);
      const maxW = Math.max(...parts.map(p => p.w));
      if (maxW < 600 || totalH < 120) throw new Error('degenerate stacked clip ' + maxW + 'x' + totalH);
      const gs = grayStats(parts[0].file);
      if (gs.sd < 3 || gs.min > 220) throw new Error('clip looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      entry.status = 'image_acquired';
      entry.crop_asset = 'assets/images/' + path.basename(parts[0].file);
      entry.crop_method = 'archive_clipping_image';
      entry.crop_dimensions = `${maxW}x${totalH}`;
      entry.area_count = areas.length;
      entry.areas = areas;
      entry.source_format = 'webp';
      entry.requested_width = WIDTH;
      entry.source_dimensions = `${maxW}x${totalH}`;
      entry.output_dimensions = `${maxW}x${totalH}`;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.additional_cited_article = true;
      entry.acquired_at = new Date().toISOString();
      if (parts.length > 1) {
        entry.crop_parts = parts.map(p => ({
          part: p.part,
          asset: 'assets/images/' + path.basename(p.file),
          dimensions: `${p.w}x${p.h}`,
        }));
      }
      ok++;
      console.log(`${tag}  OK  ${maxW}x${totalH}${parts.length > 1 ? ' (' + parts.length + ' parts)' : ''}  areas=${areas.length}  sd=${gs.sd.toFixed(1)}  ${(fs.statSync(parts[0].file).size / 1024).toFixed(0)}KB`);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      fail++;
      console.log(`${tag}  FAIL  ${e.message}`);
    }
    ledger.items[job.hn + '|' + job.article] = entry;
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  }

  const imgs = buildImages();
  console.log(`\nAcquired: ${ok}   Failed: ${fail}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
  console.log('Wrote docs/NEWSPAPERSG_SUPPORT_LEDGER.json and site/data/images.json');
})().catch(e => { console.error(e); process.exit(1); });
