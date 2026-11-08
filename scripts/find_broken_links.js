// Find broken internal links - detailed output
const fs = require('fs');
const path = require('path');

const SITE = 'D:/news/site';
const storiesDir = path.join(SITE, 'stories');

const internalLinkRe = /href="([^"]+\.html)"/g;
const allHtml = fs.readdirSync(SITE).filter(f => f.endsWith('.html'));
const storyHtml = fs.readdirSync(storiesDir).filter(f => f.endsWith('.html'));
const existingPages = new Set([...allHtml, ...storyHtml.map(f => 'stories/' + f)]);

const brokenLinks = [];
let totalLinks = 0;
function scanFile(filePath, baseDir) {
  const content = fs.readFileSync(path.join(baseDir, filePath), 'utf8');
  let m;
  while ((m = internalLinkRe.exec(content)) !== null) {
    totalLinks++;
    const target = m[1];
    if (target.startsWith('http')) continue;
    if (!existingPages.has(target)) {
      brokenLinks.push({ file: baseDir + '/' + filePath, target });
    }
  }
}
for (const f of allHtml) scanFile(f, SITE);
for (const f of storyHtml) scanFile(f, storiesDir);

console.log('Total internal links checked:', totalLinks);
console.log('Broken links:', brokenLinks.length);
brokenLinks.forEach(b => console.log('  ' + b.file + ' -> ' + b.target));
