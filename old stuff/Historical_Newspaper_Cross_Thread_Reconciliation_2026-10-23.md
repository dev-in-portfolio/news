# Historical Newspaper Archives — Cross-Thread Reconciliation (Checkpoint 1)

**Checkpoint date:** 23 October 2026 (America/New_York)  
**Status:** Source-ledger reconciliation underway. **Not** an exhaustive newspaper-coverage certification, and **not** a new search pass.

## Authoritative scope and preserved work

- Fixed discovery inventory: **1,056 HN source IDs**, with locked taxonomy, unchanged.
- **43 saved range-named research reports** inspected for boundaries; **42 distinct ID intervals**. One range, HN-403–427, has **two separately saved passes**.
- **Subsequent reconstruction:** `Historical_Newspaper_Event_Research_026-052_Consolidated_2026-10-23.md` was created from the unchanged master's existing *Coverage finds* and *Search log*: **27 previously searched HN IDs, 69 citations, 42 non-seed leads, 31 original research-log entries**. This is an **additional consolidation artifact**, not a new search. Counting it, the inventory contains **44 range documents covering 43 distinct intervals**, and all **1,056 IDs** now have a range document; HN-403–427 remains the one confirmed full-batch duplicate.
- Their range names cover **1,029 distinct seed IDs**: HN-001–025 plus HN-053–1056. The **27 HN-026–052** IDs lack a *separate range-named report*, but **all 27 were already researched** in the master tracker's *Search log* and have entries in *Coverage finds*. The previous checkpoint incorrectly characterized these as potentially unresearched. **Do not redo that work.**
- Specifically, HN-026–052 account for **69 Coverage finds rows: 27 baseline seed appearances and 42 additional leads/appearances**, comprising HN-026 (1 documented later-outcome newspaper report), HN-028 (1 indexed historical periodical printing, title still unverified), HN-033 (2 dated newspaper printings identified from scholarly bibliography, original pages not inspected), and HN-052 (38 separately dated newspaper printings from scholarly bibliography, original pages pending). All 27 have search-log entries; the extra leads are **not** all Grade-A inspected newspaper articles.
- The latest sequential HN-678–1056 block (379 IDs) reports **586 Grade-A + 194 Grade-B = 780** newspaper candidates. These are **only a later-block subtotal** and may differ in evidentiary meaning from early-period P/I and other reports' A/B. They are **not** the cumulative project total.
- The original master and all 43 prior research reports have been **left unchanged**.

## Confirmed duplicate research and pilot revisit

