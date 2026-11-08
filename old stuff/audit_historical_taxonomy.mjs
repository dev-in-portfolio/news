import fs from 'node:fs/promises';

const base = '/workspace/scratch/c35ff46ef126/';
const source = await fs.readFile(base+'Historical_Newspaper_Discoveries_1777-2026.md','utf8');
const schema = await fs.readFile(base+'historical_taxonomy_draft.txt','utf8');
const reviewSource = await fs.readFile(base+'historical_taxonomy_manual_review.txt','utf8');
const manualReview = new Map();
for (const line of reviewSource.split(/\r?\n/)) {
  const m=line.match(/^(\d+)\s*\|\s*(\d{2}\.\d{2})\s*\|\s*(.+)$/);
  if(!m)continue;
  const n=Number(m[1]);
  if(n<1||n>1056||manualReview.has(n))throw new Error('Bad or duplicate manual decision at HN-'+n);
  const instruction=m[3].trim();
  const type=/^\d+$/.test(instruction)?'existing':instruction.startsWith('ADD: ')?'proposed':instruction.startsWith('HOLD: ')?'hold':null;
  if(!type)throw new Error('Bad decision at HN-'+n);
  manualReview.set(n,{path:m[2],type,instruction,leafIndex:type==='existing'?Number(instruction):null,
    proposedLeaf:type==='proposed'?instruction.slice(5):null,holdReason:type==='hold'?instruction.slice(6):null});
}
const taxonomy = [];
for (const line of schema.split(/\r?\n/)) {
  if (line.startsWith('# ')) {
    const m = line.match(/^# (\d\d) (.+)$/);
    if (!m) throw new Error('Bad category: '+line);
    taxonomy.push({id:m[1],name:m[2],subs:[]});
  } else if (line.includes(' :: ')) {
    const [name,parts] = line.split(' :: ');
    const c = taxonomy.at(-1);
    c.subs.push({id:`${c.id}.${String(c.subs.length+1).padStart(2,'0')}`,name,leaves:parts.split(' | ')});
  }
}
// Hazard category proposed by multiple independently reviewed stories.
// It is kept separate from the unchanged 101-subcategory source draft.
taxonomy.find(c=>c.id==='05').subs.push({id:'05.09',name:'Landslides, Avalanches & Ground Failures (PROPOSED)',
  leaves:['Rockfalls, avalanches and landslides','Mining spoil-heaps and tailings slides','Sinkholes and subsidence failures']});
const taxonomyBySub=Object.fromEntries(taxonomy.flatMap(c=>c.subs.map(s=>[s.id,{...s,cat:c}])));
for(const [n,m] of manualReview){
  if(!taxonomyBySub[m.path])throw new Error('Unknown reviewed path at HN-'+n+': '+m.path);
  if(m.type==='existing'&&!taxonomyBySub[m.path].leaves[m.leafIndex-1])
    throw new Error('Out-of-range reviewed leaf at HN-'+n+': '+m.path+'.'+m.leafIndex);
}
const proposedAddGroups=new Map();
for(const [num,r] of manualReview){if(r.type!=='proposed')continue;
  const key=r.path+'|'+r.proposedLeaf;
  const group=proposedAddGroups.get(key)??{path:r.path,leaf:r.proposedLeaf,ids:[]};
  group.ids.push(`HN-${String(num).padStart(3,'0')}`);proposedAddGroups.set(key,group);
}

const entryRe=/^\*\*HN-(\d+) — (.*?) — (.*?)\*\*[ \t]*(?:\r?\n)/gm;
const locations=[...source.matchAll(entryRe)];
const entries=locations.map((m,i)=>{
  const body=source.slice(m.index+m[0].length,locations[i+1]?.index??source.length);
  const report=body.match(/^\*\*Report:\*\*\s*(.+)$/m)?.[1]??'';
  const assess=body.match(/^\*\*Assessment:\*\*\s*(.+)$/m)?.[1]??'';
  const link=body.match(/https?:\/\/[^)\s]+/)?.[0]??'';
  return {id:`HN-${m[1]}`,num:Number(m[1]),date:m[2],title:m[3].replace(/\*/g,''),report,assess,link};
});
if(entries.length!==1056)throw new Error('Parsed '+entries.length+' entries; expected 1056');
if(new Set(entries.map(e=>e.id)).size!==1056)throw new Error('Duplicate HN identifier');
for(let n=1;n<=1056;n++)if(!entries.find(e=>e.num===n))throw new Error('Missing HN-'+n);
if(manualReview.size!==entries.length)throw new Error('Incomplete report-level review: '+manualReview.size+' / '+entries.length);
for(const e of entries)if(!e.report.trim()||!manualReview.has(e.num))throw new Error('Missing report or manual review at '+e.id);

// Each pattern identifies the SUBJECT, not the truth of claims about that subject.
// Scores are priority weights. These are a screening aid, not independent verification.
const rules=[];
const rule=(path,regex,score=7)=>{if(!taxonomyBySub[path])throw new Error('Unknown path '+path);rules.push({path,regex,score});};

// Specific historical subjects should precede generic terms like death, fire or investigation.
rule('04.01',/lynch|racial (?:violence|riot|terror)|race riot|anti.black|segregat|emmett till|scottsboro|rosewood|tulsa attack|watts uprising|sharpeville|detroit racial|charlottesville|racial discriminat|rodney king|george floyd|black lives matter|racial vigilan/i,15);
rule('04.02',/suffrage|women.s (?:rights|equality)|nineteenth amendment|19th amendment|reproductive rights|dobbs|roe\b/i,15);
rule('04.03',/same.sex marriage|marriage equality|lgbt|transgender|anti.gay|matthew shepard|pulse nightclub/i,15);
rule('04.04',/indigenous|american indian movement|wounded knee|native american|cherokee|miami defendant|reserved lands|creek town/i,13);
rule('04.05',/refugee|deportation|deportee|migration|immigra|asylum|displac|family.separat|terminal island|el[ií]an|komagata/i,13);
rule('04.06',/civil.rights (?:movement|campaign|organizing)|freedom rider|bus boycott|selma|march on washington|voting.rights|protest(?:s|ers|ing)?|demonstrator|unrest|civil disobedience|street protests|occupy movement|student walkout/i,9);
rule('04.07',/housing hardship|poverty|inequal|humanitarian|famine|food insecurity|starvation|aid for|resource fair|relief fund|charitable appeal|disaster recovery inequities/i,12);
rule('04.08',/school integration|school ruling|little rock|education reform|charter arrangement|new orleans schools/i,12);

rule('02.07',/genocide|war.crime|extermination camp|holocaust|massacres? (?:at|of|in)|malmedy|sabra|shatila|rwanda.*(?:kill|mass)|armenian deportation|jewish persecution|kristallnacht|nuremberg/i,15);
rule('02.05',/mutin|court.martial|naval rebellion|sailors seize|crew seize|potemkin/i,14);
rule('02.04',/espionage|spy\b|spies|intelligence|sabotage|saboteur|zimmermann telegram|u.2 (?:intelligence|flight)|rosenberg/i,11);
rule('02.08',/blockade|occupation|occupied|prisoners? of war|pow\b|siege|armistice|prison camp/i,9);
rule('02.06',/terrorist|terrorism|hostage|hijack|bombing|bomb (?:attack|plot)|parade bombing|munich olympic|world trade center bombing|9\/11|september 11 attacks|bin laden|isis|al.qaeda|berlin.*bomb/i,10);
rule('02.02',/armed uprising|military revolt|easter rising|insurrection|rebellion|civil war|bay of pigs|red guard violence|soviet coup|khmer rouge/i,10);
rule('02.01',/battle|fighting|war begins|war against|war with|war on|war in|invasion|invades?|allied landing|d.day|normandy|middle east cease.fire|soviet forces attack|soviet armor|six.day war|army seizes|strikes hit|air strikes|large.scale strikes|civilian.airliner.*shootdown|attack on iran|gulf war|vietnam war|war resu/i,9);
rule('02.03',/military operation|military deployment|troop movement|warship|military stores|naval officer|military officer|military parade|air operation|bomb test|atomic.bomb attack|nuclear.test|rocket attack|naval airship/i,6);

rule('03.01',/electio|campaign|vote (?:announced|reported|count)|ballot|electoral.college|election.night|electoral.vote|trump wins|obama.s historic victory|orban concedes/i,10);
rule('03.02',/president (?:dies|resigns)|king (?:abdicates|dies)|queen|succession|succeeds|abdicates?|leadership change|new president|prime minister|becomes president|papal election|pope .*dies|pope .*elected|stalin.s death|roosevelt dies|harding dies|mandela.*president/i,10);
rule('03.03',/bill signed|law signed|new law|legislation|act signed|government policy|officials begin issuing|policy proposal|federal law|executive order|national banking holiday|social security|vaccination stockpile|tax bill/i,9);
rule('03.04',/diploma|treaty|foreign policy|peace negotiation|peace talks|peace agreement|summit|relations|greenland.s future|border dispute|foreign minister|canal rights|un partition|munich agreement|helsinki rights|brexit|sovereignty changes/i,10);
rule('03.05',/political scandal|teapot dome|watergate|iran.contra|impeachment|campaign funds|senator newberry|william jefferson|political corruption/i,15);
rule('03.06',/constitutional|amendment|statehood|joins the union|repeal|prohibition|supreme court (?:reverses|sets aside|blocks)|ratif|constitutional convention/i,10);
rule('03.07',/government investigation|committee hearing|official inquiry|federal probe|federal investigation|abuse of power|surveillance|government raid|justice department raid|government in the shadows|fbi.*false/i,8);

