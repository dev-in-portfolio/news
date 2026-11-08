# Reference Stories Review — Milestone 4

**Project:** Historical Newspaper Archives  
**Research path:** `D:\news`  
**Site output:** `D:\news\site/`  
**Milestone:** 4 — Three complete reference story slices  
**Status:** Complete  

---

## 1. Reference stories delivered

| Story | HN ID | Event date | Location | Page |
|-------|-------|------------|----------|------|
| Black Tom ammunition depot explosion | HN-403 | July 30-31, 1916 | New York Harbor (Jersey City, NJ) | `site/stories/hn-403-black-tom.html` |
| Mexico City earthquake | HN-753 | September 20, 1985 | Mexico City, Mexico | `site/stories/hn-753-mexico-city.html` |
| Sago mine disaster | HN-894 | January 2-4, 2006 | Tallmansville, Upshur County, WV | `site/stories/hn-894-sago-mine.html` |
| Index / proof-of-concept landing | — | — | — | `site/index.html` |

---

## 2. Black Tom (HN-403) — real test outcomes

**Audit scenario (spec §12):** Morning Oregonian reports THREE known dead and at least FIVE missing; Eugene Daily Guard reports FOUR killed and ELEVEN–TWENTY missing. Oregonian $25 million loss; Eugene Guard $25–45 million range. Different dispatch snapshots, not verified final losses. Both primary issue OCRs checked this turn.

### Feature / claims / media checklist

| Item | Status | Evidence |
|------|--------|----------|
| Genuine sources cited | Verified | Morning Oregonian July 31, 1916 (Image 1); Eugene Daily Guard July 31, 1916 (Image 1) — Historic Oregon Newspapers, University of Oregon |
| Original article scans/crops | **Blocked to direct display** | OCR pages load; full-page images not embedded (rights/archive terms) — external viewer links provided |
| Full-page viewing | External link | Archive links to oregonnews.uoregon.edu page views |
| OCR/transcription labeled | Verified | Both OCR blocks labeled "machine-generated, unreviewed" |
| Multiple reporting appearances | Verified | 2 appearances (Oregonian + Eugene Guard) side-by-side |
| Properly attributed claims | Verified | Each figure attributed to its newspaper and dispatch date |
| Cutoff-based timeline | Implemented | JS toggle shows/hides later-context "hindsight" events |
| Exact citations | Verified | Source URLs preserved verbatim; archive + OCR URLs |
| Mobile/keyboard viewer behavior | Not testable server-side | External archive viewers govern their own UI; links open in new tab |
| Unavailable material recorded | Verified | Explicit note: no fabricated screenshots; OCR labeled unreviewed |

### Claims checked against source text
- Oregonian OCR: "Three are known to be dead and at least five more are missing" — matches audit.
- Oregonian OCR: "$25,000,000 LOSS DUE TO EXPLOSION" — matches audit ($25 million).
- Eugene Guard OCR: "FOUR PERSONS KILLED; ELEVEN ARE MISSING" — matches audit.
- Eugene Guard OCR: "Estimates of the property loss range from $25,000,000 to $45,000,000" — matches audit ($25–45 million).
- Oregonian dispatch dated New York, July 30 — explains next-day figure changes (per audit).

### Media availability record
- **Morning Oregonian:** source_identity_verified = true; article_crop_status = untried (OCR text available, full page via external link); reuse_status = rights_unresolved.
- **Eugene Daily Guard:** source_identity_verified = true; article_crop_status = untried; reuse_status = rights_unresolved.
- **Archive access:** oregonnews.uoregon.edu loads (200 OK) — differs from blocked newspapers.library.in.gov (different Veridian instance).

---

## 3. Mexico City earthquake (HN-753) — real test outcomes

**Audit scenario (spec §12):** Lawton Morning Press attributes at least 170 to police/AP; Muskogee Daily Phoenix attributes at least 250 to Channel 13 and separately prints AP's at-least-170 in the same article. Both original Oklahoma OCR pages checked. Competing estimates within one newspaper, not merely different papers.

### Feature / claims / media checklist

| Item | Status | Evidence |
|------|--------|----------|
| Genuine sources cited | Verified (audit-reported) | Lawton Morning Press; Muskogee Daily Phoenix — Oklahoma Historical Society Gateway |
| Original article scans/crops | **Blocked** | gateway.okhistory.org returns bot-validation interstitial ("Validating your request...") — automated fetch blocked |
| Full-page viewing | External link only | Archive links provided with "may require manual/browser access" warning |
| OCR/transcription labeled | Not available | OCR not retrievable this session |
| Multiple reporting appearances | Verified (audit-reported) | Lawton Morning Press + Muskogee Daily Phoenix |
| Properly attributed claims | Verified | Each figure attributed to police/AP / Channel 13 within the Muskogee article |
| Cutoff-based timeline | Implemented | JS toggle shows/hides later-context events |
| Exact citations | Verified | Seed URLs + audit register URLs preserved verbatim |
| Unavailable material recorded | Verified | Honest "blocked_access" fallback; no fabricated scans |

### Claims checked against source text
- Lawton Morning Press: police estimated at least 170 dead (audit-reported; page blocked this session).
- Muskogee Daily Phoenix: at least 250 (Channel 13) AND at least 170 (AP) in same article (audit-reported; page blocked this session).
- Indiana seed: approximately 230.
- Event-boundary caution: HN-753 seed article combines Mexico City earthquake with unrelated Mexican hurricane — treated as separate event identities, not merged (per audit).

