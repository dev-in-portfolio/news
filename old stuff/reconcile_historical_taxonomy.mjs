import fs from 'node:fs/promises';
import path from 'node:path';

// A reviewable overlay on the immutable original 1,056-item source and audit.
// The decision matrix is deliberately exhaustive: every proposal must have a rule.
const base = '/workspace/scratch/c35ff46ef126';
const input = JSON.parse(await fs.readFile(path.join(base, 'Historical_Newspaper_Taxonomy_Audit_Data.json'), 'utf8'));
const original = await fs.readFile(path.join(base, 'historical_taxonomy_draft.txt'), 'utf8');

const groups = new Map();
let category;
for (const raw of original.trim().split(/\r?\n/)) {
  const line = raw.trim();
  if (line.startsWith('# ')) {
    const [, code, name] = /^# (\d{2}) (.+)$/.exec(line);
    category = { code, name, subs: [] };
    groups.set(code, category);
  } else {
    const [name, leaves] = line.split(' :: ');
    const code = `${category.code}.${String(category.subs.length + 1).padStart(2, '0')}`;
    category.subs.push({ code, name, leaves: leaves.split(' | ') });
  }
}
const findSub = (code) => {
  const group = groups.get(code.slice(0, 2));
  const sub = group?.subs.find(s => s.code === code);
  if (!sub) throw new Error(`No subcategory ${code}`);
  return { group, sub };
};
const renameSub = (code, name) => { findSub(code).sub.name = name; };
const add = (code, label) => {
  const { sub } = findSub(code);
  if (sub.leaves.includes(label)) return;
  sub.leaves.push(label);
};
const renameLeaf = (code, before, after) => {
  const { sub } = findSub(code);
  const idx = sub.leaves.indexOf(before);
  if (idx === -1) throw new Error(`Missing ${code} '${before}'`);
  if (sub.leaves.includes(after)) throw new Error(`Duplicate renamed leaf ${after}`);
  sub.leaves[idx] = after;
};

// A folder should describe a subject; article genre, source reliability, cause,
// and aftermath phase can be separately recorded without spawning duplicate folders.
renameSub('04.01', 'Racial, Ethnic & Religious Justice');
renameSub('04.08', 'Education, Equality & School Policy');
renameSub('05.02', 'Hurricanes, Tornadoes, Dust & Severe Storms');
renameSub('05.05', 'Explosions, Industrial & Workplace Disasters');
renameSub('06.06', 'Energy & Critical Infrastructure');
renameSub('08.03', 'Historical Artifacts & Documents');
renameSub('12.02', 'Shipwrecks, Maritime Accidents & Losses');
renameLeaf('12.02', 'Vessels lost in storms', 'Sinkings, capsizings and foundering');
renameLeaf('10.05', 'Editorials', 'Press criticism and editorial disputes');

const science = groups.get('06');
const retiredSubs = science.subs.filter(s => ['06.07', '06.08'].includes(s.code));
science.subs = science.subs.filter(s => !['06.07', '06.08'].includes(s.code));
groups.get('05').subs.push({
  code: '05.09', name: 'Landslides, Avalanches & Ground Failures',
  leaves: ['Landslides, avalanches and spoil-heap failures', 'Sinkholes and subsidence failures']
});