rule('12.02',/shipwreck|wreck of (?:the |a )?(?:ship|liner|steamer)|liner.*sinks?|ship.*sinks?|vessel.*lost|freighters.*destroyed|sank|sinking|capsiz|wrecked off|wrecking on a reef|ship.*collision|ship.*burn/i,13);
rule('12.07',/air(?:craft|line|liner|plane|liner).*crash|flight \d+|train .*collid|rail.*collision|commuter collision|train wreck|railway.*wreck|plane.*crash|helicopter.*collid|jet.*collid|flight.*disaster|passenger.train.*plunge|air florida|tenera?ife|boeing 737 max|pan am 103/i,15);
rule('12.03',/aviation|airplane|airman|airship|biplane|pilot|airline|commercial flight|pioneer flight|solo atlantic flight|early aviation/i,8);
rule('12.04',/railway|railroad|locomotive|rail line|freight train|rail system|rail bridge|commuter train/i,8);
rule('12.01',/ship(?:ping|yard)|steamboat|steamship|maritime|ocean liner|sailors|frigate|sloop|whaler|merchant vessel|cargo vessel|fishing vessel/i,4);
rule('12.06',/bridge|port infrastructure|port slots|ferry terminal|transit system|harbor development/i,4);
rule('12.08',/navigation|new route|transportation development|sea route|shipping lane|road network/i,4);
rule('12.05',/automobile|motor.vehicle|road accident|highway|motorcar/i,7);

rule('05.01',/earthquake|seismic|tremor|eruption|volcano|volcanic|st\. helens|pinatubo|nevado del ruiz|armero|messina/i,14);
rule('05.02',/hurricane|tornado|typhoon|cyclone|blizzard|severe storm|storm devastation|dust bowl storm/i,13);
rule('05.03',/flood|tsunami|tidal wave|heat.wave|heat emergency|heat.*death|mudflow|flash flood/i,12);
rule('05.04',/wildfire|forest fire|city fire|school fire|theatre fire|theater fire|nightclub fire|hotel blaze|urban fire|great new york fire|camp fire|paradise.s camp|notre.dame.*fire|los angeles.*fires|wildfire/i,12);
rule('05.05',/mine (?:blast|explosion|disaster|tragedy)|coal.mine|powder mill|powder works|munitions factory|arsenal blast|boiler (?:explosion|rupture)|industrial explosi|chemical leak|chemical release|factory fire|fertilizer.*explos|texas city disaster|bhopal|chernobyl|sago mine|coal disaster/i,12);
rule('05.06',/collapse|collapses|falls through|walkway|roof falls|bridge falls|dam failure|dam collapse|st\. francis dam|surfside|structure collapses/i,12);
rule('05.07',/stampede|crowd disaster|circus fire|mass.casu(?:alty|alties)|disaster at (?:a |the )?(?:public|venue)/i,8);
rule('05.08',/rescu|evacuat|trapped|emergency response|emergency preparedness|relief begins|searchers|recovery operation/i,6);

rule('07.01',/influenza|epidemic|pandemic|h1n1|covid|omicron|sars|cholera|ebola|zika|bird.flu|polio epidemic|plague discovery|disease outbreak|legion fever|aids transmission|hiv infection|measles/i,15);
rule('07.04',/vaccin|drug safety|tylenol|thalidomide|pharmaceut|first aids treatment|drug testing|medical licenses|new medicine/i,13);
rule('07.05',/arsenic|poison|toxic|contamination|tainted|carbon monoxide|foodborne|cyanide|fluoride|water contamination|hazardous gas/i,9);
rule('07.03',/surgery|medical technology|medical treatment|surgical|operation to cure|physicians.*experiment/i,10);
rule('07.02',/medical discovery|medicine nobel|health research|diagnosis|medical study|medical research|physiolog|biomedical|organ transplant|optogenetic/i,8);
rule('07.06',/hospital|healthcare|public health|sanitation|health reform|fda warning|health insurance|health care/i,8);
rule('07.07',/mental health|insanity defense|asylum care|psychiatr|medical practice/i,8);
rule('07.08',/miracle cure|cured paralysis|medical fraud|unproven cure|medical hoax|treatment controversy|unethical experiment/i,12);

rule('08.04',/ancient shipwreck|roman cargo ship|underwater excav|historic shipwreck|shipwrecks near|roman ship/i,17);
rule('08.06',/fossil|prehistoric|ancient teeth|hominin|human origins|early human|paleontol|monte verde/i,15);
rule('08.01',/archaeolog|excavat|ancient site|stonehenge|ancient wall|ancient monument|burial mound|lost postholes/i,14);
rule('08.03',/historical artifact|ancient document|roman gravestone|inscription|old manuscript|mummy|tomb|sarcophagus/i,12);
rule('08.02',/lost cit|ancient civilization|ancient settlement|ancient societ|prehistory/i,12);
rule('08.05',/expedition|polar explorer|north pole discovery|arctic expedition|geographic exploration|voyage of discovery|la p[eé]rouse/i,10);
rule('08.07',/rediscover|repatriat|historical identification|identified as|historical mystery solved/i,7);

rule('06.01',/nasa|apollo|artemis|astronaut|moon|lunar|mars rover|perseverance|space telescope|hubble|sputnik|skylab|satellite|spaceflight|earth orbit|orbiting|comet|eclipse|black hole|astronom|celestial|space agency|spacecraft|en[cs]eladus|outer space|roman space telescope|gagarin|john glenn|sally ride/i,15);
rule('06.03',/clone|genetic|genom|biolog|microbe|bacteria|organism|evolution|dolly the sheep/i,11);
rule('06.02',/physics|chemical discover|chemistry|material science|nuclear technolog|atomic test|hydrogen bomb|nuclear test|nuclear explosion|scientists.*radiation/i,9);
rule('06.04',/invent|patent|new engine|new engineering|armored steam warship|new technology|new device/i,8);
rule('06.05',/telegraph|telephone|radio technolog|computer|ransomware|technology breakthrough|digital|electronic|internet blackout|communications satellite/i,8);
rule('06.06',/electricity|power generation|energy technolog|research facility|engineering infrastructure/i,6);
rule('06.07',/scientific experiment|scientific finding|laboratory|scientists discover|research study|new study|newly reported lunar|scientific breakthrough/i,8);
rule('06.08',/scientific dispute|scientists push back|science debate|disputed scientific|researchers question|scientific controversy/i,10);

rule('09.02',/market crash|wall street panic|black tuesday|black monday|financial panic|banking panic|stock market|bank closure|bank run|financial crisis|2008 crash|frozen.credit|mortgage crisis/i,13);
rule('09.05',/\bunion\b|labor dispute|labor movement|workers? walkout|workers? protest|\bwages?\b|steel strike|textile walkout|collective bargaining|blair mountain|labor conflict|(?:worker|union|steel|coal|textile|labor|dock|mill|rail|teacher).{0,45}strike|strike.{0,45}(?:workers|union|wage|factory|labor|mill)/i,13);
rule('09.08',/tariff|tax legislation|taxation|budget|lottery instead of tax|public finance|public debt|bailout|credit cycle|federal reserve|economic policy/i,11);
rule('09.01',/banking|bank shareholder|bank of vincennes|banking system|currency|public bonds|credit markets|bank reopens|financial institution/i,10);
rule('09.03',/trade|import|export|shipowner|commerce|strait of hormuz traffic|oil embargo|trade route|food supply/i,9);
rule('09.07',/mine industry|mining industry|coal industry|factory output|industrial develop|petroleum field|oil well|manufactur|diesel and fuel oil|energy minister/i,8);
rule('09.06',/crop|harvest|food shortage|corn shipment|agricultur|commodity price|lumber price/i,9);
rule('09.04',/company|business|corporat|bankruptcy|new coke|coca.cola|worldcom|enron|ftx|tobacco company|business failure/i,7);

rule('10.06',/newspaper (?:retracts|admits publishing)|forged .*election story|fabricated (?:article|report)|deliberate press hoax|newspaper mistakes|falsely announces/i,16);
rule('10.05',/editorial|columnist|opinion|press coverage|newspaper.*(?:claim|framing|media)|media commentary|student.*column|headline language|newspaper.*coverage|publicity|press pursuit|broadcast report|press freedom/i,8);
rule('10.04',/world cup|olympi(?:c|ad)|jesse owens|sport|games competition|race winner|football championship/i,11);
rule('10.01',/rabbi|jewish congregation|church (?:service|organization)|priest|religious|sect|spiritual movement|heaven.s gate|peoples temple|jonestown|pope francis|pope leo|sermon|religious freedom|synagogue|interfaith/i,9);
rule('10.02',/literature|literary|theater|theatre performance|music|art exhibit|film festival|stage actor|novel/i,9);
rule('10.03',/television|radio scare|war of the worlds|broadcasting|movie|film industry|entertainment/i,9);
rule('10.07',/celebrity|actor|princess diana|cultural icon|prominent figure|obituary|public figure|death notice|gandhi.s death/i,8);
rule('10.08',/festival|circus|public spectacle|celebration|holiday|fairground|public exhibition|parade/i,6);

rule('11.03',/shark attack|animal attack|predator attack|wildlife attack|wolf attack/i,15);
rule('11.06',/pollution|oil spill|smog|environmental damage|environmental contamination|exxon valdez|flint.s contaminated|water pollution/i,14);
rule('11.04',/conservation|wildlife preservation|ecosystem|habitat|endangered/i,12);
rule('11.05',/climate change|climate trend|environmental change|long.term weather pattern/i,12);
rule('11.02',/rare species|newly identified animal|unusual species|species discover|unknown fish|strange animal/i,11);
rule('11.01',/animal behavior|wildlife|\bdogs?\b|\bcats?\b|\bbirds?\b|\bfish\b|\banimals?\b/i,7);
rule('11.07',/forest resource|water resources|natural resources|geological resources/i,8);

