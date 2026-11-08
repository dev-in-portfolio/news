# Historical Newspaper Archives — OpenCode Project Handoff

**Version:** 2.0 — source-first implementation and portable package  
**Prepared:** 2026-11-08  
**Status:** Product and implementation specification; no website has yet been built or deployed.  
**Intended implementer:** OpenCode, working from the local, extracted handoff ZIP.  
**Project owner:** Devin O’Rourke / Dark Star Consulting Group.

## 0. Read this first — operating instructions for OpenCode

You are building a public-facing historical newspaper research and discovery website from the files in this handoff. The user will give you the **absolute path to the extracted handoff directory**. Do not ask the user to attach the files to chat; read them from disk.

Your first actions must be:

1. Start with `START_HERE.md`, then verify the source directory and enumerate its files. The intended package contains **63 unchanged research files, this v2 handoff, and three packaging/support files** (`START_HERE.md`, `PACKAGE_MANIFEST.csv`, `SOURCE_CHECKSUMS.sha256`). Record any missing files before proceeding. Do not silently substitute filenames, infer absent data, or call a partial import complete.
2. Read this entire specification, both top-level final research files, the master workbook, locked taxonomy, cross-thread reconciliation, and representative research batch reports. Then inspect the remainder of the batch reports and source material systematically.
3. Verify source hashes against `SOURCE_CHECKSUMS.sha256` and produce a reproducible inventory and import/reconciliation report **before** claiming records, events, articles, screenshots, or conflicts have been imported.
4. Preserve the original source files, their names, and their contents as read-only historical evidence. Place any generated datasets, extracted media, indexes, code, and logs separately.
5. Before selecting or building the main website architecture, prove authentic article-image acquisition, article identification, crop/zoom, and lawful display through a small source-feasibility test and three complete reference stories. Then implement the full catalog. Do **not** substitute a small set of illustrative stories and label that a completed 1,056-record archive.
6. No invented newspaper clippings, synthetic historical article screenshots, fabricated citations, imaginary exact quotations, or assumed verification outcomes. If a source cannot be accessed, show a clearly labeled source link or unresolved lead.
7. Before deploying or modifying `darkstarconsultinggroup.com`, inspect the existing site/repository and ask for the deployment target and authorization if they are not already explicit. **Build and test locally first; do not publish without direction.**

All stages must produce verifiable artifacts and concrete counts. Preserve a durable progress ledger so a later OpenCode session can resume without repeating research.

**Execution discipline:** Process large source files programmatically and incrementally; do not attempt to paste the whole corpus into an LLM context window. Save outputs and checkpoint summaries after each milestone. Do not interrupt routine local progress for permission at every step, but do stop before publishing, spending money, using credentials beyond the configured workflow, changing an existing repository, or making a consequential unresolved product decision. The first working preview is a proof of concept, not a declaration of overall completion.

## 1. Vision and editorial purpose

Build a **living, interactive historical newspaper archive** of unusual, forgotten, consequential, and sometimes disputed reporting covering **1777–2026**. The central experience is seeing what newspapers actually printed and how reports evolved across time and publications.

The site must be readable to someone who knows nothing about the event, but useful to a serious researcher. It should expose source evidence rather than asking readers to trust summaries.

The initial collection contains 1,056 **HN research/source records**, not necessarily 1,056 distinct historical events. Multiple HN rows may be separate reporting stages or overlapping records of one event. Treat these as different concepts in the data model.

Editorial commitments:

- **Newspaper report** means a historical publication made a claim; it does **not** establish that claim as fact.
- Separate contemporary reporting, later scholarly/historical context, and our own analytical assessment.
- Preserve exact attribution, publication dates, dispatch dates, time zones, numerical units, uncertainty, and later revisions.
- Distinguish genuine incompatibility from evolving estimates, changed denominators, attribution disputes, metadata mistakes, and multiple stages of the same event.
- Do not frame the collection as evidence of a cover-up or suppression. Avoid sensationalist certainty; let contemporaneous material speak for itself.
- Original scanned articles are the primary visual artifact wherever legitimately available.

Possible working page title: **Historical Newspaper Archives**. The earlier design discussion also floated **Yesterday's Headlines** as a possible editorial title, but **the name is not finalized**; do not silently rename the project.

## 2. Canonical input layout and reading order

Expected relative paths once the ZIP is extracted (the archive might contain one enclosing `newspaper/` directory; discover rather than hard-code):

```text
newspaper/
  START_HERE.md
  Newspaper_Archives_OpenCode_Handoff_v2.md
  PACKAGE_MANIFEST.csv
  SOURCE_CHECKSUMS.sha256
  Historical_Newspaper_Article_Inconsistencies_2026-10-23.md
  Historical_Newspaper_Inconsistency_Screening_1056_2026-10-23.csv
  old stuff/
    [61 earlier newspaper research and working files]
```

**The `old stuff` name reflects archival organization, not that its contents are disposable.** It includes critical source-of-truth research assets, the original discoveries, the source tracker, locked classification files, batch findings, reconciliation, scripts, drafts, and prior taxonomy versions. Do not delete it or disregard its files.