// [target subcategory, target tertiary, action, reason]. Distinct source labels
// can point to one target when they describe the same subject from a different angle.
const decisions = new Map(Object.entries({
  'Explosives stores, powder magazines and munition blasts': ['05.05', 'Explosives depots and munition blasts', 'add', 'Distinct explosive-storage accident mechanism; many reports across periods.'],
  'Steam boilers and pressure-vessel explosions': ['05.05', 'Steam boilers and pressure-vessel explosions', 'add', 'Neither generic factory explosions nor transportation operation describes vessel rupture.'],
  'Extrajudicial mob executions and vigilantism': ['01.07', 'Extrajudicial mob executions and vigilantism', 'add', 'Separate unproved-racial-motive vigilantism from explicitly racialized lynching.'],
  'Declarations of war, ceasefires and surrender': ['02.01', 'Declarations of war, ceasefires and surrender', 'add', 'Formal changes in conflict status are not battles or troop deployments.'],
  'Sinkings, capsizings and foundering': ['12.02', 'Sinkings, capsizings and foundering', 'broaden', 'Broaden the existing storm-only vessel-loss leaf; sinking is an outcome regardless of cause.'],
  'Train derailments and hazardous freight incidents': ['12.07', 'Train derailments and hazardous freight incidents', 'add', 'Distinct from train collision and routine railway operation.'],
  'Armed attacks on civilian aircraft and passenger transport': ['02.06', 'Attacks involving civilian aircraft', 'add', 'Deliberate passenger-aircraft attacks; record shootdown as mechanism.'],
  'Ideologically motivated shootings and coordinated terrorist attacks': ['02.06', 'Terrorist shootings and coordinated attacks', 'add', 'Bombings and hostage incidents miss shootings and coordinated assaults.'],
  'Political raids, repression and emergency-state powers': ['03.07', 'Political repression, raids and emergency-state powers', 'add', 'Direct use of coercive public authority, distinct from oversight.'],
  'Racially discriminatory prosecutions and criminal justice': ['04.01', 'Discriminatory prosecutions and criminal justice', 'add', 'Judicial discrimination is not the same as lynching or generic equality campaigning.'],
  'Religious and ethnicity-based discrimination and hate incidents': ['04.01', 'Ethnic and religious discrimination and hate incidents', 'add', 'Explicitly covers anti-Muslim and ethnicity-based targeting, not only race.'],
  'Space telescopes and orbital observatories': ['06.01', 'Space telescopes and orbital observatories', 'add', 'Observational missions differ from human and robotic exploration missions.'],
  'Electrical grid failures and blackouts': ['06.06', 'Electrical grid failures and blackouts', 'add', 'Failure of critical power infrastructure is not electricity generation.'],
  'Mass-casualty aerial hijacking attacks': ['02.06', 'Attacks involving civilian aircraft', 'merge', 'Same civilian-aircraft attack subject; hijacking and shootdown are mechanism tags, not sibling folders.'],
  'Statehood, national reunification and sovereignty transitions': ['03.06', 'Statehood, reunification and sovereignty transitions', 'add', 'Completed sovereignty transitions are distinct from proposed borders or constitutional rulings.'],
  'Slavery, abolition, emancipation and enslavement': ['04.01', 'Slavery, abolition and emancipation', 'add', 'Neither segregation nor lynching represents slavery-era records.'],
  'Indigenous criminal jurisdiction and equal protection': ['04.04', 'Indigenous criminal jurisdiction and legal equality', 'add', 'Treaty/jurisdiction and equal-protection questions differ from land rights.'],
  'Wartime internment and compulsory relocation': ['04.05', 'Wartime internment and compulsory relocation', 'add', 'State-imposed removal is distinct from ordinary voluntary migration.'],
  'School safety and institutional responses': ['04.08', 'School security and institutional responses', 'add', 'Security changes following violence are distinct from violence incidents.'],
  'Dust storms and soil erosion emergencies': ['05.02', 'Dust storms and soil erosion emergencies', 'add', 'A repeated weather and land-degradation hazard not captured by hurricanes or blizzards.'],
  'Nuclear reactor and radiological facility accidents': ['05.05', 'Nuclear and radiological facility accidents', 'add', 'Radiological-industrial emergencies are not ordinary reactor-technology advances.'],
  'Long-term community recovery and reconstruction': ['05.08', 'Long-term community recovery and reconstruction', 'add', 'Rebuilding assistance differs from immediate rescue and relief.'],
  'Mining spoil-heaps and tailings slides': ['05.09', 'Landslides, avalanches and spoil-heap failures', 'merge', 'A landslide mechanism; retain mining origin as a causal tag.'],
  'Rockfalls, avalanches and landslides': ['05.09', 'Landslides, avalanches and spoil-heap failures', 'add', 'Missing natural/gravity-driven ground-failure hazard.'],
  'Space stations, satellites and orbital debris re-entry': ['06.01', 'Satellites, space stations and reentries', 'add', 'Spacecraft reentry and orbital infrastructure are distinct from launch or exploration.'],
  'Unusual clinical cases and disease presentations': ['07.02', 'Unusual clinical cases and presentations', 'add', 'Contemporary case presentations differ from a confirmed research discovery.'],
  'Papal elections and religious leadership succession': ['10.01', 'Papal elections and religious succession', 'add', 'Religious institutional succession has different subject than new faith movements.'],
  'Shipboard fires, suspected arson and onboard disasters': ['12.02', 'Shipboard fires and onboard emergencies', 'add', 'Onboard fire can be central even when a vessel does not sink; arson remains an allegation tag.'],
  'Maritime sinkings from wartime attacks': ['12.02', 'Sinkings, capsizings and foundering', 'merge', 'Subcategory is a cause-specific subset of sinking; wartime attack gets a cause and war cross-tag.'],
  'Missing aircraft, aviators and air searches': ['12.07', 'Missing aircraft and aviation searches', 'add', 'Missing/attempted rescue reports should not be filed as confirmed crashes.'],
  'Piracy and maritime criminal networks': ['01.05', 'Piracy and maritime criminal networks', 'add', 'Historical maritime criminal activity is not ordinary smuggling or gang racketeering.'],
  'Deaths in custody and prisoner suicides': ['01.08', 'Custodial deaths and prisoner welfare', 'add', 'Actual deaths during confinement are different from escape or police misconduct.'],
  'Prisoner-of-war massacres and battlefield atrocities': ['02.07', 'POW killings and battlefield atrocities', 'add', 'Military prisoners differ from civilian massacres; event alleged, not automatically corroborated.'],
  'International partition, mandates and statehood proposals': ['03.04', 'International partition and mandates', 'add', 'A proposed UN partition is not already a completed statehood transition.'],
  'State visits and diplomatic outreach': ['03.04', 'State visits and diplomatic outreach', 'add', 'Routine diplomatic outreach does not imply an actual diplomatic crisis.'],
  'Economic sanctions and coercive diplomacy': ['03.04', 'Economic sanctions and coercive diplomacy', 'add', 'Economic pressure is a foreign-policy instrument, distinct from treaties.'],
  'Racially discriminatory lending, housing and economic exclusion': ['04.01', 'Discriminatory lending, housing and economic exclusion', 'add', 'Financial exclusion is distinct from segregation and equality marches; the specific lawsuit is alleged.'],
  'Employment disparities and structural economic inequality': ['04.07', 'Employment disparities and economic inequality', 'add', 'Employment inequality is not synonymous with housing or food insecurity.'],
  'Oil, gas and combustible-fluid industrial fires': ['05.05', 'Industrial fires and combustible-fluid incidents', 'add', 'Industrial combustible-fluid fires are different from factory explosions.'],
  'Storage-tank ruptures and industrial material releases': ['05.05', 'Industrial storage failures and material releases', 'add', 'A tank rupture without an explosion requires an accurate mechanism.'],
  'Combustible gas and nonindustrial building explosions': ['05.05', 'Nonindustrial gas and building explosions', 'add', 'A gas-fueled school blast is not a factory accident or a bombing.'],
  'Sinkholes and subsidence failures': ['05.09', 'Sinkholes and subsidence failures', 'add', 'Subsidence differs from falling-slope/avalanche mechanisms.'],
  'Cyberattacks, ransomware and digital service outages': ['06.05', 'Cyberattacks and digital service outages', 'add', 'Attacks against digital infrastructure do not fit generic digital networks.'],
  'Mortality and public-health statistics': ['07.06', 'Mortality and public-health statistics', 'add', 'Historical mortality notices are neither hospital conditions nor clinical treatment.'],
  'Violent labor confrontations and strike-related killings': ['09.05', 'Strike violence and labor confrontations', 'add', 'Deadly strike violence has distinct labor-history relevance; retain crime cross-tag.'],
  'Wartime propaganda and contested official claims': ['10.05', 'Propaganda and disinformation', 'add', 'The circulation of state propaganda is a media subject, distinct from its factual truth.'],
  'Wartime censorship and government information control': ['10.05', 'Press freedom', 'merge', 'Existing Press freedom covers state censorship; wartime context remains a tag.'],
  'Intrusive reporting, paparazzi and press ethics': ['10.05', 'Media ethics and intrusive reporting', 'add', 'Press conduct itself, rather than simple article opinion, is the subject.'],
  'Icebound or stranded maritime vessels and crews': ['12.02', 'Stranded and icebound vessels', 'add', 'Survival on trapped ships is not necessarily a sinking or grounding.'],
  'Submersible and deep-sea vessel accidents': ['12.02', 'Submersible and deep-sea incidents', 'add', 'Deep-sea submersible operation differs from surface-vessel shipwreck.'],
  'Aviation near misses, mechanical failures and safety investigations': ['12.07', 'In-flight failures and aviation near misses', 'add', 'An aircraft returning safely after structural failure is not a crash.']
}));