rule('13.01',/ghost|haunt|apparition|spirit at (?:a |the )?prison|haunted doorbell/i,16);
rule('13.02',/s[eé]ance|medium|spiritual knock|psychic|spirit photograph|spiritual manifestation/i,16);
rule('13.03',/ufo|flying saucer|unidentified sighting|roswell|radar reports.*jets|saucer coverage|alien craft/i,16);
rule('13.04',/premonition|prophe|dream predicts|dream supposedly|vision foretells|foretelling|predicts his death/i,15);
rule('13.05',/cryptid|sea monster|legendary creature|cat.rat hybrid|strange beast/i,14);
rule('13.06',/folklore|tale of a wrongful execution|moral anecdote|urban legend|lurid atrocity tale/i,12);
rule('13.07',/unexplained|mysterious disappear|mystery of the|vanished expedition|unresolved incident|mysterious phenomenon/i,8);
rule('13.08',/bizarre claim|sensational .*story|alleged miracle|bogus extraordinary|oddity|curiosit|java poison.tree/i,12);
// Lower-weight literal rescue patterns for generic historical headlines.
rule('05.04',/\bfire\b|\bfires\b|\bblaze\b|burns? down|burned down|conflagration/i,8);
rule('05.05',/\bexplos(?:ion|ions|ive)\b|\bblasts?\b|boiler ruptur/i,8);
rule('01.01',/\bkill\b|\bkilling\b|\bmurder\b|\bassassination\b|\bslain\b/i,9);
rule('01.03',/\brobbers?\b|\brobbery\b|\bburglars?\b|\bstole\b|\btheft\b/i,9);
rule('02.01',/\bfight\b|\bcombat\b|pirate ship|armed clash/i,8);
rule('02.05',/\bmutiny\b|\bmutineers?\b/i,12);
rule('12.01',/\bsteamboat\b|\bsteamship\b|\bschooner\b/i,5);
rule('12.02',/\bwreck\b|\bshipwreck\b|vessel sinks|sank at sea/i,11);
rule('04.05',/\brefugees?\b|\bdeported?\b|\bmigrants?\b/i,9);
rule('13.07',/\bvanished\b|\bmysterious\b|\bunexplained\b/i,7);
rule('07.02',/\bscientific medical discovery\b|new medical research/i,7);
rule('06.03',/\bclon(?:ed|ing|e)\b|\bgenetic\b|\bgenome\b/i,17);
rule('07.01',/\banthrax\b|\bmeasles\b|\binfectious\b/i,16);
rule('01.01',/\b(?:mass|school|campus|mall|rally) shooting\b|\bshootings\b|\bshot dead\b|\bkilled by gunfire\b/i,14);
rule('12.07',/\bSwissair\b.*\bcrash\b|\baviation\b.*\bcrash\b|\bjet\b.*\bcrash\b|\bjet\b.*\bcollision\b|\bderailment\b|\bderails\b|\bbridge\b.*\bcargo (?:ship|vessel)\b/i,15);
rule('02.01',/gunship strike|military strike|airstrike|missile strike|\bairstrikes\b|\barmed strikes\b|open war|military invasion/i,15);
rule('02.06',/\b(?:bomb|explosive|terror) attack\b|\bbomb\b.*\b(?:killed|attack|explod|blast)\b|\bmassacre\b.*\bterror\b|\bparis attacks\b|\b9\/11\b/i,14);
rule('05.03',/\bflash floods?\b|\bflood(?:s|ing|waters)?\b|heat wave|heatwave/i,14);
rule('05.06',/\b(?:roof|bridge|walkway|building|tower|dam)\b.*\bcollaps(?:e|ed|es)\b|\bstructural collapse\b|\bsinkhole\b/i,14);
rule('06.06',/\b(?:electricity|power|electrical|grid)\b.*\b(?:blackout|failure|outage|collapse)\b|\bblackout\b|\bpower failure\b/i,12);
rule('09.04',/\bbankrupt(?:cy)?\b|\bcorporate\b.*\bscandal\b|\bcompany collapses\b/i,15);
rule('09.03',/\boil embargo\b|\btrade embargo\b|\bshipping traffic\b|\bship traffic\b|\btrade restrictions\b/i,13);
rule('01.08',/\bprison escape\b|\bprison.break\b|\bprison.farm escape\b/i,15);
rule('03.02',/\b(?:nixon|president|prime minister|king)\b.*\bresign\b|\bpresidency\b.*\btransition\b|\bbecomes president\b|\bwins presidency\b/i,15);

// Explicit decisions for entries where keyword matching alone mistakes the core subject.
const overrides=new Map();
const pinConflicts=new Map();
function pin(path,nums,reason){for(const n of nums){if(!taxonomyBySub[path])throw new Error('Bad pin '+path);if(overrides.has(n)&&overrides.get(n).path!==path){pinConflicts.set(n,[...(pinConflicts.get(n)??[overrides.get(n).path]),path]);overrides.delete(n);}else if(!pinConflicts.has(n)) overrides.set(n,{path,reason});}}
pin('01.01',[1,6,17,22,26,29,34,41,59,60,68,70,71,78,86,92,93,96,109,113,117,127,129,133,145,146,151,163,170,171,175,178,183,247,249,252,291,303,328,345,362,363,438,442,462,492,567,568,644,645,651,668,669,726,727,744,864,926,956,959,960,969,986,1000,1012,1015,1017], 'central alleged or established criminal killing');
pin('01.04',[3,4,18,23,30,44,50,54,62,73,83,88,89,94,102,112,115,116,130,131,142,143,152,184,225,234,271,274,300,335,907], 'financial/document forgery or fraud');
pin('01.02',[5,81,177,204,206,207,215,270,272,297,312,344,446,447,476,477], 'disappearance/abduction primary');
pin('01.03',[46,103,121,137,159,168,185,186,210,237,238,240,250,251,275,279,294,315,317,318,324,326,334,339,342,349], 'theft or robbery primary');
pin('01.06',[10,58,90,99,104,106,120,128,169,186,258,259,293,327,369,395,420,425,428,443,455,470,472,483,534,583,595,606,610], 'trial or judicial decision primary');
pin('01.07',[11,38,105,173,174,228,245,254,256,261,264,267,281,299,408,445,499], 'execution, sentence, or vigilantism');
pin('01.08',[79,110,123,135,186,329,418,469,878], 'investigation/official law-enforcement actions');

pin('02.05',[7,8,9,56,63,69,84,87,101,111,139,140,141,147,148,149,150,153,160,176,182,193,202,212,217,222,243,255,347,348,350,354], 'mutiny or military discipline');
pin('02.04',[27,37,42,65,190,404,533,630,681], 'covert operation, spying, or sabotage');
pin('02.07',[35,52,97,399,537,538,547,550,556,559,694,702,732,735,745,877,879], 'mass violence and war crimes');
pin('02.01',[21,47,48,66,196,389,392,400,473,475,501,517,518,519,520,521,522,523,526,527,528,529,532,543,546,549,551,552,553,554,566,569,579,613,614,634,648,670,693,695,699,703,704,706,707,732,737,738,740,741,742,766,769,770,786,787,789,795,805,806,818,819,833,857,863,866,869,870,898,900,923,924,936,937,941,949,980,981,983,984,985,996,1011,1018,1019,1020,1025,1031,1056], 'armed conflict or interstate crisis');

pin('04.01',[33,82,91,122,228,236,245,254,256,261,264,267,281,282,295,299,311,325,356,364,369,398,405,406,415,416,426,427,433,467,469,503,530,531,539,540,599,605,606,607,615,616,617,629,635,642,643,647,649,650,652,653,654,664,665,667,678,679,680,691,692,713,783,790,796,797,808,809,812,823,837,838,850,858,891,895,899,901,903,910,916,919,938,942,956,961,972,974,988,1012,1013,1015,1055], 'civil rights and group-focused harm, action or change');

// Some entries are principally ABOUT reporting, not about the event whose details were disputed.
pin('10.06',[55,142,143,220,239,248,285,309,513,514,570,851], 'press correction, misinformation or media fabrication is the story');
pin('10.05',[140,248,311,313,325,367,461,516,559,570,681,712,713,715,716,738,743,752,797,814,822,840,842,847,849,851,856,862,865,870,876,880,885,898,900,922,925,928,929,938,941,943,944,947,949,970,974,975], 'article centers contemporary framing/commentary');

// Local event subject is more useful than headline wording about an editorial/report.
pin('05.05',[15,61,107,114,124,126,136,138,155,158,165,167,179,187,189,192,194,198,199,201,214,216,218,219,230,232,233,242,246,260,262,269,277,283,286,287,288,290,292,296,301,305,306,307,310,320,321,322,330,332,336,337,338,341,346,352,357,359,360,368,375,376,403,407,413,452,453,506,535,536,541,542,562,563,571,572,659,660,683,684,685,747,748,761,762,894,930,973,991,992], 'industrial or infrastructural incident');
pin('12.07',[221,257,273,284,289,302,326,343,371,372,374,377,379,409,444,450,468,507,580,581,603,611,710,711,730,731,751,774,775,776,820,821,822,824,831,832,836,867,868,964,966,997,998,1004,1009], 'transport incident or investigation');
pin('12.02',[51,109,164,207,231,243,257,283,343,351,382,383,386,391,396,397,460,461,490,491,518,612,751,993], 'maritime loss or wreck');

pin('06.01',[188,191,200,557,558,575,577,578,582,586,589,590,597,619,620,621,622,628,633,637,638,656,661,662,672,673,674,677,719,720,736,758,759,784,785,825,826,829,900,999,1006,1016,1023,1024,1026,1034,1035,1042,1043,1044,1047,1048,1050], 'space/science activity is primary');

// Remove contradictory manual pins from the list above only after adjudication.

