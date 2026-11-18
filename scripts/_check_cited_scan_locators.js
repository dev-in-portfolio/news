// For each record, extract machine-comparable identifiers from cited URLs on
// scan-serving archive hosts and compare against stored image page_urls.
// Goal: find cited article/page scans not yet acquired. Normalise the known
// URL-form differences (www.loc.gov/resource <-> chroniclingamerica seq, etc.)
const fs = require('fs');
function rj(p){let s=fs.readFileSync(p,'utf8');if(s.charCodeAt(0)===0xFEFF)s=s.slice(1);return JSON.parse(s);}
const imgs = rj('site/data/images.json');
const urls = rj('scripts/hn_urls.json');

// Convert an archive URL to a canonical locator token, or null if not a
// deterministic scan locator.
function canon(u){
  try{
    const x = new URL(u);
    const h = x.host.replace(/^www\./,'');
    // Indiana: ?a=d&d=DOC.n.m
    if(h==='newspapers.library.in.gov'){
      const d = x.searchParams.get('d');
      return d ? 'in:'+d.split('.')[0] : null; // doc-level; multiple sections share doc
    }
    // Oregon / chroniclingamerica / loc resource: lccn + date + seq/sp
    if(h==='oregonnews.uoregon.edu'||h==='chroniclingamerica.loc.gov'||h==='www.loc.gov'){
      const m = u.match(/(sn\d+|200\d{6}|\d{8,9})/);
      const d = u.match(/\b(1\d{7}|19\d{7}|20\d{7})\b/); // YYYYMMDD (8 digits)
      const seq = (u.match(/seq-(\d+)/)||u.match(/[?&]sp=(\d+)/)||[])[1];
      const lccn = (u.match(/\/lccn\/([^/]+)/)||u.match(/\/resource\/(sn\d+)/)||[])[1];
      const date = (u.match(/\/(\d{4}-\d{2}-\d{2})\//)||[])[1];
      if(lccn&&date) return 'loc:'+lccn+'|'+date+'|'+(seq||'1');
      return null;
    }
    // Papers Past: /newspapers/CODE
    if(h==='paperspast.natlib.govt.nz'){
      const m = u.match(/\/newspapers\/([A-Z0-9]+)/);
      return m ? 'pp:'+m[1] : null; // search URLs -> null
    }
    // NLI
    if(h==='nli.ie'){ const m=u.match(/\/([0-9]{8,})\//); return m?'nli:'+m[1]:null; }
    // NewspaperSG
    if(h==='eresources.nlb.gov.sg'){ const m=u.match(/\/([0-9]{8,})/); return m?'sg:'+m[1]:null; }
    // Texas / OK CONTENTdm / Quartex
    if(h==='texashistory.unt.edu'||h==='gateway.okhistory.org'){
      const m=u.match(/(ark:\/?\/67531\/[a-z0-9]+|metapth\d+|metadc\d+)/i);
      return m?'contentdm:'+m[1]:null;
    }
    if(h==='digitalcollections-baylor.quartexcollections.com'){
      const m=u.match(/Detail\/[^/]+\/(\d+)/); return m?'qd:'+m[1]:null;
    }
    return null;
  }catch(e){return null;}
}

let misses=[];
for(const [id,arr] of Object.entries(urls)){
  const cited=new Set();
  for(const u of arr||[]){const c=canon(u);if(c)cited.add(c);}
  if(!cited.size)continue;
  const stored=new Set();
  for(const i of imgs[id]||[]){const c=canon(i.page_url||'');if(c)stored.add(c);}
  const missing=[...cited].filter(c=>!stored.has(c));
  if(missing.length)misses.push([id,[...cited],missing]);
}
console.log('records with cited deterministic scan locators not stored = '+misses.length);
for(const [id,c,m] of misses){
  console.log('  '+id+'  missing='+m.join(', '));
}