The three support files are instructions and integrity records, **not additional historical evidence**. The ZIP does **not** contain a pre-acquired set of original article screenshots; acquiring and checking them is part of the implementation work. Do not show nonexistent screenshots or confuse linked original issues with cropped articles.

Key files to locate in `old stuff`:

1. `Historical_Newspaper_Discoveries_1777-2026.md` — original discoveries and seed research.
2. `Historical_Newspaper_Event_Research_Tracker_v0.1.xlsx` — master tracking workbook; preserve unchanged.
3. `Historical_Newspaper_Classification_v1_LOCKED.csv` — locked classification assignment.
4. `Historical_Newspaper_Taxonomy_v1_LOCK_RECORD.md` and `historical_taxonomy_v1_LOCKED.txt` — taxonomy and locked decisions.
5. `Historical_Newspaper_Cross_Thread_Reconciliation_2026-10-23.md` — continuity, research coverage, duplicate/reconciliation caveats.
6. `Historical_Newspaper_Event_Research_*` — batch reports documenting article finds and research status.
7. Taxonomy audit data, scripts, earlier candidate files, and review notes — provenance and import diagnostics; *not* automatic final publication truth.

**Authority and reconciliation**:

- The two top-level files are the latest **inconsistency-screening layer**, not an exhaustive replacement for the source workbook or research batches.
- Prefer the locked taxonomy over older draft/candidate taxonomy proposals, retaining links back to older decisions where useful.
- Preserve the original 1,056 HN identifiers exactly.
- Treat each prior research finding as evidence with a source pointer and review status, not as an independently verified statement merely because it appears in a report.
- The saved batch corpus was previously described as **44 reports across 43 distinct HN intervals**; HN-403–427 appears in two separate reports. Use both where they offer distinct information, but do not double-count the interval, event, or article appearances.
- The master workbook is a historical baseline and must not be silently rewritten during website generation.

## 3. Known dataset checkpoint — do not misstate it

At the October 23 research checkpoint:

| Measure | Recorded status | What it does **not** prove |
|---|---:|---|
| HN seed records | 1,056 | 1,056 distinct real-world events |
| Curated audit flags | 84 | 84 established newspaper-to-newspaper contradictions |
| Additional keyword screening leads | 105 | 105 proven discrepancies |
| Candidate record identity pairs | 140 | 140 confirmed duplicate events |
| Saved research batch files | 44 | Full text of every newspaper article was inspected |
| Distinct HN batch intervals | 43 | Exhaustive source retrieval for all records |

The 84 curated flags were categorized principally as **V=15** printed differences, **R=19** revisions/retractions, **P=11** competing accounts, **M=17** metadata/identity issues, **F=8** apparent timing/measurement differences, and **Q=14** unverified cross-article leads. These categories are not mutually exclusive in reality; prior reporting assigned one principal class per flagged HN row.

The earlier audit directly reopened original material for selected examples (notably Black Tom, the Mexico City earthquake, and Sago), but **most flagged entries still require original-article claim-by-claim review**. No website language, counter, dashboard badge, or metadata may imply that all 1,056 entries or all article pairs have been fully verified.

Create an import summary that derives fresh counts directly from the delivered files. If counts disagree with this checkpoint, retain both numbers, investigate, and report the reason.

### Seed source-link baseline

An independent inspection of the packaged 1,056-row screening CSV found **1,056 nonempty original seed URLs, 1,018 distinct URL strings**, and the following origin distribution: Indiana Historical Newspapers 905, The Guardian 94, Library of Congress 53, British Library 2, WCAX 1, and NY1 1. This reflects **seed URLs only**; the batch reports contain additional newspaper references that must also be extracted. Neither a URL nor an archive issue page proves that the article body, exact crop, accessible image, or reuse permission has been verified. Recompute these counts during import and explain deviations.

## 4. Information architecture and primary navigation

### Public primary navigation

1. **Discover** — inviting homepage, featured stories, newly researched stories, and entry points by era and theme.
2. **All Stories** — full searchable/filterable catalog; show the research status for incomplete entries.
3. **Timeline** — 1777–2026 browsing with year/decade and event-stage filtering.
4. **Categories** — the locked **13 main classifications**, **100 subcategories**, and **361 third-level categories**, displayed progressively rather than exposing a huge wall of labels.
5. **Comparisons** — substantiated newspaper-to-newspaper differences, reporting revisions, competing explanations, and openly marked unresolved leads.
6. **About the Archive / Methodology** — what the collection is, how sources are gathered, the A/B/C evidence language, limitations, corrections, contact information, and change log.

Optional discovery lenses that do not replace the canonical taxonomy: Forgotten Stories, Strange Headlines, Mistaken Identities, Developing Disasters, Competing Witnesses, Retractions, Historical Mysteries.

### Homepage

- Historical newspaper aesthetic: archival cream, charcoal/ink, restrained bronze/brass accent, readable typography, light aged-paper texture **without sacrificing contrast**.
- Prominent universal search.
- Large authentic newspaper clipping or verified archival image as featured media; no simulated document passed off as an original.
- Story cards with event title, era/date, location, category, short accessible teaser, source count when verified, and research status.
- Entry controls for time period, place, category, and comparison type.
- Live counts must have meaningful labels, e.g., **Research records indexed**, **Original scans attached**, **Reviewed article appearances**, and **Open research questions**. Derive actual numbers from the data; do not show misleading preset totals.
- Mobile-first layout; browsing must remain useful on a small screen.