// Editorship as a genre does not determine topic. These were read manually;
// the three retained journalism primary records are specifically about reporting.
const editorialOverrides = new Map(Object.entries({
  'HN-059': ['01.07', 'Reprieves', 'Opinion disputes governor’s decision to reprieve a convicted man.'],
  'HN-140': ['01.06', 'Contested evidence', 'The challenged evidentiary basis of Somers crew hangings is central.'],
  'HN-220': ['03.05', 'Influence scandals', 'Disputed timing of Grant gift and alleged influence is central.'],
  'HN-313': ['03.04', 'Diplomatic crises', 'Public Spanish accusation arising from disputed naval explosion; accusation not established.'],
  'HN-461': ['12.02', 'Sinkings, capsizings and foundering', 'Ship-owner safety practices following the Vestris sinking.'],
  'HN-570': ['03.01', 'Campaigns', 'Pre-election speculation about Dewey’s campaign, not an actual presidency.'],
  'HN-675': ['10.07', 'Public careers', 'Kennedy’s political career prospects after Chappaquiddick.'],
  'HN-682': ['03.04', 'Diplomatic crises', 'U.S. arms policy toward Pakistan in international crisis.'],
  'HN-708': ['02.03', 'Strategic operations', 'Interpretation of the Entebbe military rescue; opinions tagged as such.'],
  'HN-712': ['01.03', 'Major thefts', 'Blackout-era looting is the commentary subject.'],
  'HN-743': ['02.03', 'Strategic operations', 'Grenada intervention and military-political context.'],
  'HN-752': ['09.04', 'Corporate crises', 'New Coke product-marketing controversy.'],
  'HN-798': ['01.08', 'Policing practices', 'Guard’s detention on unproved looting suspicion; no guilt implied.'],
  'HN-814': ['02.06', 'Political militancy', 'Militia rhetoric after Oklahoma City attack.'],
  'HN-822': ['04.01', 'Lynching and racial violence', 'Church arson and racist intimidation are central; Flight 800 bomb theory is not corroborated.'],
  'HN-870': ['03.07', 'Oversight', 'Questioning US claims about alleged Iraqi weapons.'],
  'HN-898': ['02.01', 'Air campaigns', 'Civilian damage in Lebanon military campaign, interpreted by a columnist.'],
  'HN-922': ['01.01', 'Assassination plots and attempts', 'Giffords shooting and subsequent political debate; do not imply proved perpetrator motive.'],
  'HN-934': ['09.08', 'Government budgets', 'Budget standoff and federal shutdown.'],
  'HN-947': ['02.06', 'Terrorist shootings and coordinated attacks', 'Argumentative opinion about Paris terrorist attack; no claim that text is neutral reporting.'],
  'HN-981': ['03.02', 'Transfers of power', 'Taliban takeover of Kabul, presented as editorial interpretation.']
}));

