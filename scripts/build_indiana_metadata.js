// Collect issue metadata for every Hoosier State Chronicles page referenced in
// the research data, using the Cloudflare clearance session captured by
// scripts/indiana_session.js.
//
// Output: docs/INDIANA_PAGE_METADATA.json
//   key = "<paperCode><YYYYMMDD>.<page>"  -> { hn_ids, paper, date, page, oid,
//                                               page_w, page_h, source_url }
const fs = require('fs');
const path = require('path');

const SESSION = 'C:/Users/dtoro/AppData/Local/Temp/opencode/indiana-session.json';
const OUT = 'D:/news/docs/INDIANA_PAGE_METADATA.json';

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const s = readJson(SESSION);
const H = { 'User-Agent': s.ua, Cookie: s.cookieHeader, Accept: 'text/html' };

function decodeEntities(v) {
  return v.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&mdash;/g, '-');
}

function parsePage(html, url) {
  const title = decodeEntities((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
  const cfgRaw = (html.match(/data-viewer-data-base-json='([\s\S]*?)'\s+data-/i) || [])[1];
  let cfg = null;
  if (cfgRaw) { try { cfg = JSON.parse(decodeEntities(cfgRaw)); } catch (e) {} }
  const docOid = cfg && cfg.documentOID;
  const sizes = (cfg && cfg.pageImageSizes) || {};
  const area = (cfg && cfg.initialDisplayPageArea) || null;
  const section = (cfg && cfg.initialSelectedSectionID) || null;

  const m = url.match(/[?&]d=([A-Za-z0-9]+?)(\d{8})\.(\d+)\.(\d+)/);
  const paperCode = m ? m[1] : '';
  const date = m ? m[2] : '';
  const pageNo = m ? m[3] : '';
  const size = sizes[pageNo + '.' + (section ? section.split('.')[0] : '1')] || sizes[Object.keys(sizes)[0]];

  // "Jasper County Democrat 6 December 1911 - Hoosier State Chronicles..."
  const paper = title.split(/\s+\d{1,2}\s+\w+\s+\d{4}/)[0].trim();
  return { paper, paperCode, date, page: pageNo, docOid, pageW: size ? size.w : null, pageH: size ? size.h : null, area, section, title };
}

(async () => {
  const hnUrls = readJson('D:/news/scripts/hn_urls.json');
  const byPage = new Map();
  for (const [hn, urls] of Object.entries(hnUrls)) {
    for (const u of urls) {
      if (!/newspapers\.library\.in\.gov/i.test(u)) continue;
      const m = u.match(/[?&]d=([A-Za-z0-9]+?)(\d{8})\.(\d+)\.(\d+)/);
      if (!m) continue;
      const key = m[1] + m[2] + '.' + m[3];
      if (!byPage.has(key)) byPage.set(key, { url: u.replace(/&amp;/g, '&'), hns: new Set() });
      byPage.get(key).hns.add(hn);
    }
  }
  const keys = [...byPage.keys()].sort();
  console.log('unique Indiana pages:', keys.length);

  let out = {};
  if (fs.existsSync(OUT)) out = readJson(OUT);
  let ok = 0, fail = 0, challenged = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = byPage.get(key);
    if (out[key] && out[key].paper) { ok++; continue; }
    try {
      const r = await fetch(item.url, { headers: H, redirect: 'follow', signal: AbortSignal.timeout(60000) });
      const html = await r.text();
      if (/Just a moment|Performing security verification/i.test(html.slice(0, 3000))) {
        console.log(`[${i + 1}/${keys.length}] CHALLENGE at ${key} - stopping`);
        challenged++;
        break;
      }
      const p = parsePage(html, item.url);
      out[key] = {
        key, hn_ids: [...item.hns].sort(), source_url: item.url,
        paper: p.paper, paper_code: p.paperCode, date: p.date, page: p.page,
        document_oid: p.docOid, page_width: p.pageW, page_height: p.pageH,
        article_area: p.area, article_section: p.section, title_tag: p.title,
        fetched_at: new Date().toISOString(),
      };
      ok++;
      console.log(`[${i + 1}/${keys.length}] ${key}  ${p.paper}  ${p.date}  p${p.page}  ${p.pageW}x${p.pageH}`);
    } catch (e) {
      fail++;
      console.log(`[${i + 1}/${keys.length}] ${key}  FAIL ${e.message}`);
    }
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    await sleep(1200);
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`\nParsed ${ok}, failed ${fail}, challenged ${challenged}, total ${Object.keys(out).length}`);
})();
