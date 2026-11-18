// Acquire the cited-collection newspaper scans behind HN-652 and HN-669:
//   The Henry Ford museum collection artifacts 344597 / 344599 (March 1965
//   front pages covering the Selma march) and 458466 / 458461 (Chicago
//   Sun-Times and Chicago Tribune front pages, 6 June 1968, RFK's death).
//
// The museum exposes its own `_detail` rendition of each scan. Stored
// unmodified as archive_page_image / additional_cited_article with the cited
// collection named as provider. No cropping, retouching, or generation.
// OCR is used only to confirm identity (no OCR text is stored).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER = path.join(ROOT, 'docs', 'OTHER_IMAGE_ACQUISITION_LEDGER.json');
const TMP = 'C:/Users/dtoro/AppData/Local/Temp/opencode/thf-acquire';
const OCR = 'D:\\news\\scripts\\_ocr_windows.ps1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PROVIDER = 'The Henry Ford (museum collection scan)';

const JOBS = [
  {
    hn_id: 'HN-652',
    page_url: 'https://www.thehenryford.org/collections/explore/artifact/344597',
    image_url: 'https://collections-media.thehenryford.org/CollectionImages/_detail/photos/thf96542.jpg',
    newspaper: 'Newspaper front page (Selma march coverage)',
    issue_date: '1965-03-23',
    out: 'hn-652-thf-selma-front-page-19650323-a.jpg',
    need: [/civil rights/i, /march/i],
    note: 'The Henry Ford museum scan of a March 1965 newspaper front page covering the Selma march ("New Civil Rights Leader Will Seek Sanction Of Court For March"; also "Johnson Asks Congress To Intensify Fight On Crime" and "Marines Landed In Viet Nam"). Masthead OCR is unclear, so the publication is not asserted. Date inferred from the page\'s own Selma-march coverage. Identity confirmed by OCR (page locator only).',
  },
  {
    hn_id: 'HN-652',
    page_url: 'https://www.thehenryford.org/collections/explore/artifact/344599',
    image_url: 'https://collections-media.thehenryford.org/CollectionImages/_detail/photos/thf96544.jpg',
    newspaper: 'Newspaper front page (Selma march coverage)',
    issue_date: '1965-03-23',
    out: 'hn-652-thf-selma-front-page-19650323-b.jpg',
    need: [/march/i, /viet nam|astronaut|bombing/i],
    note: 'The Henry Ford museum scan of a March 1965 newspaper front page covering the Selma march ("Rain Dampens March As Third Day Begins"; also "Astronauts Ride \'Molly Brown\' Spacecraft In Perfect Orbit" and "U.S., Viet Nam Planes Continue Bombings"). Masthead OCR is unclear, so the publication is not asserted. Date inferred from the Gemini 3 launch and the third day of the Selma march. Identity confirmed by OCR (page locator only).',
  },
  {
    hn_id: 'HN-669',
    page_url: 'https://www.thehenryford.org/collections/explore/artifact/458466',
    image_url: 'https://collections-media.thehenryford.org/CollectionImages/_detail/photos/thf288207.jpg',
    newspaper: 'Chicago Sun-Times',
    issue_date: '1968-06-06',
    out: 'hn-669-thf-chicago-sun-times-19680606-front-page.jpg',
    need: [/kennedy/i, /sun-times|assassin/i],
    note: 'The Henry Ford museum scan of the Chicago Sun-Times final edition front page, 6 June 1968: "RFK Dead! Assassin Bullet Kills Senator." Identity confirmed by OCR (page locator only).',
  },
  {
    hn_id: 'HN-669',
    page_url: 'https://www.thehenryford.org/collections/explore/artifact/458461',
    image_url: 'https://collections-media.thehenryford.org/CollectionImages/_detail/photos/thf288205.jpg',
    newspaper: 'Chicago Tribune',
    issue_date: '1968-06-06',
    out: 'hn-669-thf-chicago-tribune-19680606-front-page.jpg',
    need: [/kennedy/i, /tribune|assassin/i],
    note: 'The Henry Ford museum scan of the Chicago Tribune front page, 6 June 1968: "Sen. Kennedy Dies! Loses Fight 25 Hours After Shooting." Identity confirmed by OCR (page locator only).',
  },
];

function readJson(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
function ffprobeSize(f) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number); return { w, h };
}
function grayStats(f) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=64:64,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  let sum = 0, sum2 = 0, min = 255;
  for (const v of raw) { sum += v; sum2 += v * v; if (v < min) min = v; }
  const n = raw.length, mean = sum / n;
  return { sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), min, mean };
}
function winPath(p) { return p.split('/').join('\\'); }
function ocrText(jpeg, tag) {
  const d = ffprobeSize(jpeg);
  const png = TMP + '/' + tag + '-ocr.png';
  const vf = d.w < 1100 ? 'scale=iw*2:ih*2,format=rgb24' : 'format=rgb24';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', jpeg, '-vf', vf, png]);
  try { return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-Path', winPath(png)], { encoding: 'utf8', timeout: 180000 }); }
  catch (e) { return ''; }
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const ledger = readJson(LEDGER);
  if (!ledger.items) ledger.items = {};

  for (const job of JOBS) {
    const key = job.hn_id + '|' + job.page_url + '|' + job.out;
    const entry = {
      hn_id: job.hn_id, provider: PROVIDER, status: 'pending', page_url: job.page_url,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const r = await fetch(job.image_url, { headers: { 'User-Agent': UA, Referer: job.page_url }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('not a JPEG (HTTP ' + r.status + ', ' + buf.length + ' bytes)');
      const tmp = TMP + '/' + job.out;
      fs.writeFileSync(tmp, buf);
      const dims = ffprobeSize(tmp);
      const gs = grayStats(tmp);
      if (dims.w < 150 || dims.h < 120) throw new Error('degenerate image ' + dims.w + 'x' + dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('image looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      const text = ocrText(tmp, job.hn_id + '-' + job.out).toLowerCase();
      const ok = job.need.every(re => re.test(text));
      if (!ok) throw new Error('OCR does not confirm identity (chars=' + text.replace(/\s/g, '').length + ')');
      fs.copyFileSync(tmp, IMG_DIR + '/' + job.out);
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + job.out;
      entry.source_dimensions = dims.w + 'x' + dims.h;
      entry.output_dimensions = dims.w + 'x' + dims.h;
      entry.mosaic_method = 'archive_page_image';
      entry.page_selection = 'archive_item_record';
      entry.article_note = job.note;
      entry.additional_cited_article = true;
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.acquired_at = new Date().toISOString();
      console.log(job.hn_id + '  OK  ' + dims.w + 'x' + dims.h + '  sd=' + gs.sd.toFixed(1) + ' min=' + gs.min + '  ' + job.out);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      console.log(job.hn_id + '  FAIL  ' + e.message);
    }
    ledger.items[key] = entry;
  }

  ledger.generated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  const imgs = buildImages();
  console.log('Records with images (all providers): ' + Object.keys(imgs).length);
})().catch(e => { console.error(e); process.exit(1); });