// Every previously-held article receives a defensible *subject indexing route*;
// allegation/genre and multiple-event caveats stay explicit.
add('03.03', 'Policy debates and public response');
const heldOverrides = new Map(Object.entries({
  'HN-109': ['01.01', 'Individual homicides', 'Contested *allegation* of shipboard murder; do not state homicide is proved.', 'alleged/disputed'],
  'HN-577': ['03.03', 'Policy debates and public response', 'Street interviews on US thermonuclear policy, not proof of a completed hydrogen bomb.', 'public-opinion feature'],
  'HN-871': ['11.05', 'Environmental change', 'Religious-environmental appeal connecting two unrelated emergencies; no climate-to-blackout causality.', 'reader letter; mixed-event'],
  'HN-1053': ['05.02', 'Hurricanes', 'Compound news brief: primary headline a forecast hurricane threat to Mexico; independent Greece floods cross-tagged.', 'multi-event report']
}));

const originalProposals = new Map();
for (const e of input.entries) {
  if (!e.proposedLeaf) continue;
  const k = `${e.subcategoryId}|${e.proposedLeaf}`;
  const list = originalProposals.get(k) ?? [];
  list.push(e.id);
  originalProposals.set(k, list);
}
if (originalProposals.size !== 51 || decisions.size !== 51) throw new Error(`Expected 51 source proposals and 51 decisions; got ${originalProposals.size}/${decisions.size}`);
for (const k of originalProposals.keys()) {
  const [, label] = k.split('|');
  if (!decisions.has(label)) throw new Error(`No decision for ${k}`);
  const [subCode, targetLabel, action] = decisions.get(label);
  if (action === 'add') add(subCode, targetLabel);
}
for (const [label] of decisions) {
  if (![...originalProposals.keys()].some(k => k.endsWith(`|${label}`))) throw new Error(`Unused decision ${label}`);
}

