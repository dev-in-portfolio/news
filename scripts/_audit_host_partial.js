// Per-host citation coverage: hosts where some citing records have no stored
// image whose page_url is on that host. Filters out modern news / government /
// reference / commercial hosts to surface possible newspaper-scan gaps.
const fs = require('fs');

const ROOT = 'D:/news';
function readJson(p) {
  let s = fs.readFileSync(p, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return JSON.parse(s);
}
function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; }
}

const urls = readJson(ROOT + '/scripts/hn_urls.json');
const images = readJson(ROOT + '/site/data/images.json');

const citedByHost = new Map();
for (const [hn, list] of Object.entries(urls)) {
  for (const u of list || []) {
    const h = host(u);
    if (!h) continue;
    if (!citedByHost.has(h)) citedByHost.set(h, new Set());
    citedByHost.get(h).add(hn);
  }
}
const storedByHost = new Map();
for (const [hn, list] of Object.entries(images)) {
  for (const i of list || []) {
    const h = host(i.page_url || '');
    if (!h) continue;
    if (!storedByHost.has(h)) storedByHost.set(h, new Set());
    storedByHost.get(h).add(hn);
  }
}

const SKIP = /(theguardian|washingtonpost|latimes|nytimes|sfchronicle|houstonchronicle|startribune|miamiherald|charlotteobserver|nypost|timesunion|chicago\.suntimes|bangordailynews|theflorenceherald|bocaratontribune|blackvoicenews|newpittsburghcourier|atlantadailyworld|independent\.co\.uk|thetimes\.com|ft\.com|lemonde\.fr|elpais\.com|thenationalnews|timesofindia|indianexpress|newindianexpress|arabitimesonline|csmonitor|texastribune|expressnews|deseret\.com|chron\.com|vindyarchives|archive\.timesleader|pressgazette|newsinteractive\.post-gazette|daily\.jstor|thechurchnews|almanacnews|voiceonline|worldradiohistory|newspaperarchive|rarenewspapers|genealogybank|historyworm|snewspapers|vermonthistory|okellyarchive|historicaltextarchive|abebooks|dokumen\.pub|journals\.sagepub|blackfreedom\.proquest|timesmachine\.nytimes|archives\.com|mitchellarchives|historical\.ha\.com|estore\.archives\.gov|dangerouspress|churchmousec|ford\.blogs\.archives|obamawhitehouse\.archives|visit\.archives\.gov|archives\.gov|weather\.gov|nps\.gov|fbi\.gov|nasa\.gov|encyclopedia\.ushmm|ntsb\.gov|justice\.gov|cdc\.gov|earthquake\.usgs|history\.navy\.mil|pubs\.usgs|federalreservehistory|gao\.gov|usgs\.gov|ncei\.noaa|nhc\.noaa|history\.state\.gov|history\.house\.gov|kinginstitute\.stanford|science\.nasa|in\.gov|energy\.gov|americanhistory\.si|historylink|trumanlibrary|digitallibrary\.un|detroithistorical|ohiohistory|thehenryford|archives\.nysed|siarchives\.si|glamarchives|txarchives|archives\.utah|archives\.novascotia|archivespasdecalais|presse\.wien|njarchive|filsonhistorical|archives\.lib\.purdue|dailyiowan\.lib\.uiowa|digitalarchives-documents\.hawaii|scholar\.lib\.vt|wikipedia|en\.wikipedia|home\.nps|tsunami-dl|starchild\.gsfc|incidentnews\.noaa|coldcaserecords|findingaids\.csun|cowlatinamerica\.voices\.wooster|press\.un\.org|document|latimes|nytimes|washingtonpost|thetimes|independent|sfchronicle|houstonchronicle|startribune|miamiherald|charlotteobserver|nypost|timesunion|chicago|bangordailynews|theflorenceherald|bocaratontribune|blackvoicenews|newpittsburghcourier|atlantadailyworld|texastribune|expressnews|deseret|chron|vindyarchives|archive\.timesleader|pressgazette|newsinteractive|daily\.jstor|thechurchnews|almanacnews|voiceonline|worldradiohistory)/i;

const rows = [];
for (const [h, cited] of citedByHost) {
  if (SKIP.test(h)) continue;
  const stored = storedByHost.get(h) || new Set();
  const missing = [...cited].filter(x => !stored.has(x));
  if (missing.length) rows.push({ h, cited: cited.size, stored: stored.size, missing: missing.length, records: missing });
}
rows.sort((a, b) => b.missing - a.missing || b.cited - a.cited);
console.log('hosts with partial/zero citation coverage (filtered): ' + rows.length);
for (const r of rows) {
  console.log(String(r.missing).padStart(4) + ' missing / ' + String(r.cited).padStart(4) + ' cited  ' + r.h + '   ' + r.records.slice(0, 8).join(', ') + (r.records.length > 8 ? ' ...' : ''));
}
