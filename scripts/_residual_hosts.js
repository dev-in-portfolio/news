// Compute uncovered cited-URL hosts that are NOT already documented as probed
// and rejected in docs/PROGRESS_LEDGER.md. Prints the residual host list so any
// genuinely new lead can be identified.
const fs = require('fs');

function rj(p) { let s = fs.readFileSync(p, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); }
const urls = rj('scripts/hn_urls.json');
const imgs = rj('site/data/images.json');

const norm = u => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).toLowerCase().replace(/\/+$/, ''); } catch (e) { return u; } };
const covered = new Set();
for (const arr of Object.values(imgs)) for (const i of arr) if (i.page_url) covered.add(norm(i.page_url));

const byHost = {};
for (const [id, arr] of Object.entries(urls)) for (const u of arr || []) {
  if (covered.has(norm(u))) continue;
  try { const h = new URL(u).hostname.replace(/^www\./, ''); (byHost[h] = byHost[h] || new Set()).add(id); } catch (e) { }
}

// Hosts documented in the ledger as probed / rejected / paywalled / non-scan.
const known = new Set(`
newspaperarchive.com rarenewspapers.com historyworm.com genealogybank.com snewspapers.com
mitchellarchives.com historical.ha.com newspapers.com abebooks.com bidspirit.com granger.com
vindyarchives.com archive.timesleader.com newsbank.com
history.state.gov nps.gov home.nps.gov fbi.gov vault.fbi.gov nasa.gov science.nasa.gov ntrs.nasa.gov
sma.nasa.gov starchild.gsfc.nasa.gov ntsb.gov cdc.gov archive.cdc.gov wwwnc.cdc.gov stacks.cdc.gov
justice.gov oig.justice.gov epa.gov nepis.epa.gov usgs.gov earthquake.usgs.gov pubs.usgs.gov
ncei.noaa.gov nhc.noaa.gov response.restoration.noaa.gov incidentnews.noaa.gov repository.library.noaa.gov
gao.gov federalreservehistory.org sec.gov bls.gov ssa.gov uscourts.cavc.gov usfa.fema.gov fda.gov
energy.gov ehss.energy.gov nvlpubs.nist.gov nist.gov govinfo.gov congress.gov senate.gov history.house.gov
archives.gov visit.archives.gov estore.archives.gov ford.blogs.archives.gov obamalibrary.gov
reaganlibrary.gov trumanlibrary.gov fdrlibrary.gov obamawhitehouse.archives.gov
1997-2001.state.gov 2001-2009.state.gov 2021-2025.state.gov
loc.gov guides.loc.gov tile.loc.gov blogs.loc.gov chroniclingamerica.loc.gov
si.edu siarchives.si.edu americanhistory.si.edu airandspace.si.edu nmaahc.si.edu
archives.nysed.gov archives.utah.gov archives.novascotia.ca archivespasdecalais.fr
ohiohistory.org ohiomemory.ohiohistory.org kansashistory.gov indianahistory.org
detroithistorical.org mohistory.mobiusconsortium.org historylink.org kinginstitute.stanford.edu
shc.stanford.edu history.stanford.edu homicide.northwestern.edu
trumanlibrary.gov ilsos.gov portal.ct.gov royal.uk pbs.org smithsonianmag.com nfpa.org arlweb.msha.gov
minesafety.wv.gov coalmininghistorypa.org laportecountyhistory.org heritagejohnstown.org
nationalweathermuseum.com stfrancisdammemorial.org oldkewgardens.com stevedutch.net firstcolonial.com
usdeadlyevents.com sites.google.com mclib.info songramernotebook.com mnhs.org jonestown.sdsu.edu
ibiblio.org pratt.org abacus.bates.edu archive.wvculture.org asset.library.wisc.edu uplopen.com
mospace.umsystem.edu antt.dglab.gov.pt hannahistory.com tighar.org normangirvan.org
sites.nd.edu woo.gordogato.com corescholar.libraries.wright.edu ufdc.ufl.edu dlg.usg.edu
bibliotecanacionaldigital.gob.cl nd-archiv.de digital.library.cornell.edu api.drum.lib.umd.edu
texashistory.unt.edu files.archon.library.illinois.edu research-repository.griffith.edu.au
collection.sciencemuseumgroup.org.uk collection.powerhouse.com.au digitalcommons.unl.edu
anchoragemuseum.org nyecountyhistory.com ddr-museum.de floridaconferenceofhistorians.org
ushmm.org scottbeveridge.blogspot.com galvestonhistorycenter.org lamoth.info
policing.umhistorylabs.lsa.umich.edu pophistorydig.com course-exhibits.library.dartmouth.edu
historialuso.an.gov.br afro.com jacksonianamerica.com
scholar.lib.vt.edu vermonthistory.org
bathschoolmuseum.org tsl.texas.gov emuseum.jfk.org peoplesonline.history.utah.gov
ddr.densho.org digitalcollections.hoover.org archive.newportbeachlibrary.org
floridamemory.com presse.wien.gv.at chilepatrimonios.gob.cl carnegiehero.org olafire.com
wienerzeitung.at mediamythalert.com epizodsspace.airbase.ru usgenwebsites.org
genealogytrails.com history.army.mil nps.gov
bangordailynews.com filsonhistorical.org digitalarchives-documents.hawaii.gov worldradiohistory.com
lib-dspace1.ttu.edu coldcaserecords.gov
`.trim().split(/\s+/));

const rows = Object.entries(byHost)
  .filter(([h]) => !known.has(h))
  .map(([h, s]) => [s.size, h])
  .sort((a, b) => b[0] - a[0]);

console.log('uncovered hosts not in the documented rejection list: ' + rows.length);
for (const [n, h] of rows) console.log('  ' + String(n).padStart(3) + '  ' + h);