// Tertiary matching: conservative lexical evidence, not a forced arbitrary leaf.
// Each tuple is [subcategory, 1-indexed leaf, expressions]. The expressions
// address newspaper vocabulary that often differs from modern folder labels.
const leafRules=[];
const leaf=(path,i,re)=>leafRules.push({path,i,re});
leaf('01.01',1,/murder|killed (?:his|her|a )|stabbed|poisoned|homicide|slaying/i);
leaf('01.01',2,/mass (?:murder|shooting|killing)|serial killer|multiple (?:killings|murders)|killed (?:\d+|many)|slaughter/i);
leaf('01.01',3,/assassinat(?:ed|ion)|president (?:shot|killed)|political leader murdered/i);
leaf('01.01',4,/assassination plot|plot (?:to kill|against)|attempt (?:on the life|to assassinate)|conspiracy to kill/i);
leaf('01.02',1,/ransom|abduct|kidnap/i);leaf('01.02',2,/missing|vanish|disappear|lost|whereabouts unknown/i);leaf('01.02',3,/detain|prisoner|chained|forced captivity|hostage/i);leaf('01.02',4,/traffick|sold into slavery/i);
leaf('01.03',1,/bank (?:raid|robber)|robbed.*bank/i);leaf('01.03',2,/train robber|stagecoach|express car robbery/i);leaf('01.03',3,/house (?:burglar|broken)|home burglar|dwelling/i);leaf('01.03',4,/theft|robber|stolen|steal|burglary|larceny|heist/i);
leaf('01.04',1,/counterfeit (?:coin|money|currency|banknote)|forged (?:note|bill)/i);leaf('01.04',2,/forg(?:ed|ery) (?:signature|paper|document|bill|warrant)|false papers/i);leaf('01.04',3,/impersonat|false identity|assumed identity|pretend(?:ed|ing) to be/i);leaf('01.04',4,/fraud|swindl|embezzl|pyramid scheme|ponzi|financial deception/i);
leaf('01.05',1,/gang|mob organized/i);leaf('01.05',2,/smuggl|contraband/i);leaf('01.05',3,/racket|protection money/i);leaf('01.05',4,/syndicate|organized crime|criminal network/i);
leaf('01.06',1,/trial|court.hear|indict|testif|jury|prosecut/i);leaf('01.06',2,/appeal|rehear|review.*conviction|revers(?:ed|al)/i);leaf('01.06',3,/acquit|not guilty|cleared of charges/i);leaf('01.06',4,/evidence|witness|forensic|testimony|disputed testimony/i);
leaf('01.07',1,/execut|hang(?:ed|ing)|death penalty|electric chair|guillotin/i);leaf('01.07',2,/repriev|pardon|commut/i);leaf('01.07',3,/sentenc|punishment|jail term/i);leaf('01.07',4,/wrongful|exonera|innocen(?:t|ce)|false conviction/i);
leaf('01.08',1,/investigat|detective|search warrant|criminal inquir/i);leaf('01.08',2,/police|sheriff|marshal|arrest|officer/i);leaf('01.08',3,/prison escape|jailbreak|escaped prisoner/i);leaf('01.08',4,/official misconduct|police brutality|abuse by police|corrupt officer/i);
leaf('02.01',1,/land battle|army (?:attack|fights)|ground forces|trench|infantry/i);leaf('02.01',2,/naval battle|warships? (?:fight|attack)|fleet battle|naval encounter/i);leaf('02.01',3,/air strike|bombing raid|aerial attack|air campaign/i);leaf('02.01',4,/siege|besieged/i);
leaf('02.02',1,/insurrect|uprising|revolt/i);leaf('02.02',2,/civil war|civil conflict/i);leaf('02.02',3,/armed resistance|guerilla|guerrilla|rebels? fight/i);
leaf('02.03',1,/troop|mobiliz|military build.up|reinforcement/i);leaf('02.03',2,/strategic operation|secret operation|special operation|military campaign plan/i);leaf('02.03',3,/deployment|forces sent|military personnel dispatched/i);
leaf('02.04',1,/spy|spies|espionage|intelligence agent/i);leaf('02.04',2,/counterintelligence|spy ring uncovered/i);leaf('02.04',3,/covert|clandestine|secret mission/i);leaf('02.04',4,/sabotage|saboteur/i);
leaf('02.05',1,/naval|ship|frigate|sloop|sailor|seamen|crew|vessel/i);leaf('02.05',2,/army revolt|soldiers rebel|military rebellion/i);leaf('02.05',3,/court.martial|military tribunal/i);
leaf('02.06',1,/bomb(?:ing|ed|er)|explosive attack/i);leaf('02.06',2,/hostage|hijack|kidnap/i);leaf('02.06',3,/terrorist|political violence|militant|extremist/i);
leaf('02.07',1,/massacre|slaughter|civilian(?:s)? killed|mass killing/i);leaf('02.07',2,/genocid|persecut|holocaust|deport|ethnic cleansing|extermination/i);leaf('02.07',3,/war.crime trial|tribunal|prosecution|nuremberg/i);
leaf('02.08',1,/occupat|occupied/i);leaf('02.08',2,/blockade|siege/i);leaf('02.08',3,/prisoner of war|pow|captivity|prison camp/i);
leaf('03.01',1,/campaign|candidate|nomination|rally/i);leaf('03.01',2,/voting dispute|ballot fraud|vote count dispute|electoral controversy/i);leaf('03.01',3,/election result|wins election|elected|victory|vote total|electoral college/i);
leaf('03.02',1,/succession|succeeds|new king|crown passed/i);leaf('03.02',2,/resign|abdicate|steps down/i);leaf('03.02',3,/dies|death|assassin/i);leaf('03.02',4,/becomes president|takes power|inaugurat|new leader|sworn in/i);
leaf('03.03',1,/new law|act passed|legislation|bill (?:signed|passes)/i);leaf('03.03',2,/regulat|restriction|administrative rule/i);leaf('03.03',3,/repeal|rescinds|overturns law/i);leaf('03.03',4,/executive order|presidential directive|decree/i);
leaf('03.04',1,/treaty|agreement signed|peace accord/i);leaf('03.04',2,/diplomatic crisis|envoy|ambassador|foreign relations|ultimatum/i);leaf('03.04',3,/border|territory|annex|sovereignt|greenland/i);
leaf('03.05',1,/brib|corrupt payment/i);leaf('03.05',2,/misuse of office|office abuse|official misconduct/i);leaf('03.05',3,/scandal|influence|political funds|campaign money/i);
leaf('03.06',1,/amendment|ratif|constitution changed/i);leaf('03.06',2,/reform|institutional change|statehood/i);leaf('03.06',3,/supreme court|constitutional ruling|constitutional law/i);
leaf('03.07',1,/oversight|hearing|committee investigation|congressional inquiry/i);leaf('03.07',2,/surveillance|wiretap|spying on citizens/i);leaf('03.07',3,/agency misconduct|abuse of power|official raid|government corruption/i);
leaf('04.01',1,/segregat|jim crow|racially segregated|integration/i);leaf('04.01',2,/lynch|racial violence|race riot|racial killing|mob attack|white supremacist/i);leaf('04.01',3,/civil rights|equality|anti.discrimination|racial justice|freedom campaign/i);
leaf('04.02',1,/suffrage|women vote|women.s vote|nineteenth amendment/i);leaf('04.02',2,/workplace|equal pay|labor equality/i);leaf('04.02',3,/abortion|reproductive|roe|dobbs/i);
leaf('04.03',1,/marriage equality|same.sex marriage/i);leaf('04.03',2,/transgender|gender.identity|gender affirming/i);leaf('04.03',3,/discrimination|gay rights|lgbtq|anti.gay/i);
leaf('04.04',1,/sovereignty|tribal authority|self.determin|treaty rights/i);leaf('04.04',2,/land rights|reserved land|territor|land claim/i);leaf('04.04',3,/relocation|removal|deport|displac/i);
leaf('04.05',1,/migration|immigrat|migrant/i);leaf('04.05',2,/asylum|refugee status|sanctuary/i);leaf('04.05',3,/deport|expuls|removed from|repatriat/i);leaf('04.05',4,/refugee|displac|fleeing homes/i);
leaf('04.06',1,/march|rally|demonstrat|protest march/i);leaf('04.06',2,/civil disobedience|boycott|sit.in|nonviolent resistance/i);leaf('04.06',3,/crackdown|riot police|protest arrests|police response/i);
leaf('04.07',1,/housing|homeless|tenement|shelter/i);leaf('04.07',2,/food insecurity|starv|hunger|famine|food shortage/i);leaf('04.07',3,/welfare|relief|aid|charity|assistance/i);
leaf('04.08',1,/school integrat|desegregat/i);leaf('04.08',2,/education|school access|literacy/i);leaf('04.08',3,/social reform|institutional reform|equal opportunity/i);
leaf('05.01',1,/earthquake|seismic|tremor/i);leaf('05.01',2,/volcano|erupt|ash cloud|lava/i);leaf('05.01',3,/aftershock|geologic risk|volcanic hazard/i);
leaf('05.02',1,/hurricane|typhoon|cyclone/i);leaf('05.02',2,/tornado|twister/i);leaf('05.02',3,/blizzard|snowstorm|ice storm/i);
leaf('05.03',1,/river flood|river overflows?|flooded river/i);leaf('05.03',2,/flash flood|floodwaters|flooding/i);leaf('05.03',3,/tsunami|tidal wave/i);leaf('05.03',4,/heatwave|heat wave|heat emergency|deadly heat/i);
leaf('05.04',1,/citywide fire|city fire|town fire|urban conflagration/i);leaf('05.04',2,/wildfire|forest fire|bushfire/i);leaf('05.04',3,/building fire|hotel fire|school fire|theatre fire|theater fire|nightclub fire|factory fire|structure burns|fire at/i);
leaf('05.05',1,/coal mine|mine disaster|mine explos|miners? (?:trapped|killed)|colliery/i);leaf('05.05',2,/factory|plant explosion|powder mill|arsenal|boiler|munitions|industrial explosion/i);leaf('05.05',3,/chemical|toxic gas|leak|contamination|bhopal|industrial poison/i);
leaf('05.06',1,/building|hotel|tower|apartment|roof collapse/i);leaf('05.06',2,/bridge|viaduct/i);leaf('05.06',3,/walkway|public structure|grandstand|dam|levy/i);
leaf('05.07',1,/stampede|crowd crush/i);leaf('05.07',2,/venue|circus|concert|theater|arena|festival/i);leaf('05.07',3,/mass casualty|many people (?:died|injured)|accident/i);
leaf('05.08',1,/search|rescu|saved|recovering bodies/i);leaf('05.08',2,/evacuat|fleeing|relocation/i);leaf('05.08',3,/relief|emergency aid|disaster response/i);
leaf('06.01',1,/astronom|eclipse|comet|planet|star|telescope|celestial|black hole|supernova|observ/i);leaf('06.01',2,/astronaut|human.spaceflight|crew|apollo|space station|gagarin|john glenn|sally ride|moonwalk/i);leaf('06.01',3,/rover|probe|robotic|satellite|spacecraft|mars|lunar mission|uncrewed/i);
leaf('06.02',1,/nuclear|atomic|radiation|physics/i);leaf('06.02',2,/chemistry|element|molecule|chemical/i);leaf('06.02',3,/material|alloy|polymer|superconductor/i);
leaf('06.03',1,/evolut|species origin|natural selection/i);leaf('06.03',2,/genet|dna|genom/i);leaf('06.03',3,/clone|dolly/i);leaf('06.03',4,/microb|bacter|cell/i);
leaf('06.04',1,/invention|engine|machine|device|patent/i);leaf('06.04',2,/engineering|bridge design|structure|mechanism/i);leaf('06.04',3,/patent|intellectual property/i);
leaf('06.05',1,/telegraph|telephone|wireless/i);leaf('06.05',2,/computer|microchip|electronic|processor/i);leaf('06.05',3,/internet|digital|network|ransomware|cyber/i);
leaf('06.06',1,/electric|power plant|generator/i);leaf('06.06',2,/nuclear reactor|nuclear power/i);leaf('06.06',3,/laboratory|research facility|observatory/i);
leaf('06.07',1,/experiment|trial|laboratory/i);leaf('06.07',2,/theor|hypothesis/i);leaf('06.07',3,/discovery|findings?|confirmed|breakthrough/i);
leaf('06.08',1,/debate|competing theory|scientific dispute/i);leaf('06.08',2,/credit|priority dispute|who first/i);leaf('06.08',3,/replicat|reproduc|could not verify/i);
leaf('07.01',1,/influenza|flu pandemic|spanish flu|h1n1/i);leaf('07.01',2,/cholera|polio|plague|epidemic/i);leaf('07.01',3,/covid|coronavirus|ebola|aids|hiv|sars|zika|emerging disease|omicron/i);
leaf('07.02',1,/diagnos|test detects|screening/i);leaf('07.02',2,/disease mechanism|how .* disease|infection causes/i);leaf('07.02',3,/medical research|biomedical|study|breakthrough/i);
leaf('07.03',1,/surger|transplant|operation/i);leaf('07.03',2,/treatment|therap|cure/i);leaf('07.03',3,/device|scanner|diagnostic equipment|medical technolog/i);
leaf('07.04',1,/vaccin|immuniz/i);leaf('07.04',2,/medicine|drug|pharma|antibiotic/i);leaf('07.04',3,/recall|drug safety|poisoned products|tylenol/i);
leaf('07.05',1,/accidental poison|carbon monoxide|gas exposure|chemical exposure/i);leaf('07.05',2,/food|water|milk|beverage|contaminated supply/i);leaf('07.05',3,/toxic|arsenic|poison|cyanide/i);
leaf('07.06',1,/hospital|medical ward/i);leaf('07.06',2,/sanitation|sewage|public hygiene/i);leaf('07.06',3,/healthcare|health care|health insurance|access|medicare|public health/i);
leaf('07.07',1,/psychiatr|mental illness|mental health/i);leaf('07.07',2,/asylum|institutional care/i);leaf('07.07',3,/historical medical|old treatment|medical custom/i);
leaf('07.08',1,/miracle cure|unproven treatment|cure.all/i);leaf('07.08',2,/unethical experiment|human experimentation|nonconsensual/i);leaf('07.08',3,/fraud|deceptive medicine|fake doctor/i);
leaf('08.01',1,/tomb|burial|grave|sarcophag/i);leaf('08.01',2,/settlement|village|ancient site|excavat/i);leaf('08.01',3,/monument|stonehenge|temple|wall/i);
leaf('08.02',1,/lost city|ancient city/i);leaf('08.02',2,/civilization|ancient society|roman|egyptian|mayan/i);leaf('08.02',3,/ruins|ruined town|abandoned/i);
leaf('08.03',1,/manuscript|document|scroll|written/i);leaf('08.03',2,/inscription|gravestone|epigraph/i);leaf('08.03',3,/object|artifact|recovered|treasure|jewel|pottery/i);
leaf('08.04',1,/underwater|seabed|marine excavation/i);leaf('08.04',2,/ancient (?:boat|ship|vessel)|roman ship|wreck/i);leaf('08.04',3,/cargo|amphora|shipload/i);
leaf('08.05',1,/polar|arctic|antarctic|north pole|south pole/i);leaf('08.05',2,/ocean|voyage|sea expedition|ship/i);leaf('08.05',3,/land|jungle|desert|continental expedition/i);
leaf('08.06',1,/fossil|dinosaur|ancient animal/i);leaf('08.06',2,/hominin|early human|human origin/i);leaf('08.06',3,/prehistoric|stone age|paleo/i);
leaf('08.07',1,/artifact|object identification/i);leaf('08.07',2,/solved|identified|explained|lost history|historical mystery/i);leaf('08.07',3,/repatriat|returned to country|restored to people/i);
leaf('09.01',1,/bank|banking/i);leaf('09.01',2,/currency|coin|dollar|money supply/i);leaf('09.01',3,/credit|lending|loans|bonds/i);
leaf('09.02',1,/bank run|bank panic|bank collapse/i);leaf('09.02',2,/market crash|stock|wall street|black monday|black tuesday/i);leaf('09.02',3,/depression|recession|downturn|financial crisis/i);
leaf('09.03',1,/import|export|foreign trade/i);leaf('09.03',2,/trade route|strait|shipping corridor/i);leaf('09.03',3,/commerce|international market|global trade/i);
leaf('09.04',1,/found|new firm|business starts/i);leaf('09.04',2,/bankrupt|scandal|corporat.*collapse|company crisis/i);leaf('09.04',3,/industrial|expansion|new works|growth/i);
leaf('09.05',1,/strike|walkout|work stoppage/i);leaf('09.05',2,/union|labor organiz/i);leaf('09.05',3,/negotiat|collective bargain|wage agreement/i);
leaf('09.06',1,/harvest|crop|farm production/i);leaf('09.06',2,/food shortage|famine|scarcity|grain crisis/i);leaf('09.06',3,/price|commodity|market cost/i);
leaf('09.07',1,/coal|oil|petroleum|fuel/i);leaf('09.07',2,/mining|mine industry|mineral/i);leaf('09.07',3,/factory|manufactur|industrial plant/i);
leaf('09.08',1,/tariff|duty|customs/i);leaf('09.08',2,/tax|taxation|levy/i);leaf('09.08',3,/budget|finance|public expenditure|government spending/i);
leaf('10.01',1,/church|congregat|synagogue|religious community/i);leaf('10.01',2,/cult|movement|sect|heaven.s gate|jonestown/i);leaf('10.01',3,/controversy|persecution|religious rights|religious debate/i);
leaf('10.02',1,/book|novel|literature|poem|author/i);leaf('10.02',2,/art|painting|sculpture|museum/i);leaf('10.02',3,/music|song|concert/i);leaf('10.02',4,/theat|stage|play|perform/i);
leaf('10.03',1,/film|movie|cinema/i);leaf('10.03',2,/radio|broadcast|television|tv /i);leaf('10.03',3,/entertainment|pop culture|popular/i);
leaf('10.04',1,/international tournament|world cup|olympi/i);leaf('10.04',2,/record|champion|wins|victory/i);leaf('10.04',3,/recreation|games|play/i);
leaf('10.05',1,/editorial|opinion|column/i);leaf('10.05',2,/investigative|journalis|press investigation/i);leaf('10.05',3,/press freedom|censorship|free speech|publication restriction/i);
leaf('10.06',1,/fabricat|fake|hoax|forged report/i);leaf('10.06',2,/retract|corrects|correction/i);leaf('10.06',3,/deliberate.*deception|false story|misinformation/i);
leaf('10.07',1,/biograph|life of|life story/i);leaf('10.07',2,/career|celebrity|public figure/i);leaf('10.07',3,/obituary|dies|death of|death announced/i);
leaf('10.08',1,/festival|holiday|celebration/i);leaf('10.08',2,/tradition|custom|ritual/i);leaf('10.08',3,/exhibit|fair|parade|circus|show/i);
leaf('11.01',1,/mammal|dog|cat|horse|whale|wolf|bear/i);leaf('11.01',2,/bird|eagle|owl/i);leaf('11.01',3,/fish|shark|marine life|aquatic/i);leaf('11.01',4,/insect|bee|locust|beetle/i);
leaf('11.02',1,/rare|unusual sight|sighting/i);leaf('11.02',2,/abnormal|hybrid|mutant|deform/i);leaf('11.02',3,/new species|newly identified|discovered species/i);
leaf('11.03',1,/shark|lion|tiger|wolf|bear|alligator|predator/i);leaf('11.03',2,/attack|bite|dangerous encounter/i);leaf('11.03',3,/wildlife conflict|human wildlife|animal nuisance/i);
leaf('11.04',1,/habitat|forest|wetland/i);leaf('11.04',2,/protect|conservation|endangered/i);leaf('11.04',3,/ecosystem|biodivers|ecological/i);
leaf('11.05',1,/climate|warming|temperature trend/i);leaf('11.05',2,/weather pattern|long.term record/i);leaf('11.05',3,/environmental change|ecological change/i);
leaf('11.06',1,/air pollution|smog|smoke pollution/i);leaf('11.06',2,/water contamination|polluted river|flint|water crisis/i);leaf('11.06',3,/environmental harm|oil spill|toxic discharge|pollution/i);
leaf('11.07',1,/forest|timber|woodland/i);leaf('11.07',2,/water|river|aquifer/i);leaf('11.07',3,/geolog|mineral|earth resource/i);
leaf('12.01',1,/passenger liner|ocean liner|steamship.*passenger/i);leaf('12.01',2,/merchant|cargo|freighter|trading vessel/i);leaf('12.01',3,/maritime|ship operation|sailing|steamboat|naval/i);
leaf('12.02',1,/collis|struck another ship/i);leaf('12.02',2,/aground|grounded|reef|shoal|rocks/i);leaf('12.02',3,/storm|hurricane|typhoon|lost at sea|sank|sinking|shipwreck/i);
leaf('12.03',1,/early flight|first flight|pioneer|biplane|airship/i);leaf('12.03',2,/airline|commercial aviation|passenger flight/i);leaf('12.03',3,/aircraft develop|new plane|aviation technology/i);
leaf('12.04',1,/rail system|network|route|rail line/i);leaf('12.04',2,/locomotive|engine|train technology/i);leaf('12.04',3,/passenger|freight|commuter/i);
leaf('12.05',1,/first car|early automobile|motorcar/i);leaf('12.05',2,/highway|road|interstate/i);leaf('12.05',3,/road transport|bus|motor.vehicle/i);
leaf('12.06',1,/bridge/i);leaf('12.06',2,/harbor|port|dock/i);leaf('12.06',3,/station|transit|terminal/i);
leaf('12.07',1,/air(?:craft|plane|liner).*crash|flight \d+|plane crash|air disaster|helicopter/i);leaf('12.07',2,/train|railway|locomotive|rail disaster/i);leaf('12.07',3,/motor vehicle|road accident|car crash|traffic/i);
leaf('12.08',1,/navigat|pilot route|ship channel/i);leaf('12.08',2,/new route|first passage|atlantic crossing/i);leaf('12.08',3,/service|transport expansion|scheduled operation/i);
leaf('13.01',1,/haunted (?:house|place|building|door)|haunting at/i);leaf('13.01',2,/apparition|figure appeared|ghostly vision/i);leaf('13.01',3,/ghost|spirit|haunting/i);
leaf('13.02',1,/medium|spiritualist/i);leaf('13.02',2,/spirit communication|knock|s[eé]ance/i);leaf('13.02',3,/psychic|demonstration|table tipping/i);
leaf('13.03',1,/unidentified aerial|unexplained radar/i);leaf('13.03',2,/ufo|flying saucer|roswell/i);leaf('13.03',3,/alien|encounter|claimed contact/i);
leaf('13.04',1,/dream|nightmare/i);leaf('13.04',2,/premonition|foretold|predict/i);leaf('13.04',3,/fortune tell|divination|prophecy/i);
leaf('13.05',1,/sea monster/i);leaf('13.05',2,/cryptid|unknown creature/i);leaf('13.05',3,/legendary|strange beast|hybrid/i);
leaf('13.06',1,/moral|anecdote|parable/i);leaf('13.06',2,/urban legend|apocryphal/i);leaf('13.06',3,/folklore|regional legend|local lore/i);
leaf('13.07',1,/unexplained|strange circumstance|unknown cause/i);leaf('13.07',2,/lost expedition|vanished crew/i);leaf('13.07',3,/unresolved|missing records|historical mystery/i);
leaf('13.08',1,/extraordinary claim|bizarre assertion|impossible/i);leaf('13.08',2,/miracle|supernatural cure/i);leaf('13.08',3,/oddity|curious|strange|unusual|astonishing/i);

