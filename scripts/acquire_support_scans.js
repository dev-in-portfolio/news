// Acquire cited pages from supporting newspaper PDFs whose issue PDFs are
// exposed directly by the holding archive.
//
// Each job names a page that was located by scoring every page's own text layer
// against the cited article's terms. The stored file is a rasterisation of the
// archive's own scanned PDF page; nothing is cropped, retouched, or generated.
//
// Usage:
//   node scripts/acquire_support_scans.js [--only HN-672] [--dry] [--force]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildImages } = require('./lib_image_merge');

const ROOT = 'D:/news';
const IMG_DIR = path.join(ROOT, 'site', 'assets', 'images');
const LEDGER_PATH = path.join(ROOT, 'docs', 'SUPPORT_SCANS_LEDGER.json');
const CACHE = 'C:/Users/dtoro/AppData/Local/Temp/opencode/support-scans';
const TARGET_WIDTH = 1600;

const JOBS = [
  {
    hn: 'HN-672', pdf: 'HN-672.pdf', page: 5, issue_date: '1968-12-28',
    page_url: 'https://archive.newportbeachlibrary.org/NBPL/0/edoc/1212305/1968-12-28%20-%20Orange%20Coast%20Pilot-Costa%20Mesa.pdf',
    provider: 'Newport Beach Public Library (Orange Coast Pilot)',
    newspaper: 'Orange Coast Pilot (Costa Mesa)',
    note: 'Apollo 8 recovery / splashdown page',
  },
  {
    hn: 'HN-657', pdf: 'HN-657.pdf', page: 1, issue_date: '1966-08-02',
    page_url: 'https://sanweb.lib.msu.edu/DMC/state_news/1966/1966_July01_1966_December09/state_news_19660802.pdf',
    provider: 'Michigan State University Libraries (State News)',
    newspaper: 'Michigan State News',
    note: 'Sniper at U. of Texas slays 16 (front page)',
  },
  {
    hn: 'HN-704', pdf: 'HN-704.pdf', page: 1, issue_date: '1975-03-31',
    page_url: 'https://dailyiowan.lib.uiowa.edu/DI/1975/di1975-03-31.pdf',
    provider: 'University of Iowa Libraries (The Daily Iowan)',
    newspaper: 'The Daily Iowan',
    note: 'Da Nang falls / Saigon evacuation coverage (front page, AP)',
  },
  {
    hn: 'HN-731', pdf: 'HN-731.pdf', page: 4, issue_date: '1982-01-15',
    page_url: 'https://archives.nd.edu/observer/1982-01-15_v16_075.pdf',
    provider: 'University of Notre Dame Archives (The Observer)',
    newspaper: 'The Observer (Notre Dame)',
    note: 'Air Florida Flight 90 crash investigation: de-icing a special concern, "everything is speculation" (continuation of the page-1 report)',
  },
  {
    hn: 'HN-208', pdf: 'HN-208.pdf', page: 2, issue_date: '1867-12-25',
    page_url: 'https://dai.mun.ca/pdfs/morncourier/Courier18671225.pdf',
    provider: 'Memorial University of Newfoundland (Morning Courier)',
    newspaper: 'Morning Courier (St. John\'s, Newfoundland)',
    note: 'Clerkenwell prison explosion / Fenian arrests dispatch (page located by Windows OCR page-locator)',
  },
  {
    hn: 'HN-707', pdf: 'HN-707.pdf', page: 1, issue_date: '1976-07-16',
    page_url: 'https://files.scriptum.cz/scriptum/americke-listy/americke-listy_1976_07-16_27-29_ocr.pdf',
    provider: 'Scriptum (Americké listy digital archive)',
    newspaper: 'Americké listy (Perth Amboy, N.J.)',
    note: 'Entebbe raid / hostage rescue report (front page)',
  },
  {
    hn: 'HN-841', pdf: 'HN-841.pdf', page: 8, issue_date: '1999-01-21',
    page_url: 'https://www.rijha.org/wp-content/uploads/voiceandherald/1999/1999-01-21.pdf',
    provider: 'Rhode Island Jewish Historical Association (Rhode Island Jewish Herald)',
    newspaper: 'The Rhode Island Jewish Herald',
    note: 'Repeat of the MAZON Hurricane Mitch emergency grants (the 1998-12-17 issue with the exact article is stored separately)',
  },
  {
    hn: 'HN-708', pdf: 'HN-708.pdf', page: 16, issue_date: '1976-09-17',
    page_url: 'https://www.themilitant.com/1976/4035/MIL4035.pdf',
    provider: 'The Militant (Pathfinder Press archive)',
    newspaper: 'The Militant',
    note: 'Readers respond to the Militant editorial on the Israeli raid on Entebbe (additional cited article)',
  },
  {
    hn: 'HN-451', pdf: 'HN-451.pdf', page: 3, issue_date: '1927-04-18',
    page_url: 'https://www.marxists.org/history/usa/pubs/dailyworker/1927/1927-nat/v04-n081-NAT-apr-18-1927-DW-Q.pdf',
    provider: 'Marxists Internet Archive (Daily Worker)',
    newspaper: 'The Daily Worker (New York, national edition)',
    note: 'Mississippi flood refugee dispatches: early homeless estimates (additional cited article)',
  },
  {
    hn: 'HN-480', pdf: 'HN-480.pdf', page: 1, issue_date: '1933-03-06',
    page_url: 'https://www.marxists.org/history/usa/pubs/dailyworker/1933/v010-n055-NY-mar-06-1933-DW-LOC.pdf',
    provider: 'Marxists Internet Archive (Daily Worker)',
    newspaper: 'The Daily Worker (New York)',
    note: 'Bank holiday declared as Roosevelt takes office (front page, additional cited article)',
  },
  {
    hn: 'HN-635', pdf: 'HN-635.pdf', page: 4, issue_date: '1961-05-29',
    page_url: 'https://www.marxists.org/history/usa/pubs/national-guardian/1961-05-29-13-33-nat-guardian.pdf',
    provider: 'Marxists Internet Archive (National Guardian)',
    newspaper: 'National Guardian',
    note: 'Eyewitness account of the Anniston attack on the Freedom Riders (additional cited article)',
  },
  {
    hn: 'HN-622', pdf: 'HN-622.pdf', page: 1, issue_date: '1958-03-13',
    page_url: 'https://www.theflorenceherald.com/1958/March%2013%2C%201958.pdf',
    provider: 'The Florence Herald (Florence, S.C.)',
    newspaper: 'The Florence Herald',
    note: 'Air Force bomber accidentally drops bomb near Florence, S.C. (front page, located by Windows OCR page-locator)',
    selection: 'ocr_locator',
  },
  {
    hn: 'HN-224', pdf: 'HN-224.pdf', page: 1, issue_date: '1873-06-10',
    page_url: 'https://okellyarchive.com/sites/default/files/documents/reporting-cuba/201_1873-06-10_6.pdf',
    provider: "O'Kelly Archive (New York Herald)",
    newspaper: 'The New York Herald',
    note: 'Polaris expedition poisoning testimony, page 6 of the issue (additional cited article)',
  },
  {
    hn: 'HN-401', pdf: 'HN-401.pdf', page: 1, issue_date: '1916-07-13',
    page_url: 'https://mapl.org/resources/archive/sharkAttacks/Shark%20Attack%207-13-1916%20The%20Daily%20Home%20News.pdf',
    provider: 'Middlesex County Public Library (Daily Home News)',
    newspaper: 'The Daily Home News (New Brunswick, N.J.)',
    note: 'New Jersey shark attacks: front-page report (additional cited article)',
    selection: 'page_label',
  },
  {
    hn: 'HN-401', pdf: 'HN-401b.pdf', page: 1, issue_date: '1916-07-13',
    page_url: 'https://mapl.org/resources/archive/sharkAttacks/Shark%20Attack%207-13-1916.pdf',
    provider: 'Middlesex County Public Library (Asbury Park Press)',
    newspaper: 'Asbury Park Press',
    note: 'Matawan Creek shark attack: front page, "Sharks Lay for Man" (additional cited article; page located by Windows OCR page-locator)',
    selection: 'ocr_locator',
  },
  {
    hn: 'HN-935', pdf: 'HN-935.pdf', page: 5, issue_date: '2013-11-22',
    page_url: 'https://archindy.org/criterion/files/2013/pdfs/20131122.pdf',
    provider: 'The Criterion (Archdiocese of Indianapolis)',
    newspaper: 'The Criterion',
    note: 'Typhoon Haiyan relief second collections in Indiana parishes (additional cited article; PDF retrieved from the Internet Archive snapshot of the cited file)',
  },
];

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
const ONLY = argVal('--only') ? new Set(argVal('--only').split(',')) : null;
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');