### Media availability record
- **Lawton Morning Press:** acquisition_status = blocked_access (bot validation); source_identity_verified = false (could not re-verify page this session); reuse_status = rights_unresolved.
- **Muskogee Daily Phoenix:** acquisition_status = blocked_access; same handling.
- **Archive access:** gateway.okhistory.org blocked by Distil/PerimeterX-style bot validation — documented limitation, not concealed.

---

## 4. Sago mine disaster (HN-894) — real test outcomes

**Audit scenario (spec §12):** "12 survivors" reversed to 12 dead and one survivor; LA Times calls survivor Ronald McCloy; Washington Post identifies Randal McCloy. These are two separate corrections; second is a given-name error. Correction chronology preserved.

### Feature / claims / media checklist

| Item | Status | Evidence |
|------|--------|----------|
| Genuine sources cited | Verified (LA Times) / audit-reported (WaPo) | LA Times Jan 4, 2006 (opened and read); Washington Post Jan 4, 2006 (fetch timeout) |
| Original article scans/crops | N/A | Modern editorial webpages, not scanned pages |
| Full-page viewing | N/A | Publisher links provided |
| OCR/transcription labeled | N/A | Modern HTML article, not OCR |
| Multiple reporting appearances | Verified | LA Times + Washington Post |
| Properly attributed claims | Verified | Each claim attributed to publication and reporter |
| Cutoff-based timeline | Implemented | JS toggle shows/hides later-context events |
| Exact citations | Verified | Seed URLs + archive URLs preserved verbatim |
| Unavailable material recorded | Verified | Washington Post fetch timeout recorded as inaccessible with external link fallback |

### Claims checked against source text
- **LA Times** ("First Joyful News, Then a Tragedy About Miners," Jonathan Peterson & Stephen Braun, Jan 4, 2006 — article opened and read):
  - 12 miners reported alive, then reversed; only one (Ronald McCloy) transported alive.
  - ICG president Ben Hatfield attributed error to lack of communication from rescue command center.
  - 13th miner's body found earlier.
- **Washington Post:** fetch timed out twice — recorded as inaccessible. Per audit register: survivor spelled Randal McCloy; rescue team's report mistakenly interpreted as 12 survivors. Carried as audit-reported, not directly re-checked.
- Correction chronology: false "12 survivors" → reversal to 12 dead/1 survivor → name discrepancy (Ronald vs Randal).

### Media availability record
- **Los Angeles Times:** acquisition_status = source_identity_verified (200 OK, article text loaded); reuse_status = rights_unresolved_modern_copyright (modern copyrighted article — citation + link only, no full-text republication).
- **Washington Post:** acquisition_status = blocked_access (fetch timeout); source_identity_verified = false; external link fallback provided.

---

## 5. Cross-story findings affecting architecture

1. **Indiana/LOC blocked, Oregon loads:** The Black Tom sources live on oregonnews.uoregon.edu (University of Oregon Historic Oregon Newspapers), which loads (200 OK) — unlike newspapers.library.in.gov and loc.gov, which return 403. This means the "six seed origins" feasibility result is provider-specific, not uniform; direct image acquisition may work for some Indiana-adjacent providers but not others.

2. **Modern editorial sources load but are rights-restricted:** LA Times (Sago) and Guardian/WCAX/NY1 (feasibility gate) load article text, but are modern copyrighted pages. Per spec §3.7: citation + link to publisher only; no full-text republication. The site design must treat modern article URLs as citations, not scanned-page assets.

3. **Bot validation is a real blocker:** gateway.okhistory.org (Oklahoma Historical Society) blocks automated fetch via Distil/PerimeterX-style interstitial. The site must degrade gracefully to external links with honest "may require manual/browser access" warnings.

4. **Image viewer proof deferred:** The spec requires proving a local image viewer with at least one authentic crop/full-page pair before finalizing architecture. No authentic scanned page image bytes were acquired this session (Indiana/LOC/Oklahoma all blocked; modern sources aren't scans). Architecture remains deliberately unfinalized pending either (a) a manual/browser-based acquisition session or (b) user direction to proceed with external-link-only media delivery.

5. **Error tolerance built in:** All three reference stories render correctly even when a source is inaccessible — each shows honest fallback state, never fabricated content.

---

## 6. Milestone 4 acceptance

- [x] End-to-end working pages for Black Tom (HN-403), Mexico City earthquake (HN-753), Sago mine (HN-894)
- [x] Genuine sources and accurate source status for each appearance
- [x] Original article scans/crops where actually available and reusable; honest source links otherwise
- [x] OCR/transcription labels (machine OCR labeled unreviewed)
- [x] Multiple reporting appearances per story
- [x] Properly attributed claims (each figure attributed to newspaper + date)
- [x] Cutoff-based reporting timeline (JS toggle, hindsight separated)
- [x] Exact citations (source URLs preserved verbatim)
- [x] Desktop/mobile-responsive layout (single-column below 640px)
- [x] Explicit records of unavailable material (blocked fallsbacks documented)
- [x] `docs/REFERENCE_STORIES_REVIEW.md` — this file, with real test outcomes
- [x] Limitation/architecture-change notes recorded (see §5 above)

---

## 7. Next action

These three reference stories do **not** satisfy the full-archive coverage requirement. Per spec §10, after the Milestone 3 feasibility gate findings are reviewed, proceed to **Milestone 5 — Functional full-catalog website**: design system, homepage, 1,056-HN access paths, searchable catalog, stable event detail pages, locked taxonomy explorer, timelines, comparison interface, and methodology/corrections pages — using only source-supported descriptions and honest source/viewer links.

**Deployment remains unauthorized** — no publication until explicitly directed by the user.