const candidatesFor=e=>{
  const list=[];
  for(const s of Object.values(taxonomyBySub)){
    let score=0;const evidence=[];
    for(const r of rules.filter(r=>r.path===s.id)) {
      const inTitle=r.regex.test(e.title),inReport=r.regex.test(e.report);
      if(inTitle || inReport){const v=(inTitle?r.score+3:r.score*0.27)+(inTitle&&inReport?0.4:0);
        if(v>score){score=v;evidence.length=0;evidence.push(inTitle?'title':'report');}}
    }
    if(score)list.push({path:s.id,root:s.cat.name,subcategory:s.name,score:Number(score.toFixed(1)),evidence:evidence.join(', ')});
  }
  const pinned=overrides.get(e.num);
  if(pinned){const c=list.find(x=>x.path===pinned.path);if(c){c.score+=4;c.evidence+='; curated candidate';}else{
    const s=taxonomyBySub[pinned.path];list.push({path:pinned.path,root:s.cat.name,subcategory:s.name,score:15,evidence:'curated candidate only'});
  }}
  return list.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path));
};
const leafFor=(e,path)=>{
  if(!path)return {leaf:null,index:null,all:[]};
  // Explicit headline evidence is ranked above supporting article text.
  const found=leafRules.filter(l=>l.path===path).map(l=>{
    const tm=e.title.match(l.re),rm=e.report.match(l.re);
    return {...l,score:tm?20+Math.min(10,tm[0].length/2):rm?5+Math.min(4,rm[0].length/4):0};
  }).filter(l=>l.score).sort((a,b)=>b.score-a.score||a.i-b.i);
  if(!found.length) return {leaf:null,index:null,all:[]};
  const top=found[0],s=taxonomyBySub[path];
  const tied=found.filter(l=>l.score===top.score);
  return {leaf:tied.length===1?s.leaves[top.i-1]:null,index:tied.length===1?top.i:null,all:found.map(l=>({label:s.leaves[l.i-1],score:l.score})),tie:tied.length>1};
};
// Individually checked against each named story's headline after first pass.
// These resolve clear subject-level failures of lexical screening; the source
// report/assessment and every tertiary placement still have separate flags.
const reviewedCorrections=new Map();
const reviewedDuplicates=new Map();
function assign(path,nums){if(!taxonomyBySub[path])throw new Error('Bad reviewed path '+path);
  for(const n of nums){if(reviewedCorrections.has(n))reviewedDuplicates.set(n,[reviewedCorrections.get(n),path]);
    reviewedCorrections.set(n,path);}}