const originalsByCode = new Map();
for (const group of groups.values()) for (const sub of group.subs) {
  if (originalsByCode.has(sub.code)) throw new Error(`Duplicate sub ${sub.code}`);
  if (new Set(sub.leaves).size !== sub.leaves.length) throw new Error(`Duplicate leaf in ${sub.code}`);
  originalsByCode.set(sub.code, { group, sub });
}
const route = (code, leaf) => {
  const item = originalsByCode.get(code);
  if (!item || !item.sub.leaves.includes(leaf)) throw new Error(`Invalid target ${code} -> ${leaf}`);
  return { code, leaf, root: item.group.name, rootId: item.group.code, subcategory: item.sub.name };
};
const originalLeafRename = new Map([
  ['12.02|Vessels lost in storms', 'Sinkings, capsizings and foundering'],
  ['10.05|Editorials', 'Press criticism and editorial disputes']
]);
const classified = [];
for (const e of input.entries) {
  let primary, status = 'existing', note = '', genre = '', relatedTopics = '';
  if (e.proposedLeaf) {
    const [sub, leaf, action, rationale] = decisions.get(e.proposedLeaf);
    primary = route(sub, leaf); status = `proposal:${action}`; note = rationale;
    if (e.proposedLeaf === 'Maritime sinkings from wartime attacks') relatedTopics = 'War, Conflict & Security; hostile attack';
    if (e.proposedLeaf === 'Mining spoil-heaps and tailings slides') relatedTopics = 'Mining waste / industrial source';
    if (e.proposedLeaf === 'Mass-casualty aerial hijacking attacks') relatedTopics = 'Hijacked aircraft; 9/11';
    if (e.proposedLeaf === 'Armed attacks on civilian aircraft and passenger transport') relatedTopics = 'Passenger aircraft shootdown';
  } else if (heldOverrides.has(e.id)) {
    const [sub, leaf, reason, genreKind] = heldOverrides.get(e.id);
    primary = route(sub, leaf); status = 'held:qualified-route'; note = reason; genre = genreKind;
    if (e.id === 'HN-1053') relatedTopics = '05.03 > River floods (separate event in Greece)';
    if (e.id === 'HN-871') relatedTopics = '05.03 > Heat emergencies; 06.06 > Electrical grid failures and blackouts (unrelated events)';
  } else if (editorialOverrides.has(e.id)) {
    const [sub, leaf, reason] = editorialOverrides.get(e.id);
    primary = route(sub, leaf); status = 'editorial:subject-reroute'; note = reason; genre = 'editorial/opinion';
  } else {
    const oldLeaf = originalLeafRename.get(`${e.subcategoryId}|${e.leaf}`) ?? e.leaf;
    if (!oldLeaf) throw new Error(`Missing leaf ${e.id}`);
    primary = route(e.subcategoryId, oldLeaf);
    if (e.subcategoryId === '10.05' && e.leaf === 'Editorials') {
      status = 'editorial:media-topic'; genre = 'editorial/opinion';
      note = 'The newspaper or reporting practices, not merely article genre, are themselves the subject.';
    }
    if (e.leaf === 'Vessels lost in storms') status = 'broadened-original-leaf';
  }
  classified.push({
    id: e.id, date: e.date, title: e.title,
    originalRoot: e.root, originalSubCode: e.subcategoryId,
    originalSub: e.subcategory, originalLeaf: e.leaf ?? '', originalProposedLeaf: e.proposedLeaf ?? '',
    originalHoldReason: e.holdReason ?? '',
    candidateRootId: primary.rootId, candidateRoot: primary.root,
    candidateSubCode: primary.code, candidateSub: primary.subcategory,
    candidateLeaf: primary.leaf, decisionStatus: status,
    genreOrEvidence: genre, relatedTopics, rationale: note, link: e.link
  });
}
if (classified.length !== 1056 || new Set(classified.map(x=>x.id)).size !== 1056) throw new Error('Coverage / dedupe failed');
for (let n = 1; n <= 1056; n++) if (classified[n - 1].id !== `HN-${String(n).padStart(3, '0')}`) throw new Error(`ID continuity failed at ${n}`);
if (heldOverrides.size !== 4 || editorialOverrides.size !== 21) throw new Error('Manual override inventory mismatch');