### Browse/search interface

- Search by event, newspaper title, person, place, year, claim, original headline, HN ID, and where available article transcription.
- Filters: date range/decade/century, region, taxonomy, newspaper, evidence tier, source image availability, review status, discrepancy category, and historical stage.
- Sort by historical date, recently added, title, original source count, last verified date.
- Search results have stable URLs and sensible empty/loading/error states.
- Initial index must expose **all 1,056 seed HN records** or explicitly account for any import exceptions. A grouped event may represent several HN records; show the mapping and maintain access by HN ID.

### Story/event detail page

Every event page should have, as information is available:

1. Event title; location; date or date range with uncertainty; category hierarchy; related HN IDs; source/review status.
2. **At a glance:** what happened in plain English, separated from disputed details.
3. **Original newspaper gallery**, ideally the most important relevant *authentic article crops* first, each linked to a full-page view and original archive.
4. **Read/compare controls:** article scan, OCR/transcription, source citation, and an explanation in clear language.
5. **Reporting timeline** ordered by publication time/date with dispatch/issue time distinguished where known.
6. **Claims & differences**: sourced comparison of what was said, when, and by whom, with resolution status and explanation of why figures may differ.
7. Later corroborated context, clearly separated from original reporting.
8. Connections to other articles, stages, events, and HN IDs.
9. Open questions and missing-source requests; disclose what was not read or cannot be confirmed.
10. Source list, stable links, archive attribution, review history, and "last reviewed" date.

Do **not** fabricate a smooth narrative when the research only supports a headline or catalog lead. Use concise, honest fallback copy.

## 5. Original article screenshots — non-negotiable feature

The user specifically wants **screenshots/scans of the actual historical newspaper articles wherever available**. This is central to the site, not optional decoration.

**Source-first gate:** Before building the full site, perform a feasibility survey with real pages from all six seed-source origins. Give the largest origin, Indiana Historical Newspapers, especially thorough sampling across eras and page structures. Test Library of Congress and British Library archives separately; for modern editorial webpages, test source linking, attribution, and rights-safe presentation. Also test the secondary archives cited in the batch reports. Record exactly which original-image endpoints, viewers, OCR methods, and permissible download paths work today. Test at least one multi-column or multi-page article and one ambiguous article-position case. No guessed image endpoint or browser-rendered image is automatically a verified article crop.

### Article media experience

- Display a **real clipped article image** as the default visual where acquisition and permitted reuse allow it.
- Offer **View entire newspaper page**; zoom, pan, and full-screen viewer for desktop and mobile.
- Retain source resolution where possible, but generate responsive thumbnails/previews for performance.
- An article can span more than one column or page. Crops must include the full relevant text and headline, with clear continuation indicators.
- Provide article OCR/transcription beside or beneath the scan, labeled "OCR" or "Reviewed transcription" as appropriate.
- For side-by-side comparison, present original article crops concurrently; on narrow screens, use a synchronized switcher or stacked layout.
- Display newspaper title, date, edition, page, repository/archive, persistent original URL, and article position/crop bounds when known.
- Never substitute AI-generated images, fabricated archive photos, fake mastheads, or altered newspaper typography as historical evidence.

### Acquisition pipeline

For each original/article URL already present in the seed, saved batch, and final audit files:

1. Preserve the original URL verbatim in the source catalog.
2. Resolve obvious archive redirects and identify the asset type: readable page image, IIIF manifest/image service, PDF, OCR/text, HTML article, issue/collection page, or inaccessible/index-only lead.
3. Verify that the page actually corresponds to the intended **newspaper, publication date, page, and event** before associating its image with that appearance.
4. Where reuse is permitted, retrieve the authentic page image or archive-provided permitted thumbnail, retaining acquisition date, rights/terms notes, source URL, and technical provenance. Where permissions or access are unclear, use an external source viewer/thumbnail link, not an unauthorized copied image.
5. Identify the relevant article region. Store crop coordinates, original image dimensions, crop method, and confidence/reviewer status. A machine-generated crop remains **unverified** until the article boundaries are checked.
6. Keep both the full-page image and derived crop when permitted and practical. Never overwrite raw files.
7. Generate accessible alt text based on **verified metadata**, not invented content. Provide text access for screen readers.
8. Store failures with explicit reasons: inaccessible source, no scan, paywall/authentication, rights restriction, broken URL, unclear article location, image unreadable, not actually the same event, or fetch error.
9. Rate-limit archive requests and cache permitted images; do not hammer repositories or work around authentication blocks.

### Mandatory article-by-article acquisition manifest

For every discovered source reference and newspaper appearance, maintain `docs/SOURCE_ACQUISITION_MANIFEST.csv` (or an equivalently exportable validated table) with at least these fields:

`hn_ids`, `event_id`, `appearance_id`, `newspaper`, `issue_date`, `edition`, `page`, `original_url_exact`, `resolved_url`, `provider`, `source_kind`, `discovered_in_file`, `source_file_location`, `acquisition_status`, `full_page_available`, `full_page_asset_path`, `article_crop_status`, `crop_asset_path`, `crop_coordinates`, `source_dimensions`, `ocr_status`, `reuse_status`, `reuse_basis_or_url`, `source_identity_verified`, `crop_reviewed`, `reviewer_or_process`, `last_checked_at`, `failure_reason`, `next_action`.

Use explicit and distinct statuses such as `untried`, `link_checked`, `source_identity_verified`, `scan_located`, `asset_acquired`, `crop_proposed_unverified`, `crop_verified`, `ocr_unreviewed`, `text_reviewed`, `blocked_access`, `blocked_rights`, `link_broken`, `requires_human_identification`, and `no_scan_found`. A page-level image, an article crop, an OCR transcript, and a reviewed comparison must **never** share one generic “verified” state. Keep one row per real appearance/source-asset relationship; do not collapse distinct newspaper issues just because their URLs resemble each other.

Provide source-by-source and provider-by-provider totals: URLs attempted, originals verified, scans located, scans lawfully acquired, exact crops verified, OCR retrieved/reviewed, blocked, and pending. Counts must be generated from the manifest. Only describe a scan as **obtained** when its bytes are present or the source viewer is confirmed accessible, clearly distinguishing these two situations. Retain request/access dates, failures, and retry eligibility. For a publicly displayed crop, verify the full article boundaries, readable headline/body, continuations, date, publication, issue and page against the original.

### Modern article and rights distinction

An online article URL is not a scanned newspaper page. For modern copyrighted pages, use a citation and a link to the publisher (or a permitted publisher preview) unless a valid reuse basis exists; do not capture and republish complete protected articles by default. Historic archive access does not itself grant unlimited republication rights. Distinguish public-domain status, explicit permission/license, archive-specific terms, externally hosted viewer, and unresolved rights in metadata. Never bypass subscriptions or access gates.

**Important:** An `.../ocr/` URL may represent OCR text for a page rather than the image itself; locate the corresponding authentic scan through the archive's supported page-view/image mechanism. A catalog or later historical retelling is **not** an original contemporary clipping.

Example source-image checks from existing verified research:

