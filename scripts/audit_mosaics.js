// Structural audit for every image referenced by site/data/images.json.
//
// A 1x1 luma sample is misleading for white-margined newspaper pages, so each
// asset is downscaled to 64x64 gray and checked for variance and darkest pixel.
// A real scan or clip has ink (dark pixels) and structure; a blank/failed
// rendition has almost no variance and no dark pixels.
//
// Usage: node scripts/audit_mosaics.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = 'D:/news';
const images = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/images.json'), 'utf8'));

// rel path -> { kinds:Set, records:Set }
const refs = new Map();
for (const hn of Object.keys(images)) {
  for (const i of images[hn]) {
    for (const rel of [i.crop, i.full_page].filter(Boolean)) {
      if (!refs.has(rel)) refs.set(rel, { kinds: new Set(), records: new Set() });
      const r = refs.get(rel);
      r.records.add(hn);
      r.kinds.add(i.crop ? (i.crop_method || 'crop') : (i.mosaic_method || 'page_scan'));
    }
  }
}

const rows = [];
for (const [rel, meta] of refs) {
  const f = path.join(ROOT, 'site', rel);
  if (!fs.existsSync(f)) { rows.push({ rel, meta, err: 'missing' }); continue; }
  try {
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf',
      'scale=64:64,format=gray', '-frames:v', '1', '-f', 'rawvideo', '-'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    let sum = 0, sq = 0, min = 255, max = 0;
    for (const b of buf) { sum += b; sq += b * b; if (b < min) min = b; if (b > max) max = b; }
    const n = buf.length, mean = sum / n, sd = Math.sqrt(sq / n - mean * mean);
    rows.push({ rel, meta, mean, sd, min, max });
  } catch (e) {
    rows.push({ rel, meta, err: (e.stderr || '').toString().slice(0, 100) });
  }
}

const bad = rows.filter(r => r.err || r.sd < 3 || r.min > 200);
const byKind = {};
for (const r of rows) {
  for (const k of r.meta.kinds) {
    byKind[k] = byKind[k] || { n: 0, bad: 0 };
    byKind[k].n++;
    if (r.err || r.sd < 3 || r.min > 200) byKind[k].bad++;
  }
}

console.log('distinct assets referenced:', rows.length);
console.log('missing/blank/degenerate:', bad.length);
for (const b of bad.slice(0, 25)) {
  console.log('  ', b.rel, b.err || ('mean=' + b.mean.toFixed(1) + ' sd=' + b.sd.toFixed(1) + ' min=' + b.min));
}
console.log('\nby method:');
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].n - a[1].n)) {
  console.log('  ' + String(v.n).padStart(5) + '  bad=' + String(v.bad).padStart(3) + '  ' + k);
}
const ok = rows.filter(r => !r.err);
const sds = ok.map(r => r.sd).sort((a, b) => a - b);
const mins = ok.map(r => r.min).sort((a, b) => a - b);
if (sds.length) {
  console.log('\nsd min/median:', sds[0].toFixed(1), sds[Math.floor(sds.length / 2)].toFixed(1),
    '| darkest-pixel max:', mins[mins.length - 1]);
}
process.exitCode = bad.length ? 1 : 0;
