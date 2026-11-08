// Verify that every image referenced by generated detail pages exists on disk,
// and report per-page image counts.
const fs = require('fs');
const path = require('path');

const SITE = 'D:/news/site';
const STORIES = path.join(SITE, 'stories');

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

const images = readJson(path.join(SITE, 'data', 'images.json'));
const hnKeys = Object.keys(images);
let totalItems = 0, crops = 0, pages = 0;
for (const k of hnKeys) {
  for (const it of images[k]) {
    totalItems++;
    if (it.crop) crops++;
    if (it.full_page) pages++;
  }
}
console.log('images.json: records=' + hnKeys.length + ' items=' + totalItems + ' crops=' + crops + ' full_pages=' + pages);

// Check every asset path exists
const missing = [];
for (const k of hnKeys) {
  for (const it of images[k]) {
    for (const rel of [it.crop, it.full_page].filter(Boolean)) {
      const p = path.join(SITE, rel);
      if (!fs.existsSync(p)) missing.push(k + ' -> ' + rel);
    }
  }
}
console.log('missing asset files: ' + missing.length);
missing.slice(0, 10).forEach(m => console.log('  MISS ' + m));

// Check generated pages contain the images card and correct relative paths
const sample = ['HN-403', 'HN-380', 'HN-410', 'HN-586', 'HN-646', 'HN-001', 'HN-1056'];
for (const hn of sample) {
  const p = path.join(STORIES, hn + '.html');
  if (!fs.existsSync(p)) { console.log(hn + ': page MISSING'); continue; }
  const html = fs.readFileSync(p, 'utf8');
  const hasCard = html.includes('Original page scans');
  const imgSrcs = [...html.matchAll(/src="(\.\.\/assets\/images\/[^"]+)"/g)].map(m => m[1]);
  const bad = [];
  for (const src of imgSrcs) {
    const abs = path.join(STORIES, src);
    if (!fs.existsSync(abs)) bad.push(src);
  }
  console.log(hn + ': card=' + hasCard + ' imgs=' + imgSrcs.length + ' broken=' + bad.length +
    (bad.length ? ' [' + bad.slice(0, 3).join(', ') + ']' : ''));
}

// Total distinct referenced images
const refs = new Set();
for (const hn of hnKeys) {
  for (const it of images[hn]) {
    if (it.crop) refs.add(it.crop);
    if (it.full_page) refs.add(it.full_page);
  }
}
console.log('distinct images referenced: ' + refs.size);