- Black Tom, HN-403: [Morning Oregonian original OCR, July 31, 1916](https://oregonnews.uoregon.edu/lccn/sn83025138/1916-07-31/ed-1/seq-1/ocr/) and [Eugene Daily Guard original OCR, same date](https://oregonnews.uoregon.edu/lccn/sn96088107/1916-07-31/ed-1/seq-1/ocr/).
- Mexico City earthquake, HN-753: [Lawton Morning Press page](https://gateway.okhistory.org/ark:/67531/metadc2568378/m1/1/) and [Muskogee Daily Phoenix page](https://gateway.okhistory.org/ark:/67531/metadc2641966/m1/1/).
- Sago mine, HN-894: [Los Angeles Times report](https://www.latimes.com/archives/la-xpm-2006-jan-04-na-miners4-story.html) and [Washington Post report](https://www.washingtonpost.com/archive/business/technology/2006/01/04/12-found-dead-in-wva-coal-mine/0c7d2ad1-36e3-4ee9-9f33-b730fcac355f/). These are modern article URLs, not a guarantee an archival page image is available.

These examples are verification targets; do not assume every reference in the corpus has an image.

### Three reference-story vertical slices — before full site build

Create independently testable, end-to-end local pages for **Black Tom (HN-403)**, **Mexico City earthquake (HN-753)**, and **Sago mine (HN-894)**. These are technical/editorial integration tests, not a sample standing in for the full archive. Each must include genuine sources and accurate source status, original article scans/crops and full-page viewing *if actually available and reusable*, accessible source links otherwise, OCR/transcription labels, multiple reporting appearances, properly attributed claims, and a cutoff-based reporting timeline. Demonstrate desktop and mobile zoom/compare behavior and keep explicit records of unavailable material. The full site architecture must accommodate the actual successful and unsuccessful retrieval modes observed in these tests.

## 6. Data model — preserve provenance and uncertain identity

Use a normalized, explicit schema rather than a giant hand-edited HTML file. An equivalent SQL/JSON schema is acceptable if it supports the relationships, queries, evidence status, and audit trail below.

| Entity | Required fields / intent |
|---|---|
| `ResearchRecord` | Stable original HN ID, seed heading, seed date, seed URL, imported source file/row, original category labels, editorial import state |
| `Event` | Stable event ID, canonical working title, event dates/precision, place/precision, summary, status, created/updated, editorial review |
| `EventRecordLink` | Event ID ↔ one or more HN IDs, relationship/reason, confidence, reviewer; no irreversible auto-merge |
| `Publication` | Newspaper name, known variants, city/region, archive identifiers, source authority |
| `ArticleAppearance` | Stable article/appearance ID, event(s), publication, original headline, issue date, edition, page, dispatch date/time if known, first URL, evidence tier, full-text status |
| `SourceReference` | Exact URL, source kind (scan/OCR/PDF/catalog/retrospective/etc.), discovered-in file and location, access outcome/date, citation details, rights/access status |
| `ImageAsset` | Related appearance/source, original page URL, local asset or external viewer link, checksum when downloaded, image dimensions, crop geometry, status, attribution, rights/reuse basis |
| `ArticleText` | OCR/raw/transcription, source, text review status, explicit corrections, confidence; separate machine OCR from reviewed text |
| `Claim` | Statement/value, measure/unit/denominator, attributed speaker/source, article appearance, date/time, exact supporting passage/location where verified |
| `Comparison` | Related claims/appearances, type V/R/P/M/F/Q, explained/unresolved status, narrative, evidence and review pointers |
| `ReviewLog` | What was reviewed, by whom or which automated process, on what date, result, source and changed fields |
| `CoverageSearch` | Event, archive/publication queried, query and date window, search date, positive/negative result, operator or process, limitations, next follow-up |
| `SourceAcquisition` | Appearance/source URL, archive provider, page/image/OCR state, rights/reuse basis, source identity and crop verification, paths, failure and retry log |

Keep `ArticleAppearance` distinct from `Event`: one event can have many articles; one article may address several events; multiple articles may repeat syndicated text. Record the syndication relation instead of merging away the publication-specific appearance. Keep exact seed URLs even if the remote URL later breaks.

Generate immutable IDs for event/appearance/asset entities and an explicit mapping from all original HN IDs. Normalize redirects and URL variants only in a **separate canonical-link field**; never rewrite the original observed URL. Provide idempotent import/update behavior, deterministic deduplication candidates (not automatic historical merges), source-level change history, and recovery from malformed CSV/OCR/batch text. Record the version/source of any derived classification and preserve discrepancies with the locked classification for review.

### Evidence states

- `A`: Accessible/inspected original article or primary page, as justified by the underlying source report.
- `B`: Identified dated issue/headline/index or catalog lead, but article content uninspected.
- `C`: Unresolved candidate, secondary/retrospective context, or ambiguous association.
- Early batches use `P/I/N` naming. Preserve that original code, and only map to A/B/C after explicit review; do not flatten automatically.
- Also distinguish *asset acquired*, *article crop verified*, *OCR text reviewed*, *claim verified*, *comparison certified*, and *story editorially reviewed*. These are independent states, not a single boolean.

### Ongoing discovery and completeness tracking

For every event, allow repeated, logged searches across independent publications, archives, time windows and alternate headlines/people/locations. Display `coverage status`, `searched sources`, `retrieved appearances`, `unopened leads`, and `next research actions` separately. Absence of a search result is not evidence that a newspaper never covered an event. Do not call an event “exhaustively researched” or “all coverage found” without a justified, explicitly scoped search standard. Compare reports broadly even when no inconsistency was previously flagged; the archive is about **reporting history**, not only contradictions.

### Inconsistency handling

Prior audit class meanings:

- **V:** Printed counts/wordings differ. Requires same-measure attribution and date context before calling it an incompatibility.
- **R:** Reporting was corrected/retracted/revised. Show the chronology.
- **P:** Competing accusations, explanations, eyewitness accounts or editorials. Neither side is presumed true.
- **M:** Metadata/identity/date/place/catalog mismatch; may be our source-data error rather than a newspaper contradiction.
- **F:** Apparently conflicting values measure different things, moments, populations, or denominators; do not label as false reporting.
- **Q:** Potential divergence mentioned in notes but lacking original-text comparison; remains open.

All 84 curated flags, 105 additional screening leads, and 140 potential identity links must remain separate, traceable types. Never sum them into a "confirmed contradiction" count.

## 7. Reporting timeline and "what did they know then?"

An important interactive feature is a **time-controlled reporting view**:

- A visitor selects a historical cutoff date/time on an event timeline.
- Show only the articles and claims **published by that cutoff**, not the eventual outcome unless explicitly switching to a hindsight/context view.
- Changes across days/hours reveal evolving casualties, hypotheses, survivor counts, arrests, retractions, and evidence.
- Publication time, event time, issue date, wire dateline, and later archival upload date are distinct; if only day precision is known, avoid implying hour-order certainty.
- Highlight **what changed**, cite both before and after, and label unknowns.

Examples: Titanic HN-382/HN-383 are phases of the same sinking; Wall Street explosion HN-423/HN-424 are successive reporting stages; Black Tom HN-403 has different dispatch snapshots; Pulse HN-952 reports 49 victims vs. 50 fatalities including the shooter because denominators differ.

## 8. Design, accessibility, and content standards

- Authentic archival feeling without harming readability: print-inspired headings, restrained paper/ink colors, contemporary sans-serif body/navigation, responsive grids and image viewers.
- Both light and dark themes should be readable, especially body text and article transcriptions. Avoid white-on-white dropdowns or ambiguous active states.
- Keyboard navigation, focus indicators, semantic heading order, labeled controls, image descriptions, screen-reader-friendly tables, accessible zoom dialog and escape/close behavior.
- Responsive desktop, tablet and mobile layouts, with easy swipe/tap for clippings and no forced sideways scrolling for the entire page.
- Prefer original clippings as images. Any non-original illustrative photo must be clearly marked as illustration and sourced; no historical-looking AI-generated substitute.
- Accurate typography and conservative copy. Label excerpts as excerpts; don't invent text to fill OCR gaps. Keep original spelling while offering editorial notes for archaic or discriminatory wording.
- Handle graphic/discriminatory historical material with context; do not alter source scans, and do not normalize historical propaganda as fact.
- Responsive media, lazy loading, thumbnail caching, search pagination/virtualization and compressed derivatives with full-resolution link where permitted.
- Search engine metadata and stable readable URLs for public pages; no accidental indexing of private notes, credentials, or internal logs.

## 9. Functionality and content management

### Minimum launchable capabilities

- A public homepage with real archive content and clear project purpose.
- A searchable, filterable catalog accounting for all imported seed records and grouped events.
- Stable story pages using the same evidence-aware template.
- Article source listings and authentic original clipping viewer wherever available.
- Side-by-side comparisons and time-stamped reporting timeline on appropriate events.
- All 13 locked main categories navigable; deeper taxonomy levels expandable and searchable.
- Methodology/evidence/limitations page.
- Durable import and image-acquisition logs; reproducible re-import without duplicate records.

### Sustainable expansion

Design ingestion so new HN records, newspaper appearances, verified scans, corrected citations, and new comparisons can be added without rewriting every story page. A local validated content-editing flow is acceptable for initial delivery; consider a protected editorial/admin interface only if needed and approved. Public visitors must not be able to modify records or evidence state.

Prefer the user's existing GitHub/Netlify deployment ecosystem where technically appropriate. Do not introduce a new paid platform, identity provider, or database just for convenience. Inspect existing project/repo decisions before choosing a framework. For a new local OpenCode project with no established repo, use a simple maintainable stack and document it.

**Architecture baseline to decide and document:** Favor a local-first, data-driven, statically generated (or equivalently simple) searchable archive with a repeatable import/build pipeline and portable normalized data files. Use a more complex server/database only when a documented requirement demands it; do not add paid accounts, external stores, admin authentication, or unfamiliar deployment platforms by default. Maintain a separate immutable input tree, normalized generated data, acquisition/crop assets, site code, logs, and tests. Build with stable URLs, a responsive image viewer, full-text search where OCR permits, lazy-loaded media, and a clear separation between private researcher notes and publicly approved material. Write `docs/ARCHITECTURE_DECISION.md` with the chosen stack, source rationale, performance approach, risks, storage assumptions, and Netlify/GitHub compatibility. Do not modify or deploy into an existing DSCG repo until the owner selects the correct target.

**Public correction policy:** Story pages must show the most recent reviewed date and distinguish newly added evidence from corrections to prior interpretations. Provide a visible, safe correction/contact route and a versioned editorial correction/change log. Preserve the historical record and earlier published interpretations for audit without silently changing source evidence. Never expose private research notes in public builds.

## 10. Import / reconciliation implementation sequence

**Milestone 0 — Inventory and baseline**

- Match all 63 historical source files against the precomputed source hashes; record formats and sizes; identify the 2 finals vs. 61 prior files. Verify package file paths against `PACKAGE_MANIFEST.csv`.
- Verify the final CSV HN IDs/record count, original master workbook sheets and data, locked taxonomy and historic batch intervals.
- Produce `docs/IMPORT_INVENTORY.md` listing every input and status, and a machine-readable import inventory. Record any checksum mismatches without changing the originals.

**Milestone 1 — Canonical extraction**

- Extract source references from seed CSV, workbook, Markdown reports, OCR links, PDFs or scripts as appropriate.
- Extract event candidates and article appearances with source-file/line/row pointers. Retain raw text/snippets for audit.
- Normalize dates and publication names conservatively; retain original values and unresolved ambiguity.
- Identify duplicate reference URLs, repeated sources and overlapping HN rows, without collapsing independently published appearances.
- Generate structured dataset and a detailed per-record ingestion ledger for all 1,056 HN IDs.
- Establish a search coverage ledger; capture all extra source URLs in batch reports as well as the 1,056 seed links.

**Milestone 2 — Reconcile quality**

- Join curated findings to exact HN IDs; import 84 flags distinctly from 105 heuristic leads.
- Review all suggested 140 candidate identity links without auto-merging.
- Prove every HN record is either indexed or explicitly failed with a reason. Produce counts for unique events, appearances, distinct URLs, scans, leads and holds.

**Milestone 3 — Original-source feasibility and media architecture gate**

- Sample the six seed source origins and relevant secondary archives; prioritize varied Indiana historical newspaper issue pages. Record source access, identity, full-page images, OCR, article localization, crop feasibility, rights and viewer restrictions.
- Produce the first real acquisition manifest, provider-specific extraction notes, failure classifications, and initial verified/unverified asset totals.
- Prove a local image viewer using at least one authentic crop/full-page pair when available; otherwise report the blocker and demonstrate accurate linked-source fallbacks. **Do not finalize architecture before this gate.**

**Milestone 4 — Three complete reference story slices**

- Build end-to-end working pages for Black Tom, Mexico City earthquake and Sago, with authentic content and a clear media availability record for each appearance.
- Test comparison views, original/translation/OCR distinctions, cutoff-date timeline, exact citations, source identity, mobile and keyboard viewer behavior.
- Record limitations and architecture changes suggested by the real sources. These three examples do not satisfy the full-archive coverage requirement.

**Milestone 5 — Functional full-catalog website**

- Build the design system, homepage, 1,056-HN access paths, searchable catalog, stable event detail pages, locked taxonomy explorer, timelines, comparison interface and methodology/corrections pages.
- Make only source-supported descriptions and comparisons public-facing; show honest source/viewer links and research states when article screenshots are not yet available.
- Provide a local preview and test results with actual imported data, not a small hard-coded showcase dressed as the complete archive.

**Milestone 6 — Broader media acquisition and coverage expansion**

- Continue provider-specific, permitted original-page acquisition and crop QA; attach scans, links, OCR/transcriptions and derived previews through the validated manifest.
- Expand research for events beyond the initial sources using logged, reproducible search strategies. Distinguish newly located links from inspected article bodies and verified claims.
- Keep full-page context, article boundaries, link health and rights status visible; report per-provider acquisition yields and inaccessible items instead of claiming universal image coverage.

**Milestone 7 — Verification and polish**

- End-to-end test search, taxonomy, chronology, status labels, references, image zoom, OCR, mobile/keyboard access, broken images, failed links, correction history, re-import idempotence, and public/private content separation.
- Manually review multiple very early, middle and modern stories, the three reference incidents and representative blocked/no-scan cases.
- Cross-check every public counter against deterministic generated data. Save explicit results, screenshots of the local app for UI review (not invented historical images), and unresolved issues.

**Milestone 8 — Deployment handoff**

- Produce reproducible build/preview/test commands, chosen architecture rationale, documented environment needs, research/media refresh procedure, progress ledger and outstanding-issues list.
- Do not publish until the user explicitly selects the target and asks for deployment. Later potential path: `darkstarconsultinggroup.com/newspaper-archives` (not yet approved as live destination).

**Checkpoint rule:** At the end of each milestone, update `docs/PROGRESS_LEDGER.md` with counts, test commands and results, files produced, decisions, unresolved blockers and exact next action. Continue ordinary approved local work without a new permission loop. Surface the Milestone 3 feasibility findings and Milestone 4 reference-story preview prominently for user review before scaling decisions that materially affect the design or acquisition strategy.

## 11. Tests and acceptance gates

Do not label the project ready because the homepage looks finished. Run and record objective checks:

1. **Source inventory:** ZIP extraction finds 63 existing research files plus the v2 handoff and three support files; original source SHA-256 hashes match `SOURCE_CHECKSUMS.sha256`, and all source files are unmodified.
2. **Completeness:** All expected HN-001 through HN-1056 have a deterministic import outcome; missing/duplicate IDs are reported. Reconcile the baseline of 1,056 seed URLs/1,018 distinct URL strings separately from additional report-derived links.
3. **Metadata:** Seed heading/date/source URL and source filename preserved; taxonomy assignments trace to the locked files.
4. **Identity:** Related HN IDs can be linked without deleting individual records; duplicate article URLs do not create false distinct appearances.
5. **Evidence:** Any displayed direct quote or numeric comparison cites original article or explicitly states it is preliminary. No A/B/C or P/I/N status is guessed.
6. **Flag integrity:** Curated V/R/P/M/F/Q counts reconcile to the source audit, with 105 heuristic leads tracked separately.
7. **Media feasibility:** Source-provider tests and the three reference stories precede full-site architectural lock-in; findings and failures have real reproducible evidence.
8. **Media provenance:** Every displayed archival image resolves to a documented original source/permission basis and correct newspaper issue/page; a failed image never silently falls back to a fabricated clipping. Article crop boundaries and continuations were reviewed where the crop is labeled verified.
9. **Media usability:** Article crops, full-page view, zoom/pan, attribution, source link and OCR switcher work on desktop and mobile where content exists; blocked/no-scan pages have accessible, honest fallbacks.
10. **Timeline:** A time cutoff hides later claims and reports; no hindsight contamination.
11. **Search:** Filters and queries return correct HN/event/appearance results; URL states are reproducible, including empty and broken-source states.
12. **Coverage:** Every article acquisition and archival search attempt has a status; no unsupported assertion of exhaustive coverage or zero missing sources.
13. **Accessibility:** Keyboard navigation, readable contrast, dialog controls, alt text and text alternatives pass targeted checks.
14. **Performance:** Search and initial browse are responsive; enormous originals load on demand rather than blocking page display.
15. **Import reproducibility:** Re-running the full import does not duplicate events, appearances, source references, or asset records and does not rewrite originals.
16. **Build:** Tests, production build, and a local preview are successful; include actual commands and outcomes and a documented architecture decision.
17. **Corrections/publication:** Verified editorial corrections and review dates are visible and traceable; private notes are not public, and production deployment requires user authorization.

Require a final report with a table of **Implemented / Verified / Partial / Blocked**, citing the exact files or routes and tests. A missing original scan or inaccessible paper is a valid **documented limitation**, never a success counted without evidence.

## 12. Reference story acceptance scenarios

These are useful integration fixtures; keep their unresolved caveats:

- **Black Tom, HN-403:** The *Morning Oregonian* July 31 OCR reports 3 known dead and at least 5 missing; *Eugene Daily Guard* the same issue date reports 4 dead and 11–20 missing, with differing damage estimates. Explain different dispatch snapshots, do not claim deliberate deception or final toll.
- **Mexico City earthquake, HN-753:** The *Lawton Morning Press* attributes at least 170 to police/AP; *Muskogee Daily Phoenix* includes both AP's 170 and Channel 13's at least 250 in one article. Explain **attribution within the same article**, not merely a newspaper-vs-newspaper contradiction.
- **Sago mine, HN-894:** The misleading announcement of 12 survivors was corrected to 12 dead and one survivor. The *Los Angeles Times* and *Washington Post* differ in the survivor's first-name spelling. Preserve correction chronology and source-level name discrepancy.
- **Silver Bridge, HN-666:** Headline-level figures exist as B leads, but the original pages were not fully examined in the audit. The site must **not** present this as a certified article-body contradiction.
- **Pulse, HN-952:** 49 victims versus 50 total fatalities including the shooter is a denominator difference, not an invented revision.
- **Tulsa, HN-426:** Multiple tentative death counts and sharply differing framing exist, but several numbers are identified issue headlines not fully opened original text. Preserve uncertainty, provenance and harmful historical framing context.

## 13. Required development artifacts

As a minimum, deliver alongside the site:

- `README.md` — start, build, test, update, and deployment instructions.
- `docs/IMPORT_INVENTORY.md` — all input files, parsing outcomes, source counts.
- `docs/DATA_SCHEMA.md` — entities, fields, identifiers, import/provenance conventions.
- `docs/RESEARCH_METHOD.md` — evidence, contradictions, chronology, review standards.
- `docs/ARCHITECTURE_DECISION.md` — chosen stack, why, deployment suitability, and cost/infrastructure implications.
- `docs/SOURCE_ACQUISITION_MANIFEST.csv` — every source's scan/crop/OCR/access/rights/verification state and next action.
- `docs/COVERAGE_SEARCH_LEDGER.*` — sources searched by event, dates, queries, results, limitations and follow-up.
- `docs/ASSET_MANIFEST.*` — verified asset hashes, attribution, crop geometry, full-page source URL, rights and media variants.
- `docs/FEASIBILITY_REPORT.md` — provider sample outcomes, actual supported acquisition methods, failures, and the local viewer proof.
- `docs/REFERENCE_STORIES_REVIEW.md` — Black Tom, Mexico City and Sago feature/claims/media checklist with real test outcomes.
- `docs/CORRECTIONS_POLICY.md` — public corrections, review history and preserving original evidence.
- `docs/PROGRESS_LEDGER.md` — completed milestones, last successful verification, remaining tasks, blockers; updated at every meaningful checkpoint.
- Automated import validations and website tests.
- A documented source-data folder that is **not** mixed with generated output; never overwrite the ZIP's original research.

## 14. Explicit exclusions and constraints

- No mock newspaper screenshots presented as real originals.
- No invented citations, people, newspaper titles, death counts, quotes, article locations, or verification claims.
- No unsupported conclusion that all possible newspapers covering every event were found.
- No blind event deduplication, no loss of independent issue appearances, no silent removal of source rows.
- No automatic publication of preliminary leads as settled historical fact.
- No replacement of real scanned article media with generated period-looking art.
- No bypassing logins/paywalls or violating archive restrictions to gather images.
- No unrelated changes to Dark Star's existing sites, repositories, email, or other projects.
- No publication or external write until explicitly directed by the user; local building and source retrieval for the approved project are in scope.
- No grand redesign of project scope without recording the change and getting user direction.
- No invented percentage of scanned articles, no counting issue-page links as verified article crops, and no assuming an apparent original URL grants permission to republish its image or full modern article.

## 15. First OpenCode instruction to run

When the user supplies the extracted folder path, use the following as the initial OpenCode task (substitute the **actual** path exactly):

> We are building the Historical Newspaper Archives website. The extracted handoff is at `[ABSOLUTE_EXTRACTED_FOLDER_PATH]`. Start with `START_HERE.md` and read `Newspaper_Archives_OpenCode_Handoff_v2.md` in full. Verify the 63 original research files against `PACKAGE_MANIFEST.csv` and `SOURCE_CHECKSUMS.sha256`, including both final files and all 61 earlier files under `old stuff`. Import all 1,056 HN IDs with evidence/provenance, never conflating those records with unique events or treating preliminary leads as verified discrepancies. Before committing to the full website architecture, run the original-article scan feasibility gate across the real archive providers, then build complete local Black Tom, Mexico City and Sago reference stories with verified original newspaper scans/crops when available and permitted, plus honest OCR/link fallbacks. After that, build the complete searchable, taxonomy-driven catalog and expand source acquisition and story coverage. Work through Milestones 0–8, keep the source-acquisition and research-coverage ledgers, show real checkpoint counts and tests, and preserve every original file unchanged. Use the user's established GitHub/Netlify ecosystem when appropriate, but do not modify existing repos, spend money, or deploy to a live domain without explicit direction.

This document is intended to stand alone even when the original ChatGPT conversations are unavailable. It is a product and execution contract, not a claim that article retrieval, image acquisition, or site implementation has already been completed.