- **Accidental full-batch repetition:** HN-403–427 was researched and saved twice. A previous conversation checkpoint explicitly identified this as an accidental rerun.
- Main-name report `Historical_Newspaper_Event_Research_403-427_2026-10-23.md`: **63 A + 8 B = 71** source entries.
- Alternate report `Historical_Newspaper_Event_Research_403-427_2026-10-23(1).md`: **61 A + 3 B = 64** source entries.
- Comparing the newspaper citation links within matching HN sections, stripping only OCR/PDF presentation suffixes and LOC display query parameters when they resolve to the same issue/page: **22 entries refer to the same archive page; 49 appear only in the main-name report; 42 appear only in the alternate**. **113 distinct normalized URL candidates**, *not* 113 independently verified additional newspaper appearances.
- There is a **grade conflict for HN-426**, *Morning Tulsa Daily World*, **2 June 1921, p. 1**: main-name report gives **B**, alternate gives **A**. **Hold at B/unresolved** until article/page text is checked; do not resolve by choosing the higher label.
- **Targeted source check (23 Oct 2026):** the [Library of Congress Tulsa newspaper guide](https://guides.loc.gov/chronicling-america-tulsa-race-riots/selected-articles) explicitly identifies the June 2 *Morning Tulsa Daily World* Final Edition story `Dead Estimated at 100: City Is Quiet`, image/page 1, **column 5**. Its [LOC edition record](https://www.loc.gov/resource/sn85042345/1921-06-02/ed-1/?sp=1) confirms title, date and edition. Direct article text/page retrieval was blocked (403), so this strengthens the **issue/article identity only**, **not** the claim of direct textual inspection. **The working grade remains B**.
- The tracker records **10 pilot event packets comprising 11 HN source rows**: HN-001, 057, 168, 280, 351, 382, 383, 535, 536, 758, 759. Their later inclusion in regular range passes is a **planned follow-on to exploratory pilots**, not evidence by itself of accidental whole-batch repetition.
- Cross-seed similarities (Titanic HN-382/383, Cocoanut Grove HN-535/536, Challenger HN-758/759, and other phase/edition pairs) **must not be mistaken for accidental file duplication**. They are distinct newspaper source rows; the event identity question is separate.
- **Only one 25-row full-batch rerun is proven by report overlap.** Exact repeated web searches during maxed-out conversations cannot be enumerated from saved batch artifacts alone.

## HN-403–427 normalized URL comparison by seed

| Seed | Same page in both | Only in main-name report | Only in alternate report |
|---|---:|---:|---:|
| HN-403 | 2 | 1 | 1 |
| HN-404 | 2 | 1 | 1 |
| HN-405 | 0 | 3 | 2 |
| HN-406 | 0 | 2 | 3 |
| HN-407 | 1 | 3 | 2 |
| HN-408 | 0 | 3 | 3 |
| HN-409 | 1 | 1 | 1 |
| HN-410 | 0 | 3 | 2 |
| HN-411 | 1 | 2 | 2 |
| HN-412 | 0 | 0 | 1 |
| HN-413 | 1 | 1 | 2 |
| HN-414 | 1 | 3 | 1 |
| HN-415 | 1 | 2 | 1 |
| HN-416 | 1 | 1 | 1 |
| HN-417 | 0 | 2 | 2 |
| HN-418 | 1 | 2 | 2 |
| HN-419 | 1 | 1 | 1 |
| HN-420 | 0 | 1 | 2 |
| HN-421 | 2 | 1 | 1 |
| HN-422 | 2 | 1 | 1 |
| HN-423 | 0 | 1 | 3 |
| HN-424 | 2 | 0 | 1 |
| HN-425 | 1 | 2 | 1 |
| HN-426 | 1 | 6 | 2 |
| HN-427 | 1 | 6 | 3 |
| **Total** | **22** | **49** | **42** |

## Evidence-safe next steps

1. **Preserve both reports** and use the 113-entry URL list below as the reconciliation queue. Assess source title, issue date, article boundary, original-seed exclusion, and whether two URLs point to the same printed item. Do not simply sum old A/B counts.
2. **Resolve HN-426's grading conflict** from the actual June 2, 1921 Tulsa page; hold the disputed record at its lower grade pending inspection.
3. **HN-026–052 reconstruction completed and separately saved** (existing evidence only; no repeat search). Verify the original pages of the HN-033 and HN-052 bibliographic items before elevating their grades, and reconcile the January 12/13 `National Intelligencer` date.
4. **Audit other batch reports' source-level grade standards and cross-row repeated stories** before issuing a cumulative number of distinct publication appearances. Do not call the initial passes exhaustive.

## HN-403–427 source-link preservation inventory

**Reading this list:** `A` = report claimed inspected, `B` = report claimed indexed/partial, `—` = report did not cite that link. The grades are **unreconciled claims copied from the existing reports**, not newly certified by this checkpoint. One row is a normalized URL candidate within a **single HN seed**; separate seeds describing the same real-world incident are not merged.

| Seed | Main report | Alternate report | Source link | Reported description (truncated) |
|---|---|---|---|---|
| HN-403 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn83025138/1916-07-31/ed-1/seq-1/ocr/) |  |
| HN-403 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1916-07-31/ed-1/seq-1/ocr/) |  |
| HN-403 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn99063957/1916-08-01/ed-1/seq-1/ocr/) |  |
| HN-403 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088115/1916-07-30/ed-1/seq-4/) | 1. *Morning Register* (Eugene, OR), Jul. 30, p. 4 — very early reports, including confusion about the location and casualty count. |
| HN-404 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn83025138/1917-03-02/ed-1/seq-1/) |  |
| HN-404 | A | — | [Issue/article](https://paperspast.natlib.govt.nz/newspapers/OAM19170303.2.26) |  |
| HN-404 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/2003260226/1917-03-03/ed-1/seq-1.pdf) |  |
| HN-404 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/2006260039/1917-03-02/ed-1/seq-1/) | 2. *La Grande Evening Observer* (OR), Mar. 2, p. 1 — Mexico's response sought, embassy dispute. |
| HN-405 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/2006260039/1917-07-03/ed-1/seq-1/ocr/) |  |
| HN-405 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088415/1917-07-06/ed-1/seq-1.pdf) |  |
| HN-405 | A | — | [Issue/article](https://tile.loc.gov/storage-services/service/ndnp/mnhi/batch_mnhi_funkley_ver02/data/sn83016810/00280768054/1917090101/0619.pdf) |  |
| HN-405 | — | A | [Issue/article](https://www.loc.gov/resource/sn82014248/1917-07-04/ed-1/?sp=1&st=text) | 1. *Daily Kennebec Journal* (Augusta, ME), Jul. 4, p. 1 — early dead and damage descriptions. |
| HN-405 | — | A | [Issue/article](https://www.loc.gov/resource/sn83045395/1917-07-04/ed-1/?st=text) | 2. *La Prensa* (San Antonio, TX), Jul. 4, p. 1 — Spanish-language coverage of attacks on Black residents, with pleas for federal help. |
| HN-406 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn83025138/1917-08-24/ed-1/seq-1/) |  |
| HN-406 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1917-08-25/ed-1/seq-1/ocr/) |  |
| HN-406 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1917-08-24/ed-1/seq-1/) | 1. *Eugene Daily Guard*, Aug. 24, p. 1 — first casualty reports, soldiers' complaints about police conduct. |
| HN-406 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn88086023/1917-08-24/ed-1/seq-1/ocr/) | 2. *East Oregonian* (Pendleton, OR), Aug. 24, p. 1 — military response and contemporary accusatory framing. |
| HN-406 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn99063957/1917-08-24/ed-1/seq-1/ocr/) | 3. *Daily Capital Journal* (Salem, OR), Aug. 24, p. 1 — national dispatch with initial reporting. |
| HN-407 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1917-12-06/ed-1/seq-1/) |  |
| HN-407 | A | — | [Issue/article](https://paperspast.natlib.govt.nz/newspapers/AG19171207.2.17.3) |  |
| HN-407 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1917-12-07/ed-1/seq-1.pdf) |  |
| HN-407 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn83025138/1917-12-08/ed-1/seq-1/ocr/) |  |
| HN-407 | — | A | [Issue/article](https://www.historyworm.com/gazete/new_britain_herald/1917-12-07/1) | 1. *New Britain Herald* (CT), Dec. 7, p. 1 — changing early casualty estimates. |
| HN-407 | — | A | [Issue/article](https://paperspast.natlib.govt.nz/newspapers/OW19171212.2.93) | 3. *Otago Witness* (NZ), Dec. 12, p. 37 — international follow-ups; correctly names the Norwegian *Imo*, unlike the Indiana seed's *Ionia*. |
| HN-408 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn97071090/1917-12-11/ed-1/seq-1/) |  |
| HN-408 | A | — | [Issue/article](https://historicnewspapers.sc.edu/lccn/sn93067846/1917-12-15/ed-1/seq-4/) |  |
| HN-408 | B | — | [Issue/article](https://newspaperarchive.com/princeton-daily-democrat-dec-11-1917-p-1/) |  |
| HN-408 | — | A | [Issue/article](https://www.loc.gov/resource/sn83045293/1917-12-11/ed-1/?st=text) | 1. *Milwaukee Leader* (WI), Dec. 11, p. 1 — headline reports 13 executed and 41 life sentences. |
| HN-408 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1917-12-11/ed-1/seq-10/ocr/) | 2. *Oregon Daily Journal*, Dec. 11, p. 10 — immediate military sentencing/execution report. |
| HN-408 | — | B | [Issue/article](https://newspaperarchive.com/joplin-globe-dec-12-1917-p-1/) | 1. *Joplin Globe* (MO), Dec. 12, p. 1 listing — index headline indicates 13 soldiers hanged; whole article not inspected. |
| HN-409 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1918-07-09/ed-1/seq-1.pdf) |  |
| HN-409 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn97071090/1918-07-10/ed-1/seq-3.pdf) |  |
| HN-409 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042470/1918-07-10/ed-1/seq-1/ocr/) | 2. *Oregon Statesman*, Jul. 10, p. 1 — next-day collision coverage. |
| HN-410 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1918-10-04/ed-1/seq-1/) |  |
| HN-410 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088115/1918-10-05/ed-1/seq-6/) |  |
| HN-410 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/2003260223/1918-10-05/ed-1/seq-2.pdf) |  |
| HN-410 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088376/1918-10-04/ed-1/seq-1/) | 1. *Condon Globe* (OR), Oct. 4, p. 1 — local health officer orders influenza case reporting. |
| HN-410 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn99063957/1918-10-04/ed-1/seq-1/ocr/) | 2. *Daily Capital Journal*, Oct. 4, p. 1 — growing influenza outbreak in Pacific Coast cities and precautions. |
| HN-411 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn99063957/1918-10-14/ed-1/seq-1/) |  |
| HN-411 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn83025138/1918-10-15/ed-1/seq-5/ocr/) |  |
| HN-411 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088415/1918-10-18/ed-1/seq-4.pdf) |  |
| HN-411 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn99063957/1918-10-15/ed-1/seq-1/ocr/) | 2. *Daily Capital Journal*, Oct. 15, p. 1 — Cloquet and Moose Lake fires. |
| HN-411 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042470/1918-10-15/ed-1/seq-4/ocr/) | 3. *Oregon Statesman*, Oct. 15, p. 4 — rescue/recovery and provisional loss descriptions. |
| HN-412 | — | B | [Issue/article](https://news.hrvh.org/veridian/cgi-bin/senylrc-larc?a=d&d=jaaggbbf19181223.1.8) | 1. *Nyack Evening Journal* (NY), Dec. 23, p. 8 — indexed newspaper text mentions a Mexico City influenza estimate; full exact passage could not be inspected on this pass. |
| HN-413 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/2006260039/1919-01-15/ed-1/seq-1.pdf) |  |
| HN-413 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042470/1919-01-16/ed-1/seq-1/) |  |
| HN-413 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1919-01-16/ed-1/seq-2/ocr/) | 2. *Eugene Daily Guard*, Jan. 16, p. 2 — tank, bodies and steam-pipe hypothesis. |
| HN-413 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1919-01-16/ed-1/seq-4/ocr/) | 3. *Oregon Daily Journal*, Jan. 16, p. 4 — contemporaneous investigation into cause. |
| HN-414 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/2006260039/1919-02-07/ed-1/seq-1.pdf) |  |
| HN-414 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/2003260226/1919-02-07/ed-1/seq-1/) |  |
| HN-414 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/2006260039/1919-02-10/ed-1/seq-1/ocr/) |  |
| HN-414 | B | — | [Issue/article](https://americainclass.org/sources/becomingmodern/prosperity/text6/seattlestrike.pdf) |  |
| HN-414 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088415/1919-02-14/ed-1/seq-1/) | 2. *Sherman County Observer* (Moro, OR), Feb. 14, p. 1 — strike called off; later reprinted view. |
| HN-415 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042470/1919-07-30/ed-1/seq-1/ocr/) |  |
| HN-415 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1919-07-30/ed-1/seq-1/ocr/) |  |
| HN-415 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042470/1919-07-31/ed-1/seq-4/ocr/) |  |
| HN-415 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1919-07-30/ed-1/seq-8/ocr/) | 2. *Oregon Daily Journal*, Jul. 30, p. 8 — report of deaths amid escalating violence. |
| HN-416 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1919-08-01/ed-1/seq-1/) |  |
| HN-416 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/2006260039/1919-08-08/ed-1/seq-1/) |  |
| HN-416 | — | A | [Issue/article](https://upload.wikimedia.org/wikipedia/commons/1/15/The_Glendale_Evening_News_1919-08-01_%28IA_cgl_003835%29.pdf) | 2. *Glendale Evening News* (CA), Aug. 1, p. 1 PDF — new bulletin raising dead to 34, showing the evolving count. |
| HN-417 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1919-09-19/ed-1/seq-23/ocr/) |  |
| HN-417 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1919-09-20/ed-1/seq-1/ocr/) |  |
| HN-417 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088115/1919-09-19/ed-1/seq-1/ocr/) | 1. *Morning Register* (Eugene), Sep. 19, p. 1 — approaching strike and union plans. |
| HN-417 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1919-09-19/ed-1/seq-22/ocr/) | 2. *Oregon Daily Journal*, Sep. 19, p. 22 — financial reaction/commentary on threatened steel stoppage. |
| HN-418 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn97071090/1919-11-08/ed-1/seq-1/ocr/) |  |
| HN-418 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn83025138/1919-11-08/ed-1/seq-1/) |  |
| HN-418 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088115/1919-11-08/ed-1/seq-1/) |  |
| HN-418 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1919-11-08/ed-1/seq-1/ocr/) | 2. *Oregon Daily Journal*, Nov. 8, p. 1 — raids and federal accusations. |
| HN-418 | — | A | [Issue/article](https://tile.loc.gov/storage-services/service/ndnp/oru/batch_oru_jefferson_ver01/data/sn90066132/00295867619/1919110801/0659.pdf) | 3. *Capital Journal* (Salem), Nov. 8, p. 1 PDF — red-scare revolutionary plot claims. |
| HN-419 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn83045782/1919-11-30/ed-1/seq-1/) |  |
| HN-419 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn00063530/1919-12-06/ed-1/seq-1/ocr/) |  |
| HN-419 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1919-11-30/ed-1/seq-1/ocr/) | 2. *Oregon Daily Journal*, Nov. 30, p. 1 — indictment and election-spending allegations. |
| HN-420 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/2024240273/1920-03-26/ed-1/seq-1.pdf) |  |
| HN-420 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1920-03-20/ed-1/seq-1/ocr/) | 1. *Eugene Daily Guard*, Mar. 20, p. 1 — sentence and contemplated appeal. |
| HN-420 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1920-03-20/ed-1/seq-1/ocr/) | 2. *Oregon Daily Journal*, Mar. 20, p. 1 — verdict/sentence news. |
| HN-421 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1920-08-18/ed-1/seq-1/) |  |
| HN-421 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn97071090/1920-08-18/ed-1/seq-1/ocr/) |  |
| HN-421 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn88086023/1920-08-19/ed-1/seq-1/ocr/) |  |
| HN-421 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn88086023/1920-08-18/ed-1/seq-1/ocr/) | 2. *East Oregonian*, Aug. 18, p. 1 — Tennessee ratifies federal suffrage amendment. |
| HN-422 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088450/1920-08-26/ed-1/seq-1/) |  |
| HN-422 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1920-08-26/ed-1/seq-1/) |  |
| HN-422 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042470/1920-08-27/ed-1/seq-1/ocr/) |  |
| HN-422 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn97071090/1920-08-26/ed-1/seq-1/ocr/) | 2. *Medford Mail Tribune*, Aug. 26, p. 1 — Secretary Colby signs proclamation. |
| HN-423 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn90051770/1920-09-16/ed-1/seq-1/ocr/) |  |
| HN-423 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn97071090/1920-09-16/ed-1/seq-1/) | 1. *Medford Mail Tribune*, Sep. 16, p. 1 — explosion at Wall and Broad, early theories. |
| HN-423 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088450/1920-09-16/ed-1/seq-1/) | 2. *Albany Daily Democrat*, Sep. 16, p. 1 — chaotic first bulletin and witness descriptions. |
| HN-423 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1920-09-16/ed-1/seq-1/) | 3. *Eugene Daily Guard*, Sep. 16, p. 1 — same-day reactions and developing information. |
| HN-424 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088450/1920-09-17/ed-1/seq-1/ocr/) |  |
| HN-424 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1920-09-17/ed-1/seq-2/ocr/) |  |
| HN-424 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn88086023/1920-09-17/ed-1/seq-1/ocr/) | 2. *East Oregonian*, Sep. 17, p. 1 — bomb hypothesis reported. |
| HN-425 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn83025138/1921-05-03/ed-1/seq-1/) |  |
| HN-425 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088115/1921-05-04/ed-1/seq-4/ocr/) |  |
| HN-425 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn85042444/1921-05-20/ed-1/seq-11/ocr/) |  |
| HN-425 | — | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1921-05-03/ed-1/seq-4/) | 2. *Eugene Daily Guard*, May 3, p. 4 — original editorial response to reversal. |
| HN-426 | A | — | [Issue/article](https://historicnewspapers.sc.edu/lccn/sn93067841/1921-06-02/ed-1/seq-1/) |  |
| HN-426 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/2006260039/1921-06-02/ed-1/seq-1/ocr/) |  |
| HN-426 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn88086023/1921-06-02/ed-1/seq-1.pdf) |  |
| HN-426 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn96088107/1921-06-03/ed-1/seq-1/) |  |
| HN-426 | B | — | [Issue/article](https://www.loc.gov/resource/sn83045211/1921-06-01/ed-1/) |  |
| HN-426 | B | — | [Issue/article](https://www.loc.gov/resource/sn99063812/1921-06-01/ed-1/) |  |
| HN-426 | B | A | [Issue/article](https://www.loc.gov/resource/sn85042345/1921-06-02/ed-1/) |  |
| HN-426 | — | A | [Issue/article](https://www.loc.gov/resource/sn82014248/1921-06-02/ed-1/?sp=1&st=text) | 2. *Daily Kennebec Journal* (ME), Jun. 2, p. 1 — national dispatch and initial toll framing. |
| HN-426 | — | A | [Issue/article](https://gateway.okhistory.org/ark:/67531/metadc152335/m1/1/) | 3. *The Black Dispatch* (Oklahoma City), Jun. 3, p. 1 — contemporaneous Black press reporting describing white attacks, burning, homelessness, and relief. |
| HN-427 | A | — | [Issue/article](https://paperspast.natlib.govt.nz/newspapers/HBTRIB19210603.2.46) |  |
| HN-427 | A | A | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn83025138/1921-06-04/ed-1/seq-2/ocr/) |  |
| HN-427 | A | — | [Issue/article](https://texashistory.unt.edu/ark:/67531/metapth1875431/m1/1/) |  |
| HN-427 | A | — | [Issue/article](https://oregonnews.uoregon.edu/lccn/sn97071110/1921-06-09/ed-1/seq-2/) |  |
| HN-427 | B | — | [Issue/article](https://www.loc.gov/resource/sn83030214/1921-06-04/ed-1/?sp=4) |  |
| HN-427 | B | — | [Issue/article](https://www.loc.gov/resource/sn84024055/1921-06-11/ed-1/) |  |
| HN-427 | B | — | [Issue/article](https://www.loc.gov/resource/sn84024055/1921-06-18/ed-1/) |  |
| HN-427 | — | A | [Issue/article](https://www.loc.gov/resource/sn83045774/1921-06-03/ed-1/?st=text) | 1. *New York Herald*, Jun. 3, p. 1 — investigation/aftermath dispatch. |
| HN-427 | — | A | [Issue/article](https://gateway.okhistory.org/ark:/67531/metadc152336/m1/1/ocr/) | 3. *The Black Dispatch*, Jun. 10, p. 1 — eyewitness descriptions, confiscated property, Greenwood commerce, controversial fire ordinance, and aid appeals. |
| HN-427 | — | B | [Issue/article](https://mospace.umsystem.edu/bitstreams/01f25be2-91ab-4025-b32a-1bb32da3cfb7/download) | 1. *The Monitor* (Omaha, NE), Jun. 9, 1921, “The ‘Race War’ in Tulsa and What Caused It” — specifically attributed in a scholarly newspaper bibliography, but original art |

## Safeguards

- No deletion or overwrite of either duplicate ledger.
- No change to the locked master, identifiers or taxonomy.
- URL normalization is a **technical first deduplication**, not final citation-level matching. Different page links can still describe the same newspaper item; a single page can also contain multiple story boundaries.
- A qualified second newspaper is a distinct appearance; reprints are counted as appearances where required by the original project goal, while syndicated text is labeled and not misrepresented as independent original reporting.