const csvEscape = val => `"${String(val ?? '').replaceAll('"','""')}"`;
const columns = Object.keys(classified[0]);
const csv = [columns.join(','), ...classified.map(row => columns.map(col => csvEscape(row[col])).join(','))].join('\n') + '\n';
await fs.writeFile(path.join(base, 'Historical_Newspaper_Classification_LOCK_CANDIDATE.csv'), csv);

const tree = [];
for (const group of groups.values()) {
  tree.push(`# ${group.code} ${group.name}`);
  for (const sub of group.subs) tree.push(`${sub.name} :: ${sub.leaves.join(' | ')}`);
}
await fs.writeFile(path.join(base, 'historical_taxonomy_LOCK_CANDIDATE.txt'), tree.join('\n') + '\n');

const allLeaves = [...groups.values()].flatMap(group => group.subs.flatMap(sub => sub.leaves.map(leaf => ({sub:sub.code, name:leaf}))));
const occupied = new Map();
for (const item of classified) {
  const k = `${item.candidateSubCode}|${item.candidateLeaf}`;
  occupied.set(k, (occupied.get(k) ?? 0) + 1);
}
const byAction = Object.groupBy(classified, row => row.decisionStatus);
const originalGenreTotal = input.entries.filter(e => e.subcategoryId === '10.05' && e.leaf === 'Editorials').length;
const md = [];
const push = (...items) => md.push(...items);
push('# Historical newspaper discoveries — final label decisions / lock candidate', '',
  '**LOCK CANDIDATE; NOT YET APPROVED OR PUBLISHED.** Subject indexing is complete for all 1,056 reports with explicitly qualified routes for previously held complex articles. This is an interpretive classification of the reviewed newspaper records, not independent confirmation of every newspaper claim.', '',
  '## Coverage and results', '',
  `- **1,056/1,056** HN records preserved; no ID deleted, duplicated or merged.`,
  `- **51/51** proposed tertiary labels adjudicated by exact original label and source HN IDs.`,
  `- **${[...decisions.values()].filter(x=>x[2]==='add').length}** new-label decisions, **${[...decisions.values()].filter(x=>x[2]==='merge').length}** merges, **${[...decisions.values()].filter(x=>x[2]==='broaden').length}** broadening of an original leaf.`,
  `- **1** additional cross-cutting policy-debate leaf prompted by a held public-opinion record (HN-577).`,
  `- **${[...groups.values()].length}** top levels, **${[...groups.values()].reduce((n,g)=>n+g.subs.length,0)}** second levels and **${allLeaves.length}** tertiary slots in the candidate.`,
  `- **${occupied.size}/${allLeaves.length}** tertiary labels occupied by a primary HN record; **${allLeaves.length-occupied.size}** are empty in this specific corpus (not automatically redundant).`,
  `- **${originalGenreTotal}** previous generic “Editorials” assignments individually reconsidered: **${editorialOverrides.size}** moved to topic categories and **${originalGenreTotal-editorialOverrides.size}** retained as journalism-subject records.`,
  '- **4** previously held reports now receive qualified subject-index routes. HN-1053 and HN-871 remain explicitly multi-event, HN-109 is a contested allegation, and HN-577 is public opinion (not a scientific breakthrough).', '',
  '## Decision ledger — all 51 proposals', '',
  '| Existing second-level code | Original proposed third-level | HNs | Decision | Candidate destination | Why |',
  '|---|---|---:|---|---|---|');