fs.mkdirSync(IMG_DIR, { recursive: true });

function readJsonIf(p) { try { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); } catch (e) { return null; } }
function ffprobeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}
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

async function renderPage(file, pageNo, outFile) {
  const { pdf } = await import('pdf-to-img');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(file));
  const doc0 = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false, disableFontFace: true }).promise;
  const vp = (await doc0.getPage(pageNo)).getViewport({ scale: 1 });
  const scale = Math.min(2.6, Math.max(1.2, TARGET_WIDTH / vp.width));
  const doc = await pdf(file, { scale, format: 'jpeg' });
  try {
    const buf = await doc.getPage(pageNo);
    if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('rasteriser did not return JPEG');
    fs.writeFileSync(outFile, buf);
  } finally {
    await doc.destroy().catch(() => {});
  }
  return { dims: ffprobeSize(outFile), width_pt: vp.width, height_pt: vp.height, scale };
}

(async () => {
  const ledger = readJsonIf(LEDGER_PATH) || { generated_at: null, items: {} };
  if (!ledger.items) ledger.items = {};
  const jobs = JOBS.filter(j => !ONLY || ONLY.has(j.hn));
  console.log(`Support-scan jobs: ${jobs.length}`);
  if (DRY) { jobs.forEach(j => console.log('  ' + j.hn + '  ' + j.pdf + '  p' + j.page)); process.exit(0); }

  let ok = 0, fail = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const tag = `[${i + 1}/${jobs.length}] ${job.hn}`;
    const key = job.hn + '|' + job.page_url;
    const prev = ledger.items[key];
    if (!FORCE && prev && prev.status === 'image_acquired') { console.log(`${tag}  skip (already acquired)`); continue; }
    const pdfFile = path.join(CACHE, job.pdf);
    if (!fs.existsSync(pdfFile)) { console.log(`${tag}  FAIL missing cached PDF`); fail++; continue; }
    const entry = {
      hn_id: job.hn, provider: job.provider, status: 'pending', page_url: job.page_url,
      newspaper: job.newspaper, issue_date: job.issue_date, error: null, acquired_at: null,
    };
    try {
      const outName = `hn-${job.hn.replace('HN-', '')}-${job.newspaper.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${job.issue_date.replace(/-/g, '')}-p${job.page}-page.jpg`;
      const outPath = path.join(IMG_DIR, outName);
      const r = await renderPage(pdfFile, job.page, outPath);
      const gs = grayStats(outPath);
      if (r.dims.w < 300 || r.dims.h < 300) throw new Error('degenerate page ' + r.dims.w + 'x' + r.dims.h);
      if (gs.sd < 3 || gs.min > 220) throw new Error('page looks blank (sd=' + gs.sd.toFixed(1) + ', min=' + gs.min + ')');
      entry.status = 'image_acquired';
      entry.full_page_asset = 'assets/images/' + outName;
      entry.mosaic_method = 'archive_pdf_page_rendition';
      entry.page_selection = job.selection || 'text_match';
      entry.pdf_page = job.page;
      entry.article_note = job.note;
      entry.source_dimensions = `${Math.round(r.width_pt)}x${Math.round(r.height_pt)}pt`;
      entry.output_dimensions = `${r.dims.w}x${r.dims.h}`;
      entry.render_scale = Number(r.scale.toFixed(2));
      entry.gray_stats = { sd: Number(gs.sd.toFixed(1)), min: gs.min, mean: Number(gs.mean.toFixed(1)) };
      entry.additional_cited_article = true;
      entry.acquired_at = new Date().toISOString();
      ok++;
      console.log(`${tag}  OK  p${job.page}  ${r.dims.w}x${r.dims.h}  ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
    } catch (e) {
      entry.status = 'failed';
      entry.error = e.message;
      fail++;
      console.log(`${tag}  FAIL  ${e.message}`);
    }
    ledger.items[key] = entry;
    ledger.generated_at = new Date().toISOString();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  }

  const imgs = buildImages();
  console.log(`\nAcquired: ${ok}   Failed: ${fail}`);
  console.log(`Records with images (all providers): ${Object.keys(imgs).length}`);
  console.log('Wrote docs/SUPPORT_SCANS_LEDGER.json');
})().catch(e => { console.error(e); process.exit(1); });
