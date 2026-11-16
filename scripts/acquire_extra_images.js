// Acquire images for records whose remaining cited sources are direct page
// scans on other public archives (Library of Congress IIIF, a university
// collection, a newspaper-project page, or an archive preview).
//
// These are narrow, hand-verified jobs: each URL was checked to be the
// archive's own page image for the cited issue, and the record's OCR/page text
// was checked to confirm it covers the same event. A job is skipped when the
// record already has an image from another pipeline (for example its Indiana
// seed page).
//
// Usage:
//   node scripts/acquire_extra_images.js [--only HN-362,HN-233] [--force] [--dry]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const FORCE = args.includes('--force');
const DRY = args.includes('--dry');

fs.mkdirSync(IMG_DIR, { recursive: true });
function readJson(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
function readJsonIf(p) { try { return readJson(p); } catch { return null; } }

const LOC = 'https://tile.loc.gov/image-services/iiif/service:ndnp:kyu:batch_kyu_fargo_ver01:data:sn86069458:00206533560:1908052801';

const JOBS = [
  {
    hn: 'HN-362',
    image_url: LOC + ':0863/full/pct:25/0/default.jpg',
    page_url: 'https://guides.loc.gov/chronicling-america-belle-gunness-murder-farm',
    provider: 'Library of Congress / Chronicling America',
    newspaper: 'Crittenden record=press (Marion, Ky.)',
    issue_date: '1908-05-28',
    sequence: 3,
    mosaic_method: 'archive_page_rendition',
    note: 'Later follow-up on the Belle Gunness case, from the Chronicling America page linked by the cited LOC research guide. The cited Indiana seed page (9 May 1908) is not in the viewer.',
    slug: 'hn-362-loc-crittenden-19080528-p3',
  },
  {
    hn: 'HN-233',
    image_url: 'http://archive-images.spectator.co.uk/issues/18th-december-1875/1.jpg?size=280x410&token=68d398c1fd818234b444e3bfeab95371',
    page_url: 'https://archive.spectator.co.uk/article/18th-december-1875/1/a-crime-the-like-of-which-the-world-has-probably',
    provider: 'The Spectator Archive',
    newspaper: 'The Spectator',
    issue_date: '1875-12-18',
    sequence: 1,
    mosaic_method: 'archive_page_preview',
    note: 'Low-resolution page preview (280x410) of page 1, the only resolution the archive exposes without a subscription.',
    slug: 'hn-233-spectator-18751218-p1-preview',
  },
  {
    hn: 'HN-468',
    image_url: 'https://library.umbc.edu/garrett/wp-content/uploads/sites/5/2024/06/R101-newspaper-2.jpg',
    page_url: 'https://library.umbc.edu/garrett/mediumship/eileen-j-garrett/r101-blimp-crash/r101-newspaper/',
    provider: 'University of Maryland, Baltimore County (Garrett Collection)',
    newspaper: 'R101 crash newspaper page',
    issue_date: '1930-10-06',
    sequence: 1,
    mosaic_method: 'archive_page_rendition',
    note: 'Newspaper page reproduced by the cited UMBC Garrett Collection exhibit.',
    slug: 'hn-468-umbc-r101-page',
  },
  {
    hn: 'HN-606',
    image_url: 'https://images.squarespace-cdn.com/content/v1/55bbe8c4e4b07309dc53b00f/1503886436618-10NCD4Z6W8GQNNG650BS/Chicago+Defender+_+Sept+24+front+page.jpg',
    page_url: 'https://www.emmetttillproject.com/chicagodefender',
    provider: 'The Emmett Till Project (Chicago Defender)',
    newspaper: 'Chicago Defender',
    issue_date: '1955-09-24',
    sequence: 1,
    mosaic_method: 'archive_page_rendition',
    note: 'Chicago Defender front page reproduced by the cited Emmett Till Project page.',
    slug: 'hn-606-chicago-defender-19550924-p1',
    convert: true,
  },
];

function ffprobeDim(f) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
  return out;
}

(async () => {
  const images = readJsonIf(path.join(ROOT, 'site', 'data', 'images.json')) || {};
  let ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
  if (!ledger.items) ledger.items = {};

  const jobs = JOBS.filter(j => !ONLY || ONLY.has(j.hn));
  for (const job of jobs) {
    if (!FORCE && images[job.hn] && images[job.hn].length) {
      console.log('SKIP ' + job.hn + ' (already has an image)');
      continue;
    }
    const destRel = 'assets/images/' + job.slug + '.jpg';
    const destAbs = path.join(ROOT, 'site', destRel);
    if (DRY) { console.log('DRY  ' + job.hn + ' -> ' + destRel); continue; }
    try {
      const r = await fetch(job.image_url, { headers: { 'User-Agent': UA, Referer: job.page_url }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      const tmp = destAbs + '.tmp';
      fs.writeFileSync(tmp, buf);
      if (job.convert) {
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-q:v', '3', destAbs], { stdio: 'inherit' });
        fs.unlinkSync(tmp);
      } else {
        fs.renameSync(tmp, destAbs);
      }
      const dim = ffprobeDim(destAbs);
      const head = fs.readFileSync(destAbs).subarray(0, 2);
      if (head[0] !== 0xFF || head[1] !== 0xD8) throw new Error('not a JPEG after write');
      const key = job.hn + '|' + job.page_url;
      ledger.items[key] = {
        hn_id: job.hn,
        status: 'image_acquired',
        page_url: job.page_url,
        error: null,
        acquired_at: new Date().toISOString(),
        provider: job.provider,
        newspaper: job.newspaper,
        headline: '',
        issue_date: job.issue_date,
        sequence: job.sequence,
        image_url: job.image_url,
        full_page_asset: destRel,
        source_dimensions: dim,
        output_dimensions: dim,
        mosaic_method: job.mosaic_method,
        note: job.note,
      };
      console.log('OK   ' + job.hn + '  ' + dim + '  ' + (buf.length / 1024).toFixed(0) + 'KB -> ' + destRel);
    } catch (e) {
      console.log('FAIL ' + job.hn + '  ' + e.message);
    }
  }
  if (!DRY) {
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
    console.log('wrote ' + LEDGER_PATH);
  }
})();