for (const [key, ids] of [...originalProposals.entries()].sort((a,b)=>{
  const n=b[1].length-a[1].length; return n || a[0].localeCompare(b[0]);
})) {
  const [code, label] = key.split('|');
  const [sub, to, action, why] = decisions.get(label);
  push(`| ${code} | ${label.replaceAll('|','/')} | ${ids.length} | ${action} | ${sub} → ${to} | ${why.replaceAll('|','/')} |`);
}
push('', '## Evidence trail for every candidate', '',
  'The source HN identifiers are retained rather than conflated into event counts. Several records are reports of the same event (e.g. Korean Air Lines, Iran Air, 9/11, Aberfan), and so repeat article counts do not establish multiple independent events.', '');
for (const [key, ids] of [...originalProposals.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) {
  const [code, label] = key.split('|');
  push(`- **${code} ${label}** — ${ids.join(', ')}.`);
}
push('', '## Original taxonomy structural decisions', '',
  '- **Retire original 06.07 “Scientific Experiments & Breakthroughs” and 06.08 “Scientific Controversies & Disputed Discoveries” from the lock candidate.** Both were unused in this corpus; breakthrough and disputed-evidence status should ordinarily be recorded independently of science subject. The six original leaf labels are not secretly treated as occupied.',
  '- **Rename 08.03** to “Historical Artifacts & Documents” so tomb excavations are owned by 08.01, and recovered manuscripts/objects by 08.03.',
  '- **Broaden existing 12.02 storm-loss leaf** into “Sinkings, capsizings and foundering” rather than add one leaf for all sinkings and leave a redundant cause-specific sibling. Storm or hostile attack remains a causal attribute.',
  '- **Keep 10.06 genuine fabrication/retraction separate from 10.05.** A preliminary death toll, ordinary editorial, or alleged deception is not a proven media hoax.',
  '- **Do not add an “aerial expeditions” leaf to 08.05 at present.** HN-188 and HN-454 accurately fit existing 12.03 “Early aviation”; missing-aircraft/search reporting fits the added 12.07 aviation-search leaf.',
  '- **Keep other empty tertiary and second-level slots for now.** Lack of a primary story in this 1,056-item selected historical collection does not mean the category is semantically redundant or outside future scope.',
  '- **Disaster classification:** classify the central failure/hazard first; use rescue/evacuation/reconstruction folders only when the phase itself is central. Record causes (storm, mine waste, explosion, hostile attack), phase, and other relevant subjects as tags. The 12.02 maritime-fire leaf remains about onboard fire rather than the ultimate sinking outcome.',
  '- **Lynching and criminal justice:** reserve 04.01 “Lynching and racial violence” for race-targeted violence; non-racially established mob executions go to 01.07. Prosecutions, alleged guilt, police assertions and verdicts must remain distinguishable.', '',
  '## Four previously held HN routes', '',
  '| HN | Candidate primary route | Required caution |',
  '|---|---|---|');
for (const [id, [sub, leaf, caution, kind]] of heldOverrides) push(`| ${id} | ${sub} → ${leaf} | ${caution} (${kind}) |`);
push('', '## Original generic-editorial leaf: 24 individual judgments', '',
  'These entries were not automatically treated as journalism stories solely because they are editorials. The subject is primary where the writing concerns diplomacy, crime, public budgets, war, business, etc. The *format* remains editorial/opinion metadata.', '',
  '| HN | Decision | New subject route | Note |', '|---|---|---|---|');
for (const e of input.entries.filter(x=>x.subcategoryId==='10.05' && x.leaf==='Editorials')) {
  const row = classified.find(x=>x.id===e.id);
  push(`| ${e.id} | ${editorialOverrides.has(e.id)?'subject-reroute':'journalism-subject'} | ${row.candidateSubCode} → ${row.candidateLeaf} | ${row.rationale || 'Reporting practice itself central.'} |`);
}
push('', '## Important indexing and evidentiary rules', '',
  '1. **Only one primary three-level route per newspaper item.** Multiple-event articles additionally retain related subject routes and must never be misrepresented as a single causal chain.',
  '2. **A subject label is not a factual finding.** Reported murder allegations, suspected sabotage, early casualty figures and propaganda claims remain attributed and appropriately qualified.',
  '3. **Keep the report distinct from its underlying historical event.** Add event linkage IDs separately; do not collapse separate newspapers or duplicate contemporary reports.',
  '4. **Preserve genre, evidentiary status and incident mechanism separately.** Avoid treating editorials as journalism by default or unresolved events as paranormal by default.',
  '5. **Before locking for public navigation**, inspect a sample of each materially changed category, add event IDs where appropriate, decide whether proposed singletons should remain navigable as shown, and approve the final labels. No web publication or deletion is implied.', '',
  '## Machine-verifiable reconciliation', '',
  `The accompanying CSV has exactly **${classified.length}** rows; category ownership and leaf membership were checked against the generated candidate tree. Original HN identifiers, titles, links, original routes, proposal/hold fields, and decision status are preserved.`,
  `Decision-status tally: ${Object.entries(byAction).map(([k,v]) => `${k}: ${v.length}`).join('; ')}.`, '');
await fs.writeFile(path.join(base, 'Historical_Newspaper_Taxonomy_Decisions_LOCK_CANDIDATE.md'), md.join('\n'));

// Dedicated machine summary for deterministic cross-checking of every candidate.
const summary = {
  sourceItems: classified.length,
  uniqueItems: new Set(classified.map(x=>x.id)).size,
  rootCount: groups.size,
  subcategoryCount: [...groups.values()].reduce((n,g)=>n+g.subs.length,0),
  tertiaryCount: allLeaves.length,
  occupiedTertiaries: occupied.size,
  sourceProposals: originalProposals.size,
  decisions: Object.fromEntries(['add','merge','broaden'].map(k=>[k,[...decisions.values()].filter(x=>x[2]===k).length])),
  heldQualified: heldOverrides.size,
  editorialsRerouted: editorialOverrides.size,
  retiredSecondLevels: retiredSubs.map(x=>x.code),
  noMissingTarget: classified.every(x=>originalsByCode.get(x.candidateSubCode)?.sub.leaves.includes(x.candidateLeaf))
};
console.log(JSON.stringify(summary,null,2));