assign('01.01',[6,17,34,36,78,227,304,486,657,844,864,931,948,959,960,969,986,1000]);
assign('01.02',[5,81,132,207,211]);
assign('01.03',[46,104,159,331]);
assign('01.04',[89,143]);
assign('01.05',[31,463]);
assign('01.06',[105,113,186,474,606]);
assign('01.07',[38,58,99,170,174,254,281,373,439,471]);
assign('01.08',[100,203,308,329,381,488,598,600,683,684,685,1012,1015]);
assign('02.01',[21,47,389,501,671,729,805,1018]);
assign('02.02',[793,977]);
assign('02.03',[100,1011]);
assign('02.04',[27,37,42,65,751]);
assign('02.05',[2,9,118,160]);
assign('02.06',[28,208,266,276,378,402,423,424,452,453,596,687,802,813,855,883]);
assign('02.07',[35,390,510,538,741,847]);
assign('02.08',[66,636]);
assign('03.01',[248,570,976]);
assign('03.02',[576,584,700,808,1008]);
assign('03.03',[437,498,525,945]);
assign('03.04',[48,640,641,696,818,985]);
assign('03.05',[481,830]);
assign('03.06',[91,482,485,625,782,794]);
assign('03.07',[79,203,418,598,600,970]);
assign('04.01',[82,91,606,607,713,798,808,809,812,823,850,858]);
assign('04.04',[70,77,99]);
assign('04.05',[530,884,962]);
assign('04.06',[609,610,671,742,778,925,938,961,968,972,974,988,1013]);
assign('04.07',[64,746,800,810,815,888,893,895,896,901]);
assign('04.08',[626,845,897,932]);
assign('05.01',[780]);
assign('05.02',[493,585]);
assign('05.03',[384,451,457,585,817,871,957,1001,1010]);
assign('05.04',[57,72,74,95,114,144,253,278,280,340,343,361,376,411,466,535,536,544,545,560,624,725]);
assign('05.05',[15,107,138,181,214,232,242,246,283,301,336,375,413,563,659,660,747,748,973]);
assign('05.06',[61,209,273,430,456,666,728,979,998]);
assign('05.08',[75,368,573,574,676,773,884,886,893,963]);
assign('06.02',[557,558,575,577,582,586,597,622,900]);
assign('06.03',[825,1046,1050]);
assign('06.05',[638,955]);
assign('06.06',[655,712,871,872,873,958,1021]);
assign('07.01',[860]);
assign('07.02',[19,39,235,1051]);
assign('07.05',[129,146,151,224,247,249,298,555,571,572,601]);
assign('07.06',[39,848,919]);
assign('08.05',[49,508,509]);
assign('08.06',[1046]);
assign('09.01',[45,480]);
assign('09.02',[909,912]);
assign('09.04',[989]);
assign('09.05',[390,432,487,627]);
assign('09.06',[25,64,493,995]);
assign('09.08',[12,918]);
assign('10.01',[80,713,714,716,717,718]);
assign('10.04',[502,823,861,1037]);
assign('10.05',[55,59,140,313,367,570,798,822,842,851,865,870,920,943,947]);
assign('10.06',[142,239,309]);
assign('10.07',[244]);
assign('10.08',[214,788,1045]);
assign('11.01',[76,119,440]);
assign('11.02',[119]);
assign('11.06',[571,572,777,921,951]);
assign('12.01',[76,100,109,223]);
assign('12.02',[257,343,518,519]);
assign('12.03',[188,468]);
assign('12.07',[164,195,221,273,374,377,468,603,738,751,822,824,836,930,997,998]);
assign('12.08',[370,978,1020]);
assign('13.06',[11,35]);
assign('13.07',[108,508,509]);
assign('13.08',[13,14,16,108,265]);
// Explicit resolution after inspecting every duplicate override against titles.
const finalResolutions={100:'03.07',64:'04.07',76:'01.06',91:'04.01',99:'04.04',108:'13.08',119:'11.02',214:'05.05',273:'12.07',343:'12.02',390:'09.05',493:'05.02',508:'08.05',509:'08.05',570:'10.05',585:'05.03',606:'04.01',671:'04.06',713:'04.01',798:'10.05',808:'03.02',823:'10.04',822:'10.05',871:'05.03',884:'05.08',893:'05.08',998:'12.07'};
for(const [n,p] of Object.entries(finalResolutions))reviewedCorrections.set(Number(n),p);
assign('10.05',[797]);

const mapped=entries.map(e=>{
  const candidates=candidatesFor(e);
  const reportReview=manualReview.get(e.num);
  const reviewedPath=reportReview?.path??reviewedCorrections.get(e.num);
  if(reviewedPath){const at=candidates.findIndex(c=>c.path===reviewedPath);
    if(at>=0){const hit=candidates.splice(at,1)[0];hit.evidence+=reportReview?'; headline and report reviewed':'; headline-level adjudication';hit.score=Math.max(hit.score,reportReview?50:30);candidates.unshift(hit);}
    else{const s=taxonomyBySub[reviewedPath];candidates.unshift({path:reviewedPath,root:s.cat.name,subcategory:s.name,score:reportReview?50:30,evidence:reportReview?'headline and report reviewed':'headline-level adjudication'});}}
  const a=candidates[0],b=candidates[1];
  const path=a?.path??null;
  let leafInfo=leafFor(e,path);
  if(reportReview){
    if(reportReview.type==='existing'){
      leafInfo={leaf:taxonomyBySub[path].leaves[reportReview.leafIndex-1],index:reportReview.leafIndex,all:leafInfo.all,manual:true};
    }else leafInfo={leaf:null,index:null,all:leafInfo.all,manual:true};
  }
  const ambiguous=!reviewedPath&&Boolean(b && (b.score>=a.score-3 || (b.path.slice(0,2)!==a.path.slice(0,2)&&b.score>=a.score-5)));
  const flags=[];
  if(!path)flags.push('no subcategory lexical match');
  if(ambiguous)flags.push('multiple plausible subcategories');
  if(a?.evidence==='curated candidate only')flags.push('curated placement lacks corroborating title/report keyword');
  if(pinConflicts.has(e.num))flags.push('competing curated subject candidates');
  if(reportReview?.type==='proposed')flags.push('proposed missing tertiary label; not adopted');
  else if(reportReview?.type==='hold')flags.push('tertiary route held for editorial judgment');
  else if(!leafInfo.leaf)flags.push(leafInfo.tie?'multiple tertiary labels match':'no supported tertiary leaf');
  if(/\band\b|\/| plus |two .*reports|separate|also reports/i.test(e.title))flags.push('possibly multiple subjects');
  return {...e,rootId:path?.slice(0,2)??null,root:a?.root??null,subcategoryId:path,
    subcategory:a?.subcategory??null,leafIndex:leafInfo.index,leaf:leafInfo.leaf,
    confidence:reportReview?'report-level reviewed':reviewedPath?'headline reviewed':!path?'unplaced':a.score>=13&&!ambiguous?'strong rule match':a.score>=8&&!ambiguous?'screened candidate':'manual review needed',
    titleAdjudicated:Boolean(reviewedPath),reportReviewed:Boolean(reportReview),classificationBasis:reportReview?'headline and report read':reviewedPath?'headline reviewed, leaf lexically screened':'keyword screening',
    proposedLeaf:reportReview?.proposedLeaf??null,holdReason:reportReview?.holdReason??null,
    reviewFlags:flags,alternativeCandidates:candidates.slice(1,4),leadingCandidate:a??null,leafCandidates:leafInfo.all,
    curatedCollisions:pinConflicts.get(e.num)??null};
});
const flatLeaves=taxonomy.flatMap(c=>c.subs.flatMap(s=>s.leaves.map((name,i)=>({rootId:c.id,root:c.name,subId:s.id,subcategory:s.name,index:i+1,leaf:name,
  matched:mapped.filter(e=>e.subcategoryId===s.id&&e.leafIndex===i+1).length,
  candidates:mapped.filter(e=>e.subcategoryId===s.id&&e.leafIndex===i+1).slice(0,4).map(e=>e.id)}))));
const summary={total:entries.length,roots:taxonomy.length,subcategories:taxonomy.reduce((a,c)=>a+c.subs.length,0),tertiaries:flatLeaves.length,
  originalSubcategories:101,originalTertiaries:320,
  subPlaced:mapped.filter(x=>x.subcategoryId).length,leafPlaced:mapped.filter(x=>x.leaf).length,
  reportReviewed:mapped.filter(x=>x.reportReviewed).length,
  reviewedExistingTertiary:mapped.filter(x=>x.reportReviewed&&x.leaf).length,
  reviewedProposedTertiary:mapped.filter(x=>x.proposedLeaf).length,
  heldTertiary:mapped.filter(x=>x.holdReason).length,
  proposals:[...proposedAddGroups.values()].map(g=>({...g,count:g.ids.length})).sort((a,b)=>b.count-a.count||a.path.localeCompare(b.path)),
  proposedLabelsWithMultipleExamples:[...proposedAddGroups.values()].filter(g=>g.ids.length>=2).length,
  proposedLabelsWithSingleExample:[...proposedAddGroups.values()].filter(g=>g.ids.length===1).length,
  strongSub:mapped.filter(x=>x.confidence==='strong rule match').length,
  titleAdjudicated:mapped.filter(x=>x.titleAdjudicated).length,
  reviewFlagged:mapped.filter(x=>x.reviewFlags.length).length,
  occupiedRoots:new Set(mapped.map(x=>x.rootId).filter(Boolean)).size,
  occupiedSubs:new Set(mapped.map(x=>x.subcategoryId).filter(Boolean)).size,
  occupiedLeaves:flatLeaves.filter(x=>x.matched).length,
  ambiguousSub:mapped.filter(x=>x.reviewFlags.includes('multiple plausible subcategories')).length,
  manualCollisions:pinConflicts.size,
  countsByRoot:taxonomy.map(c=>({id:c.id,name:c.name,count:mapped.filter(e=>e.rootId===c.id).length,leafCount:mapped.filter(e=>e.rootId===c.id&&e.leaf).length,
   occupiedSub:new Set(mapped.filter(e=>e.rootId===c.id).map(e=>e.subcategoryId)).size,subTotal:c.subs.length,
   occupiedTertiary:flatLeaves.filter(l=>l.rootId===c.id&&l.matched).length,tertiaryTotal:flatLeaves.filter(l=>l.rootId===c.id).length}))};
const csvEscape=x=>`"${String(x??'').replaceAll('"','""')}"`;
const csvCols=['id','date','title','rootId','root','subcategoryId','subcategory','leafIndex','leaf','proposedLeaf','holdReason','classificationBasis','confidence','reviewFlags','alternativeCandidates','link'];
const csv=[csvCols.join(','),...mapped.map(e=>csvCols.map(k=>csvEscape(k==='reviewFlags'?e.reviewFlags.join(' | '):k==='alternativeCandidates'?e.alternativeCandidates.map(a=>a.path).join(' | '):e[k])).join(','))].join('\n')+'\n';
await fs.writeFile(base+'Historical_Newspaper_Classification_DRAFT.csv',csv);
await fs.writeFile(base+'Historical_Newspaper_Taxonomy_Audit_Data.json',JSON.stringify({summary,leaves:flatLeaves,entries:mapped},null,2)+'\n');
// Draft revision includes repeated missing categories, not every one-off label.
// Do not overwrite the original taxonomy or silently promote singleton proposals.
const proposedSchema=taxonomy.map(c=>[
  '# '+c.id+' '+c.name,
  ...c.subs.map(s=>{
    const proposals=summary.proposals.filter(p=>p.path===s.id&&p.count>=2&& !s.leaves.includes(p.leaf)).map(p=>p.leaf);
    const name=s.id==='08.03'?'Historical Artifacts & Documents':s.name;
    return name+' :: '+[...s.leaves,...proposals].join(' | ');
  })
]).flat().join('\n')+'\n';
await fs.writeFile(base+'historical_taxonomy_proposed_revision.txt',proposedSchema);
const md=[];
const add=(...lines)=>md.push(...lines);
add('# Historical newspaper discoveries — three-level classification audit',
'', '**REVISED DRAFT — NOT LOCKED.** All 1,056 newspaper reports have been individually reviewed for their primary placement at each of the three classification levels. The audit incorporates the earlier 593 report-level checks, 463 additional report-level verifications, adjudication of all 148 previously near-tied second-level routes, and cross-boundary corrections. Placement is provisional until proposed category changes are approved.',
'',`Source: \`Historical_Newspaper_Discoveries_1777-2026.md\` (left unchanged). Audit date: 2026-10-22.`,
'', '## Verified scope and review results',
'',`- **${summary.total.toLocaleString()}** unique, consecutively numbered HN records parsed (HN-001–HN-1056).`,
`- **${summary.roots}** proposed main classes; **${summary.originalSubcategories}** original second-level categories and **${summary.originalTertiaries}** original third-level labels. A provisional **05.09** landslide/ground-failure branch adds one second-level and three test labels to the revised comparison (**${summary.subcategories}** / **${summary.tertiaries}**).`,
`- **${summary.subPlaced}** entries have a *provisional* primary level-one and level-two route; **${summary.total-summary.subPlaced}** could not be routed.`,
`- **${summary.reportReviewed}** entries now have an explicit report-level adjudication; **${summary.total-summary.reportReviewed}** remain at headline-review / lexical-screening level. Of the report-reviewed entries, **${summary.reviewedExistingTertiary}** use an existing leaf, **${summary.reviewedProposedTertiary}** support a proposed leaf, and **${summary.heldTertiary}** are held for judgment.`,
`- **${summary.leafPlaced}** entries have a report-reviewed primary existing/provisional-05.09 tertiary label. **${summary.reviewedProposedTertiary}** additional entries carry proposed *new* labels, in a separate column rather than being silently counted as existing; **${summary.heldTertiary}** remain on hold.`,
`- **${summary.occupiedLeaves} / ${summary.tertiaries}** tested labels have one or more primary matches; **${summary.tertiaries-summary.occupiedLeaves}** have no matched primary placement, which **does not prove the subject is absent**.`,
`- **${summary.occupiedSubs} / ${summary.subcategories}** second-level categories received at least one provisional primary record.`,
`- **${summary.titleAdjudicated}** entries have an explicit earlier headline routing decision in addition to their report-level adjudication.`,
`- **${summary.ambiguousSub}** remaining *unadjudicated* near-tied second-level candidates; **${summary.manualCollisions}** examples had contradictory initial curated clues (not necessarily unresolved).`,
'', '**Interpretation:** These are newspaper-story subject placements, not independent certifications that sensational allegations, early casualty figures, or official claims were true. Single-story proposals remain recommendations, not approved taxonomy changes.',
'','## Proposed third-level additions supported by reviewed records','',
`**${summary.proposals.length} distinct proposed missing label candidates:** ${summary.proposedLabelsWithMultipleExamples} recur in two or more reports; ${summary.proposedLabelsWithSingleExample} currently have one reviewed example. Different articles about the same event are not independent events, so recurring story counts alone do not certify that a category is needed. The proposed-revision tree includes only repeat-supported candidates (plus the three land-movement test leaves in proposed 05.09) for discussion, not final adoption.`,
'','| Second-level path | Proposed missing third-level label | Reviewed stories | Evidence |','|---|---|---:|---|');
for(const p of summary.proposals)add(`| ${p.path} | ${p.leaf} | ${p.count} | ${p.ids.slice(0,8).join(', ')}${p.count>8?'…':''} |`);
add('','## Held individual assignments','',
...mapped.filter(e=>e.holdReason).map(e=>`- ${e.id}: ${e.title} — ${e.holdReason}`));
add('',
'','## Level-one roll-up (provisional primary subject)',
'','| Class | Entries | Level-two occupied / proposed | Level-three occupied / proposed | Assigned third-level entries |',
'|---|---:|---:|---:|---:|');
for(const r of summary.countsByRoot) add(`| ${r.id} ${r.name} | ${r.count} | ${r.occupiedSub} / ${r.subTotal} | ${r.occupiedTertiary} / ${r.tertiaryTotal} | ${r.leafCount} |`);
add('','## Structural findings before locking','',
'### Genuinely missing or insufficiently named branches (proposed additions)',
'',
'1. **Steam boilers and pressure-vessel explosions** — add a leaf within **05.05 Industrial Explosions & Workplace Disasters**, with **12 Transportation** as an optional cross-reference. This covers steamboats, a ferry and a locomotive, without shoehorning boiler ruptures into *Factory explosions*. Examples: HN-107, HN-126, HN-136, HN-138, HN-155, HN-158, HN-187, HN-201, HN-218, HN-219, HN-232, HN-283.',
'2. **Slavery, abolition and emancipation** — add a leaf within **04.01 Racial Justice & Discrimination**. Existing *Segregation*, *Lynching* and *Equality campaigns* do not accurately describe early slavery-era reporting. Examples: HN-082, HN-091; review further nineteenth-century social-rights entries before final naming.',
'3. **Electric grid failures and blackouts** — add a leaf under **06.06 Energy & Scientific Infrastructure**, preferably rename that second level to **Energy & Critical Infrastructure**. Examples: HN-655, HN-712, HN-871–873, HN-958, HN-1021. A blackout is neither *Electricity generation* nor *Research facilities*.',
'4. **Aerial expeditions, lost flights, and long-distance pioneering flights** — add a leaf under **08.05 Geographic Expeditions & Exploration**, cross-referenced to **12.03 Aviation**. Examples: HN-188, HN-454, HN-508–509. Existing leaf options cover only land, ocean and polar exploration.',
'5. **Landslides, avalanches, sinkholes and ground failures** — propose a distinct **level-two disaster branch** with separate tertiary leaves. Examples: HN-209 (sinkhole), HN-336 (Frank Slide), HN-371 (avalanche), HN-659–660 (Aberfan spoil-heap collapse). Current seismic/mine/transport folders fail to capture the common hazard mechanism.',
'6. **Disaster aftermath, rebuilding, and long-term displacement** — add a leaf to **05.08 Emergency Response** (or make recovery an independent cross-cutting topic if later growth warrants). Examples: HN-888, HN-895–896, HN-901. Immediate *Emergency relief* does not cover prolonged recovery.',
'7. **Maritime incidents that do not fit “ships lost at sea”** — make *Onboard fire/explosion* and *Ship–infrastructure collisions* explicit tertiary routes or adjust **12.02/12.07** boundaries. Examples: HN-164, HN-343, HN-998. Shipwreck, industrial blast and transit collision currently overlap.',
'8. **School / venue security responses after mass violence** — add a tertiary leaf to **04.08 Education, Equality & Social Reform** or a dedicated public-safety policy subcategory. Examples: HN-845 and HN-932. These are aftermath/policy stories, not new shootings themselves.',
'9. **Maritime sinkings resulting from attacks, rather than storms** — distinguish wartime torpedo or sabotage losses from weather-driven wrecks under **12.02**. Examples: HN-396 (*Lusitania*) and HN-518 (*Athenia*).',
'10. **Aviation incidents not involving a crash** — use an explicit safety/near-miss leaf under **12.07**. HN-997 describes a door-plug loss followed by a safe return, not an aircraft crash.',
'11. **Extrajudicial mob executions vs. lawful capital punishment and racial violence** — add a leaf to **01.07 Executions, Sentencing & Wrongful Convictions** for mob hangings/vigilantism where no racial motive is established (e.g., HN-228, HN-236, HN-245, HN-256, HN-261, HN-264, HN-281, HN-299, HN-311, HN-373); reserve **04.01** for racial or ethnicity-directed terror. The two are cross-taggable rather than interchangeable.',
'', '### Redundancy and ambiguous ownership to resolve', '',
'- **08.01 “Tombs” vs. 08.03 “… & Tombs”** — literal duplication at level two/three. Keep tomb *excavations* under 08.01; reserve 08.03 for manuscripts, inscriptions and recovered artifacts; remove “& Tombs” from the 08.03 name.',
'- **05.05 explosions vs. 12.02 shipwrecks vs. 12.07 transport accidents** — classify primary *failure mechanism* consistently and allow secondary subject tags. Transport boiler blasts and bridge strikes should not hop arbitrarily between folders.',
'- **05.08 Emergency Response vs. every underlying disaster** — rescue, evacuation and recovery are frequently phases of an earthquake, flood or mine event. Prefer a single primary hazard plus a **phase tag**, unless the response is itself the central news subject.',
'- **06.07 Scientific Experiments & Breakthroughs vs. 06.01–06.06 and 07.02** — “breakthrough” is commonly an article type or development phase, not a distinct scientific domain. Consider replacing 06.07 with a **discovery-status tag** and placing the story in its subject domain.',
'- **06.08 Scientific Controversies** — contestedness should normally be **evidence status**, not the topic. Keep a science-controversy folder only when the dispute itself is the historical event.',
'- **10.05 Journalism vs. 10.06 Media Hoaxes** — *a newspaper getting an early toll wrong* is not proof of a deliberate press hoax. Editorial/opinion, correction, preliminary count and deliberate fabrication need separate **reporting-genre/reliability tags**. Do not misfile every editorial about a war under Journalism.',
'- **13.07 Unexplained Incidents vs. 08.07 Historical Identification** — resolved/unresolved is status, not always a subject. Avoid shunting ordinary missing-aircraft cases into the paranormal root just because they remained unresolved.',
'- **04.01 racial violence vs. 02.07 wartime massacres vs. 01.01 homicide** — choose the historically central group-targeted context for primary classification and retain secondary tags for violence type.',
'- **07.05 poisoning vs. 01.01 intentional murder vs. 11.06 environmental contamination** — intentional poisoning crime, clinical toxicology, and environmental pollution must have a decision rule.',
'', '### Required non-folder metadata', '',
'Retain HN identifier, publication date, outlet, newspaper page URL, event identity, whether the article is a firsthand report / wire dispatch / editorial / advertisement, fact-status (allegation / independently corroborated / contradicted / open), and later corrections. These cannot safely be inferred from subject folders. Related articles about one event remain distinct HN entries, linked by an optional **event ID**; do not merge or deduplicate HNs just because counts change.',
'',`## Second-level coverage (all ${summary.subcategories} tested categories, including proposed 05.09)`,'',
'| Code | Main class | Subcategory | Primary entries (provisional) | Third-level matches |',
'|---|---|---|---:|---:|');
for(const c of taxonomy)for(const s of c.subs){const ss=mapped.filter(e=>e.subcategoryId===s.id);
  add(`| ${s.id} | ${c.name} | ${s.name} | ${ss.length} | ${ss.filter(e=>e.leaf).length} |`);}
add('','## Third-level occupancy inventory (original 320 plus three ground-failure test labels)','',
`The inventory below includes ${summary.originalTertiaries} original labels plus three provisional ground-failure test labels. Every record received a report-level decision. “0” means no primary match in this collection, not grounds for deletion.`,
'','| Path | Proposed third-level label | Matched records | Example HNs |',
'|---|---|---:|---|');
for(const l of flatLeaves){add(`| ${l.subId}.${l.index} | ${l.leaf} | ${l.matched} | ${l.candidates.length?l.candidates.join(', '):'—'} |`);}
add('','## Record-level audit and unresolved work','',
'The accompanying CSV contains **one row per HN** (no duplicates): HN ID, date, headline, primary root and second-level path, tertiary leaf index and name, separately proposed new tertiary leaf, held cases, review basis, confidence, competing subcategories, and original page URL. The companion JSON also retains alternative scores and the full proposed-addition inventory.',
'',`- Record-level third-level labels absent from current draft: **${summary.reviewedProposedTertiary}** proposed additions + **${summary.heldTertiary}** held = **${summary.total-summary.leafPlaced}**.`,
`- Near-tied level-two alternatives: **${summary.ambiguousSub}**.`,
`- Provisional second-level categories without a primary match: **${summary.subcategories-summary.occupiedSubs}**; existing/provisional tertiary labels without a primary match: **${summary.tertiaries-summary.occupiedLeaves}**. These are review candidates, not a deletion list.`,
'', '**Lock decision: HOLD.** All 1,056 primary three-level assignments have now received report-level scrutiny, and the prior second-level ambiguity queue is adjudicated. Remaining decisions concern repeat-supported additions, singleton subjects and held cases, structural redundancies, and any changes to the taxonomy itself. This audit has not independently fact-checked every historical claim or verified every newspaper scan against the printed page.',
'');
await fs.writeFile(base+'Historical_Newspaper_Taxonomy_Audit_DRAFT.md',md.join('\n'));
console.log(JSON.stringify(summary,null,2));
console.log('Subcategory coverage:');
for(const c of taxonomy)for(const s of c.subs){const count=mapped.filter(e=>e.subcategoryId===s.id).length;
  if(count<3)console.log(`${s.id} ${String(count).padStart(3)} ${s.name}`);}
console.log('Examples weak/unplaced:');
console.log('Review corrections duplicates:',JSON.stringify([...reviewedDuplicates]));
console.log(mapped.filter(e=>e.confidence==='unplaced'||e.confidence==='manual review needed').slice(0,45).map(e=>`${e.id} ${e.subcategoryId??'NONE'} ${e.title} :: ${e.alternativeCandidates.map(a=>a.path).join(',')}`).join('\n'));
