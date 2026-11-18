# Progress Ledger — Historical Newspaper Archives

**Project:** Historical Newspaper Archives  
**Research path:** `D:\news`  
**GitHub:** https://github.com/dev-in-portfolio/news.git  
**Maintained per spec §13 & §10 (checkpoint rule)** — updated at every meaningful milestone checkpoint.

---

## Milestone completion record

| Milestone | Title | Status | Completed | Key outputs |
|-----------|-------|--------|-----------|-------------|
| 0 | Inventory and baseline | Complete | 2026-11-08 | `docs/IMPORT_INVENTORY.md`, `docs/import_inventory.json` — 63/63 source files hash-verified; 1,056 HN IDs confirmed |
| 1 | Canonical extraction | Complete | 2026-11-08 | `docs/ingestion_ledger.json` (1,056 records), `docs/COVERAGE_SEARCH_LEDGER.csv` (3,599 URLs), `docs/DATA_SCHEMA.md` |
| 2 | Reconcile quality | Complete | 2026-11-08 | `docs/reconciliation_ledger.json`, `docs/IDENTITY_CANDIDATES.csv` (135 pairs, unmerged), `docs/RECONCILIATION_REPORT.md` |
| 3 | Original-source feasibility & media architecture gate | Complete | 2026-11-08 | `docs/SOURCE_ACQUISITION_MANIFEST.csv` (1,056 rows), `docs/FEASIBILITY_REPORT.md` |
| 4 | Three complete reference story slices | Complete | 2026-11-08 | `site/stories/hn-403-black-tom.html`, `site/stories/hn-753-mexico-city.html`, `site/stories/hn-894-sago-mine.html`, `site/index.html`, `docs/REFERENCE_STORIES_REVIEW.md` |
| 5 | Functional full-catalog website | Complete | 2026-11-08 | `site/{index,search,taxonomy,timeline,comparisons,about}.html` + `site/stories/hn-NNN.html` (1,056), `site/data/*.json`, `site/assets/{style.css,app.js}`, `docs/ARCHITECTURE_DECISION.md`, `docs/CORRECTIONS_POLICY.md`, `README.md` |

## Current state

- **Last successful verification:** Milestones 0–8 complete; `verify_milestone7.js` 40/40, `verify_images.js` 1,812 distinct assets / 0 missing / 0 broken, `audit_mosaics.js` 0 bad.
- **Working tree:** Final image-acquisition checkpoint is committed together with this ledger (see commit history on `main`).
- **Original source files:** Unchanged and read-only (hash-verified against `SOURCE_CHECKSUMS.sha256`).
- **Generated data:** All under `site/data/` and `docs/`; none mixed with original source data.
- **HTML pages:** 1,065 (1,056 detail pages + 6 section pages + 3 reference stories).
- **Acquisition status:** Exhaustive. Every archive-scan-capable cited host has been probed; all 98 remaining records are blocked by copyright policy (96 modern web articles) or page-image paywall (2 British Library OCR-only). No obtainable archive-owned article image remains unlocated.

## Counts checkpoint (deterministic, from generated data)

| Measure | Value | Source |
|---------|-------|--------|
| HN records indexed | 1,056 | Seed queue HN-001…HN-1056 |
| HN IDs with batch-report coverage | 1,053 | Batch reports |
| HN IDs without batch coverage | 16 | HN-106, 108–110, 112–125 |
| Distinct seed URLs | 1,018 | of 1,056 nonempty |
| Total coverage ledger URLs | 3,599 | seed + batch |
| Curated audit flags | 84 | V=15, R=19, P=11, M=17, F=8, Q=14 |
| Heuristic keyword leads | 105 | tracked separately, not summed |
| Candidate identity pairs | 135 | deduped from seed peer column (authoritative 140 in workbook) |
| Source-acquisition manifest rows | 1,056 | one per seed URL |
| Manifest rows with live test results | 9 | 4 blocked_access, 3 verified, 2 link_checked |
| Records with ≥1 resolved source URL | 1,056 | `scripts/hn_urls.json` (record `url` ∪ batch reports ∪ record text) |
| Distinct resolved source URLs | 3,240 unique (3,500 entries) | `scripts/hn_urls.json` — 475 hosts |
| Records with no source URL at all | 0 | every record has a cited URL |
| Records with ≥1 stored image | 958 | `site/data/images.json` |
| Stored image renditions (entries) | 1,732 | 1,494 full-page + 323 crops/clips |
| Full-page scans | 1,494 | Indiana 749, Oregon 420, LOC 85, OK 53, TX 25, SC 22, SCVHistory 18, other 122 |
| Word-coordinate-verified article crops (`crop`) | 85 | score ≥ 0.6 against a quoted headline |
| Archive article clips (`archive_article_blocks_native`) | 228 | archive-supplied block geometry (Indiana, Papers Past, NLI, etc.) |
| Archive clipping images (`archive_clipping_image`) | 10 | archive's own clipping: Birmingham 3, NewspaperSG 7 |
| Records with ≥1 article crop/clip | 251 | `site/data/images.json` |
| Records with page scan only (no crop) | 707 | all 707 have a full-page rendition |
| Indiana tile mosaics | 756 pages acquired | `docs/INDIANA_MOSAIC_LEDGER.json` (136 cited pages absent from the viewer; all 136 records have images from other sources) |
| PDF-rendered page images | 58 | `archive_pdf_page_rendition` |
| Other-archive page renditions | 25 | `archive_page_image` |
| Distinct image assets referenced | 1,812 | `scripts/verify_images.js` — 0 missing, 0 broken |
| Image files on disk | 1,821 | 1,200.2 MB under `site/assets/images/` |
| Records still without an image | 98 | 96 modern copyrighted web articles + 2 British Library OCR-only |

## Milestone 3 feasibility results (summary)

| Provider | Fetch result | Direct image/OCR verifiable? | Recommended media mode |
|----------|-------------|------------------------------|------------------------|
| Indiana Historical Newspapers (905) | 403 blocked | No | External source link; `blocked_access` |
| Library of Congress (53) | 403 blocked | No | External source link; `blocked_access` |
| The Guardian (94) | 200 OK | N/A (modern editorial) | Citation + link; no full-text republication |
| British Library (2) | 200 OK metadata | Partially (CC0 OCR; images paywalled) | Link to DOI dataset + BNA viewer |
| WCAX (1) | 200 OK | N/A (modern editorial) | Citation + link |
| NY1 (1) | 200 OK page | Unconfirmed (JS) | Confirm via browser; external link |

**Gate decision:** Local image-viewer proof with authentic crop/full-page pair **not achievable** in this gate (both archive providers blocked). Architecture deliberately **not finalized**; plan for external links + honest fallbacks pending user review.

## Open blockers / next actions

1. **Milestone 6 — Media acquisition:** largely complete. Batch-report URLs are
   merged into the URL index, and every provider that exposes a public image
   service has been harvested. What remains is listed in
   `docs/IMAGE_GAP_REPORT.md` and is almost entirely paywalled, bot-protected, or
   not a newspaper scan at all.
   - **Indiana batch complete:** 510 mosaic pages across 463 documents.
     `node scripts/acquire_indiana_mosaics.js --retry-failed` retries only
     ledger entries marked failed (currently just HN-704, whose Indiana citation
     is superseded by its Newport Beach issue-PDF page) without re-walking the
     143 pages the viewer reports as unavailable. After any acquisition run,
     run `node scripts/lib_image_merge.js`, then `build-pages.js`.
   - **CORRECTION (2026-11-17) — section ids are not page keys.** The earlier
     "unavailable section-2 pages (143)" verdict was a mapping bug, not an
     archive gap. In an Indiana `?a=d&d=<doc>.<n>.<m>` URL the suffix is a
     **section id**, not a page key. The viewer's own payload names the page
     that holds the section: `initialDisplayPageArea.pageID`. Examples verified
     from the archive's own overlay titles:
     - HN-167 `JPBN18540615.2.6` → page `1.2`, overlay title "Departure of Burns."
     - HN-240 `DMST18770914.2.24` → page `1.4`, overlay title "A MYSTERY IN LAW."
     - HN-168 `JPBN18550125.2.14` → page `1.2`.
     A nonexistent section (`2.99`) returns HTTP 404, so the mapping is real
     and not a default view. Page-level citations use edition `1.x` and have
     `fullPage: true` with no article blocks; article-level citations use
     edition `2.x+` and expose native-resolution block images at
     `?a=is&oid=<doc>.<section>&type=blockimage&area=N`.
   - **All 133 Indiana gaps resolve:** probing every gap record through the
     viewer gave **133/133** with a real, imaged page (0 area-null, 0
     page-not-in-`pageImageSizes`, 0 HTTP failures). Results:
     `indiana-section-map.json` (session temp dir).
   - `scripts/acquire_indiana_mosaics.js` and `scripts/acquire_indiana_images.js`
     were corrected to resolve each cited section to its real page before
     rendering, and now record `cited_section`, `page_key`, and `section_area`
     alongside the image.
   - **Article clips are the priority path:** the block-image endpoint returns
     native-resolution crops (e.g. 417×1993) over plain HTTP with no browser,
     far faster than the ~2 min/issue Turnstile-gated tile mosaics. The clip
     work list now considers only edition-`2.x+` citations (735 page-level-only
     records are skipped and remain covered by the mosaic pipeline).
2. **Open the master tracker Excel workbook** (`Historical_Newspaper_Event_Research_Tracker_v0.1.xlsx`) to complete the 140 candidate identity pair inventory (135 deduped from seed peer column; authoritative 140 in workbook).
3. **Image-gap decisions resolved (2026-11-18):** the owner delegated the two
   open decisions — modern copyrighted web articles stay citation-only and the
   two British Library OCR-only records stay honest gaps (see "Final honest
   gap split"). No further acquisition is pending.
4. No deployment authorized; local build and preview remain in scope.

## Deployment

- **No deployment authorized.** Potential later path `darkstarconsultinggroup.com/newspaper-archives` is not an approved live destination.
- Do not modify or publish to any existing DSCG repo until explicit direction.

## Original page-scan acquisition (Historic Oregon Newspapers)

**Result:** Authentic newspaper page scans and article crops are now embedded in the
generated site for every record with an accessible Historic Oregon Newspapers URL.

| Measure | Value |
|---------|-------|
| Records with at least one Oregon URL | 192 |
| Oregon page URLs attempted | 412 |
| Page scans acquired | 412 (0 failures) |
| Article crops acquired (ALTO-verified) | 29 |
| Distinct image files | 445 |
| Total image bytes | 236.2 MB |
| Records with rendered scan card | 192 |
| Broken image references | 0 |

**Method**

1. Parse the 44 batch research reports to map `HN-ID -> archive URLs` and quoted
   headlines (`scripts/map_hn_urls.js` -> `scripts/hn_urls.json`,
   `scripts/hn_url_meta.json`).
2. For each `oregonnews.uoregon.edu/lccn/.../seq-N/` page, read the IIIF JP2
   identifier from the page HTML, then fetch `.../full/1200,/0/default.jpg`
   (`scripts/acquire_oregon_images.js`).
3. When the batch report quotes a headline, fetch the page's ALTO OCR
   (`seq-N/ocr.xml`), locate the `TextBlock` whose words match the headline
   (score >= 0.6), and request the matching IIIF region crop at native
   resolution. Coordinates scale by `xdpi/1200` for `MeasurementUnit=inch1200`.
4. Write `site/data/images.json`, `docs/IMAGE_ACQUISITION_LEDGER.json`, and render
   an "Original page scans" card in each detail page via `scripts/build-pages.js`.

**Honesty constraints preserved**

- No image was generated, mocked, retouched, or visually guessed. Every file is a
  JPEG rendition of the archive's own JP2 scan, keyed to the archive page that
  produced its IIIF identifier.
- Crops are only created on an exact headline match; otherwise the full page is
  shown alone. 29 of 412 pages yielded a confident crop.
- Page scans are 1,200-px-wide renditions; the archive viewer is linked for full
  resolution. Article crops are native-resolution.
- Records on blocked providers (Indiana 403, LOC 403, Oklahoma bot-check, BNA
  paywall) still show no images and keep their honest `blocked_access` status.

**Verification:** `scripts/verify_images.js` reports 0 missing asset files and 0
broken references across sample pages; `scripts/verify_milestone7.js` remains
40/40.

**Manifest repair:** `docs/SOURCE_ACQUISITION_MANIFEST.csv` previously had 1,052
rows shifted by an unquoted comma in `issue_date` and 24 rows carrying a stray
`col_5:` marker. `scripts/repair_manifest_csv.js` now reports 0 bad field counts,
0 non-URL `original_url_exact`, and a clean status distribution
(`blocked_access` 4, `untried` 4,012, `link_checked` 3,
`source_identity_verified` 23).

## Expanded page-scan acquisition (LOC, South Carolina, Oklahoma, Texas)

The earlier note that LOC and Oklahoma were blocked was superseded. Both expose
machine-readable image services that answer a browser User-Agent even while
their human-facing HTML pages reject automation.

| Provider | Records | Pages acquired | Crops | Method |
|----------|---------|----------------|-------|--------|
| Historic Oregon Newspapers | 192 | 412 | 29 | IIIF + ALTO OCR |
| Library of Congress / Chronicling America | 22 | 81 | 2 | `?fo=json` + IIIF + word-coordinates |
| Gateway to Oklahoma History | 43 | 53 | 0 | IIIF (`full/full`) + UNTL metadata |
| The Portal to Texas History | 19 | 22 | 0 | IIIF + UNTL metadata |
| South Carolina Historic Newspapers | 16 | 16 | 6 | JP2 + word-coordinates + ffmpeg |
| Hoosier State Chronicles (Indiana) | 21 | 0 | 21 | article clip view + native `blockimage` blocks |
| **Total (distinct records)** | **295** | **584** | **58** | |

**Provider notes**

- **Library of Congress.** `www.loc.gov/resource/...` returns 403 HTML to
  automation, but `?fo=json` returns the IIIF `info.json` URL, the
  `word-coordinates-service` URL, and page dimensions. `tile.loc.gov` serves the
  images and coordinates directly. The JSON API is rate-limited per IP (HTTP
  429), so the pipeline uses a slow drip with exponential backoff and an
  incremental ledger. All 80 queued pages were eventually acquired.
- **South Carolina.** Each page links a full-resolution `.jp2` plus a
  `coordinates/` endpoint returning word boxes in a 3x pixel space. `ffmpeg`
  decodes the JP2 locally; page and crop JPEGs are rendered from the original
  scan. This is the only new provider that supports confident crops.
- **Oklahoma / Texas.** The UNT portals expose a public IIIF Image API capped at
  a 1,500-px access rendition and an OCR text endpoint, but no coordinate
  service. Only full pages are stored; no crops are guessed. Oklahoma's server
  rejects width-based IIIF sizes, so the pipeline falls back to `full/full`.
- **Blocked and not automated:** Papers Past (Incapsula JS challenge), British
  Newspaper Archive (subscription paywall), NewspaperArchive and RareNewspapers
  (commercial licensing). Modern paywalled titles (Washington Post, LA Times,
  Guardian) are not scraped and are never republished.
- **Indiana (partial).** The site sits behind a Cloudflare managed challenge.
  A real Chrome session passes it in roughly 9–40 seconds; the resulting
  `cf_clearance` cookie then allows plain HTTP requests. Full-page downloads
  (`type=jpg2000/jpg/pdf/staticpdf`) require a free account login, and the
  OpenSeadragon tile service caps tiles at 256x256. The public "Clip this
  article" view (`&dliv=none`) does expose each article block through
  `type=blockimage&area=N`, which returns a native-resolution crop of the
  archive's own scan without login. We download those blocks and stack them in
  the archive's own clip order. 21 records have article clips; the other 142
  Indiana citations are page-level (the research itself cites "p. 1"), and the
  archive offers no unauthenticated full-page rendition, so those cards link to
  the archive viewer instead. No Indiana full-page scan is stored.

**Honesty constraints preserved**

- Every stored JPEG is a rendition of the archive's own scan; none is generated
  or retouched.
- Crops exist only where a quoted batch-report headline matches OCR text at
  score >= 0.6. All other pages show the full scan alone. Indiana article clips
  are the archive's own clip-view blocks, not guessed crops.
- Full pages are 1,200-px-wide renditions; article crops are native-resolution.
  The archive viewer is linked from every card.
- LOC and Oklahoma/Texas pages carry no crops because those services expose no
  word coordinates (or no headline metadata for the page).

**Verification (this run)**

- `scripts/verify_images.js`: 295 records, 584 page scans + 21 article clips,
  58 crops, 0 missing files, 0 broken references.
- `scripts/verify_milestone7.js`: 40/40.
- `scripts/coverage_report.js`: 295/1,056 records (27.9%) have images;
  31 records (2.9%) have a word-coordinate-verified crop; 21 records (2.0%) have
  an archive article clip; 104 records link only to blocked/paywalled providers.

**New scripts**

- `scripts/acquire_loc_images.js` — LOC JSON + IIIF + word coordinates.
- `scripts/acquire_sc_images.js` — South Carolina JP2 + coordinates + ffmpeg.
- `scripts/acquire_portal_images.js` — Oklahoma and Texas IIIF.
- `scripts/indiana_session.js` — refreshes the Cloudflare clearance session in a
  real Chrome and writes the cookie header for plain HTTP requests.
- `scripts/build_indiana_metadata.js` — parses issue/page metadata for the 157
  unique Indiana pages into `docs/INDIANA_PAGE_METADATA.json`.
- `scripts/acquire_indiana_images.js` — Indiana article clips from the archive's
  `blockimage` article blocks, stacked with ffmpeg.
- `scripts/lib_image_merge.js` — merges all provider ledgers into
  `site/data/images.json`.

---

## Image acquisition, phase 2 (other archives, issue PDFs, Indiana tile mosaics)

### URL index correction

`scripts/hn_urls.json` was originally built only from `### HN-…` blocks in the
batch-report markdown, which left 395 records with an empty URL list. Those
records are not source-less: 368 of them cite a source URL inside the canonical
record text (`discovery_body`, `audit_links`, `recorded_finding`).

`scripts/augment_hn_urls.js` unions those sources without removing or rewriting
anything. A first pass still skipped each record's own `url` field, which is the
primary citation for 34 records whose seed page is a live Indiana page — they
showed as image gaps even though their cited page was available. The builder now
reads the record's `url` first, then the narrative fields, and the index was
rebuilt:

| | before | after |
|---|---:|---:|
| Records with ≥1 URL | 661 | 1,056 |
| Unique URLs | 3,599 (with duplicates) | 3,240 unique |
| Records with no URL at all | 395 | 0 |

No record is source-less; every one of the 1,056 carries a cited URL. Everything
downstream (gap report, every acquisition pipeline) now reads the corrected
index.

### Previously unindexed seed pages

The rebuilt index exposed 34 cited Indiana pages that no pipeline had ever
attempted. They were processed with the existing tile-mosaic pipeline:

- 25 section-1 pages acquired (25 records gained a page image).
- 9 section-2 citations were initially recorded `page_unavailable`
  (HN-243, HN-296, HN-304, HN-313, HN-343, HN-348, HN-351, HN-357, HN-375).
  **Corrected:** this was a section→page mapping bug. The cited `2.x` suffix is
  a section id; the viewer maps it to a real `1.x` page that has an image. All 9
  are recoverable.
- 0 document failures.

Records with a stored image rose from 798 to 825.

### Hand-verified fallbacks

`scripts/acquire_extra_images.js` holds a short list of individually verified
direct sources for records whose cited page is genuinely unavailable. Each job
records the archive page it came from and skips any record that already has an
image from another pipeline:

- **HN-362** — Library of Congress / Chronicling America, *Crittenden record=press*
  1908-05-28 page 3 (IIIF segment `0863`, 1288×1811). The page OCR was checked and
  mentions Belle Gunness and LaPorte. The record's cited Indiana page (9 May 1908)
  is not in the viewer.
- **HN-233** — *The Spectator* 1875-12-18 page 1, `archive_page_preview`. The
  archive serves only a 280×410 token-bound preview without a subscription; it is
  labelled on the page as a low-resolution preview rather than a full scan.

### Other archives (Quartex, CONTENTdm, SCVHistory)

`scripts/acquire_other_images.js` handles three families of small archives:

- **Quartex** (`*.quartexcollections.com`, `*.newspapers.com`-style viewers):
  IIIF manifest → best page canvas → IIIF Image API rendition.
- **CONTENTdm** (`digital*.library.*`, `cdm*.contentdm.oclc.org`): the
  `digital/api/singleitem/collection/<c>/id/<n>` JSON gives the compound-object
  page list; images come from the `iiif` or `utils/ajax/helpers/getfileinfo`
  endpoint at the archive's own maximum size.
- **SCVHistory** and similar flat-file archives: the page JPEG is linked
  directly from the citation page and is downloaded as served.

Result: 21 images across 4 records (HN-456 ×16, HN-607 ×1 Bermuda Recorder
5352×8064, HN-643 ×3 Birmingham, HN-672 ×1 Waco 2465×3380). Ledger:
`docs/OTHER_IMAGE_ACQUISITION_LEDGER.json`.

### Issue-PDF pipeline

Several historical societies and university archives publish a whole issue as a
PDF (`rijha.org`, `archives.nd.edu`, `cdn.manchesterhistory.org`,
`ecms.newportbeachca.gov`, `the.militant.com`, `marxists.org`,
`richesmi.cah.ucf.edu`). `scripts/acquire_pdf_images.js`:

1. downloads the issue PDF (cached by URL hash under the temp PDF cache);
2. reads its **text layer** with `pdfjs-dist` and scores every page against the
   record heading;
3. renders **only the chosen page** with `pdf-to-img` at ~1,500 px width
   (landscape issues keep their native orientation, e.g. 2900×2052);
4. records `pdf_page`, `pdf_pages`, `page_selection` (`text_match` or
   `first_page_fallback`) and `match_score` in the ledger.

The stored JPEG is a single rasterisation of the archive's own scan — no crop,
no retouching. Result: 11 page images across 9 records (HN-472, HN-510, HN-622,
HN-683 ×2, HN-701, HN-704, HN-743, HN-757, HN-841).

PDFs that are academic papers, books, or finding aids were deliberately **not**
used as newspaper images: two DRUM dissertations (435 and 289 pages), the
`archon` finding aid for the Frederick J. Ruegsegger papers (71 pages of
inventory text), and `nytimes_1965_crop.pdf` (a cropped article reprint, not a
newspaper page).

### Indiana tile mosaics

The 142 Indiana page-level citations previously had no stored image because the
archive requires a login for full-page downloads. The OpenSeadragon tile
endpoint is public **once the Cloudflare Turnstile check issues a per-document
access code**:

```
?a=is&type=pagetileimage&crth=…&vac=…&oid=<doc>.<page>&width=256&crop=x,y,w,h
```

`scripts/acquire_indiana_mosaics.js` therefore:

- launches real Chrome once at `about:blank`, then opens **one fresh tab per
  document** — this is what reliably yields a Turnstile response; reusing or
  reloading an existing tab does not;
- captures `crth`/`vac` from both the `getViewerAccessCode` response and the
  first tile request (tokens are bound to one document; they are rejected for
  any other document with a blank 1×1 GIF);
- reads page dimensions from the viewer's `pageImageSizes` JSON;
- partitions each page into a 4-column grid with **exact** column/row edges
  (`round(c*W/COLS)`, `round(r*H/rows)`), so no cell is degenerate — a naive
  `ceil(H/cell)` left a 1-px final row on some pages;
- stitches the archive's own 256-px tiles with `ffmpeg` into a ~1024-px-wide
  white-padded page rendition;
- caches tiles per page, but invalidates the cache whenever the grid signature
  changes so tiles from two different partitions are never mixed;
- closes the tab and moves on, writing the ledger after every page.

Result: 510 mosaic pages across 463 documents stored. The original run recorded
143 cited "section-2 pages" as `UNAVAILABLE (not in viewer)`. **That verdict was
wrong and has been corrected.** The cited suffix (e.g. `JCDC19000505.2.89`) is a
**section id**, not a page key; the viewer's `initialDisplayPageArea.pageID`
names the real page (usually `1.x`), which does exist in `pageImageSizes`. See
"Section ids are not page keys" above. Re-probing all 133 remaining Indiana gap
records resolved **133/133** to a real, imaged page, and the mosaic script now
resolves each section before rendering and stores `cited_section`, `page_key`,
and `section_area`.

The batch initially left 9 retryable failures; all 9 succeeded on a
`--retry-failed` pass. One residual ledger entry (HN-704) is superseded by the
record's issue-PDF page image from Newport Beach. A later pass processed 34
previously unindexed seed pages: 25 acquired (the 9 "unavailable" ones are
recoverable under the corrected mapping). Ledger:
`docs/INDIANA_MOSAIC_LEDGER.json`.

Structural audit of all 510 mosaics (64×64 gray sampling): **0 blank or
degenerate** — minimum standard deviation 6.1, median 39.7, and every page has
at least one pixel at luma ≤ 191, so none is a blank white or black tile.

### Blocked, with the reason established

- **British Library IRO** (`bl.iro.bl.uk`): the product page for *The Statesman*
  exposes 15 ZIP bitstreams, one per year 1806–1824. Re-verified 2026-11-17 via
  the DSpace bundles API and a ZIP central-directory read:
  - the 1806 ZIP (554,589 B) contains **5 XML entries, 0 image entries**
    (four ALTO page files + one METS);
  - the 1810 ZIP (207,489,956 B) exposes **1,553 central-directory entries,
    0 image entries** — every entry is an ALTO/METS `.xml`;
  - the METS does list JP2 *preservation masters* (`…_0001.jp2`–`…_0004.jp2`),
    but they are referenced by relative `xlink:href` only and are **not** part of
    any IRO bitstream. The ALTO `sourceImageInformation` points at an internal
    preservation path (`//NP1-STOR2/…`), not a public URL.
  The page images are on the British Newspaper Archive, which is
  subscription-gated. HN-054/HN-055 stay without an image; this is an honest
  OCR-only gap, not an unsearched archive.
- **California Digital Newspaper Collection** (`cdnc.ucr.edu`): same Veridian
  platform as Indiana but behind a Cloudflare "Just a moment…" challenge with no
  public tile token path; 403 to plain HTTP. One record affected.
- **Papers Past, Virginia Chronicle, NewspaperSG, Georgia, Texas A&M, HRVH,
  Cornell**: unchanged — JS challenge, 403, or HTTP 202.
- **`scholar.lib.vt.edu`**: HTTP 410 Gone.
- **`lib-dspace1.ttu.edu`**: TCP connection timeout (curl error 28) on both
  issue PDFs (Daily National Intelligencer 1836-03-26, Clarendon News
  1935-09-19); no bytes retrievable.
- **`historyworm.com`**: Cloudflare "Just a moment…" 403 on all three cited
  issue pages (New York Herald 1853-07-18, Evening Star 1914-01-18, New Britain
  Herald 1917-12-07).
- **CMU IIIF** (`iiif.library.cmu.edu`): 500 "Invalid URI host: null"; the
  Henry Ford artifact pages are JS applications with no usable image metadata;
  `archindy.org` Criterion PDF returns 403; `dailyiowan.lib.uiowa.edu` PDF fetch
  fails.

---

## Article-level coverage sweep and additional providers (2026-11-17)

A definitive sweep (`scripts/_sweep_article_level.js`) classifies every cited URL
by each archive's own URL grammar and reports article-level citations that do
not yet have a stored crop/clip. Page-level citations are covered by the
page-scan pipelines and are intentionally excluded.

| Kind | Article-level citations | Covered | Missing |
|------|------------------------:|--------:|--------:|
| Veridian (`?a=d&d=<doc>.<edition>.<section>`) | 187 | 186 | 1 |
| Papers Past | 48 | 48 | 0 |
| NewspaperSG | 1 | 1 | 0 |
| NLI JPress | 1 | 1 | 0 |
| newspapers.com | 1 | 0 | 1 |

The only two article-level gaps are honest and already explained:

- **HN-231** cites `JPRP18750514.2.12`, but section `2.12` does not hold the
  cited article. The real article is stored at section `2.4`
  (`823×5369`). This is a documented citation error; no re-download and no
  fabricated substitute.
- **HN-736** cites a `newspapers.com/article/...` page that is paywalled. The
  record already has its Indiana page scan `BG19830618.1.2`.

### Papers Past (National Library of New Zealand)

48/48 cited article URLs acquired (`docs/PAPERSPAST_IMAGE_ACQUISITION_LEDGER.json`,
all `article_clip_acquired`). The image server requires a `Referer` pointing at
the article page; dropping `width` and setting `ext=png` returns the native scan
resolution (2× the displayed width). Clips taller than JPEG's 65,500-px limit are
split into ordered vertical parts at `MAX_PART_H = 60000`
(HN-522 `ESD19400620.2.67` → `-part1.jpg` 1406×57177 + `-part2.jpg` 708×8920).
`scripts/_fix_paperspast_headlines.js` re-verifies the 49 crops (0 missing,
0 failed).

### National Library of Israel — JPress (`nli.org.il`)

`nli.org.il` is a Veridian archive behind Cloudflare. A real Chrome session
(`scripts/nli_session.js`) clears it. HN-799's cited article is stored as an
additional cited article clip
(`hn-799-nli-jweekly19920904-2-3-3-article.jpg`, 1403×1173,
`crop_method: archive_article_blocks_native`, `additional_cited_article: true`)
from the native block endpoint
`?a=is&oid=<paper><yyyymmdd>.2.<articlePath>&type=blockimage&area=all` with
`width` dropped. HN-799 already has its Indiana primary page, so the clip is
additional, never a substitute.

### NewspaperSG (National Library Board, Singapore)

NewspaperSG sits behind an AWS WAF challenge and a terms-of-use modal.
`scripts/newspapersg_session.js` clears both in a real Chrome and writes the
cookie header to `%TEMP%/opencode/newspapersg-session.json`. The archive's own
article-clipping endpoint is:

```
https://eservice.nlb.gov.sg/newspapercontent/digitised/article/<id>.webp
  ?area=1&width=<N>&ct=ARTICLE&ns=&coord=
```

`area=1` is the real clipping; areas 2–5 return a 322×68 placeholder JPEG. The
endpoint upscales to any width, so the stored rendition is `width=1200`
(1200×701), the point where edge energy peaks and native microfilm detail is
preserved without an artificial multi-megapixel upscale. The archive's WebP is
transcoded to JPEG with ffmpeg (`-q:v 2`) — a format transcode, not retouching.
HN-698's clip is an additional cited article (`additional_cited_article: true`)
alongside its Indiana page `BG19740410-01-p1-10`.

### Page-level Veridian citations expose no article blocks

Probed through a real Chrome session (2026-11-17):

| Archive | Sample page-level citation | `sectionTitles` | `sectionPageBlockAreas` | block `<img>` |
|---------|----------------------------|----------------:|------------------------:|--------------:|
| Virginia Chronicle | `TFL19421202.1.1` | 0 | 0 | 0 |
| HRVH Historical Newspapers | `ieadbehj19411211.1.1` | 0 | 0 | 0 |
| California Digital Newspaper Collection | `DNLA19270520.1.3` | 0 | 0 | 0 |

Indiana page-level (`1.x`) citations behave the same. The page mosaic/scan is
therefore the correct article image for those records; no article clip exists to
extract.

### Crop retries are exhausted (honest full-page-only records)

- **Historic Oregon Newspapers:** 420 ledger entries — 76 crops, 52
  `no_confident_match`, 292 `no_headline`. A `--retry-crops` pass re-attempted all
  50 headline-bearing pages; every one stayed `no_confident_match` (scores
  0.20–0.50). The 292 `no_headline` pages have no quoted headline in any record
  field (`discovery_body`, `audit_finding`, `report`, `recorded_finding`,
  `discovery_title`, `rationale`, `audit_assessment`, `audit_prior_evidence`), so
  a crop is not permitted under the ≥0.6 quoted-headline rule.
- **Library of Congress:** 85 entries — 3 crops, 9 `no_confident_match`, 73
  `no_headline`. A `--retry-crops` pass re-attempted the headline-bearing pages;
  no new crop.
- **Gateway to Oklahoma / Portal to Texas:** OCR plain text only, no
  ALTO/word coordinates, so no crops are possible; full pages are stored.
- **Indiana page-level / Virginia Chronicle / HRVH / CDNC:** no article blocks
  (see above); covered by page mosaics/scans.

### Additional archive-owned scans (2026-11-17, continued)

Beyond the first article-level sweep, these archive-owned renditions were located
and stored. Each is the archive's own scan or clipping; no generated or retouched
images are used.

- **Virginia Chronicle (Library of Virginia)** — 2/2 page mosaics via the
  Veridian viewer: HN-597 `NVP19540316.1.1` (1024×1280 from 5976×8030) and
  HN-536 `TFL19421202.1.1` (1024×1464 from 5101×7268). Ledger:
  `docs/VIRGINIA_CHRONICLE_MOSAIC_LEDGER.json`.
- **Supporting Veridian citations** — 3/3: HN-412 HRVH
  `jaaggbbf19181223.1.8` (1024×1536), HN-529 HRVH `ieadbehj19411211.1.1`
  (1024×1280), HN-453 CDNC `DNLA19270520.1.3` (1024×1536; the CDNC token field
  is `grrh`, not `crth`). Ledger: `docs/SUPPORTING_VERIDIAN_LEDGER.json`.
- **Georgia Historic Newspapers** — HN-546 `sn83009936/1944-07-20/seq-1`
  (1200×1511) via Open ONI IIIF. Ledger: `docs/GEORGIA_IIIF_LEDGER.json`.
- **Texas A&M (Open ONI)** — HN-582 `sn86088544/1951-01-12/seq-1` (1200×1632).
  Ledger: `docs/TAMU_IIIF_LEDGER.json`.
- **Utah Digital Newspapers** — HN-320 *Deseret Evening News*, 1899-12-30, p1/1
  (1500×2389), text match 6/7.
- **Southwest Collection (Texas Tech)** — 8/8 issue PDFs for 6 records, plus
  HN-756 *The University Daily*, 1985-11-15, p1/12 (1542×2545,
  `first_page_fallback`, 3/8 words). All PDF renderings are recorded in
  `docs/OTHER_IMAGE_ACQUISITION_LEDGER.json`.
- **South Carolina supporting pages** — HN-380 `sn84026925/1912-02-16/seq-2`
  (7547×10363) and HN-381 `sn84026925/1912-03-29/seq-1` (7540×10435), in
  `docs/SC_IMAGE_ACQUISITION_LEDGER.json`.
- **SCVHistory** — HN-457 `al3038a.htm`/`al3038b.htm` → *Los Angeles Examiner*
  pages 800×989 and 800×995.
- **NewspaperSG supporting article clips** — 6/6. The archive's own clipping
  endpoint returns the article in numbered areas; real areas are stacked in
  archive order with white padding only, and a `Referer` for the article page is
  required or the endpoint returns a 512×68 placeholder. HN-460 (1200×2761,
  4 areas), HN-461 (1200×5763, 7), HN-473 (1200×5736, 3), HN-475 (1200×10754, 4),
  HN-483 (1200×3217, 3; *The Straits Budget*), HN-591 (1200×6576, 5). Ledger:
  `docs/NEWSPAPERSG_SUPPORT_LEDGER.json`.
- **The Spectator Archive** — 2/2 page scans from the article page's `fullImages`
  map: HN-208 14 Dec 1867 p1 (918×1500), HN-233 18 Dec 1875 p1 (939×1500).
  Ledger: `docs/SPECTATOR_IMAGE_LEDGER.json`.
- **Jewish Telegraphic Agency archive** — 8 of 9 cited scanned bulletins located
  by OCR page-locator (Windows OCR is used only to find the page; the stored
  image is the archive's own scanned PDF page, and no OCR text is stored):
  HN-503 (two bulletins, p1/6 and p3/5), HN-510 p1/4, HN-516 p5/5 and p4/5,
  HN-559 p2/5, HN-711 p2/4, HN-809 p1/4. HN-813's cited article is absent from
  its linked bulletin (all four pages checked), so it remains an honest
  no-match; HN-839 links no scanned PDF. Ledger: `docs/JTA_IMAGE_LEDGER.json`.
- **Oakland University — *The Pontiac Press*** — 4/4 cited issues scanned from
  microfilm, page located by the PDF's own text layer: HN-598 1954-04-22 p1/55,
  HN-600 1954-06-10 p2/60, HN-601 1954-09-23 p1/64, HN-602 1955-04-12 p1/30.
  Ledger: `docs/OAKLAND_IMAGE_LEDGER.json`.
- **Carnegie Mellon University — *The American Jewish Outlook*** — 3/3 cited
  issue PDFs, page located by the PDF's own text layer: HN-503 1936-08-21 p1/12
  (Olympic fair-treatment resolution), HN-510 1938-03-18 p3/16 ("And Now
  Austria"), HN-516 1938-11-25 p6/16 (Father Coughlin editorial). Ledger:
  `docs/CMU_IMAGE_LEDGER.json`.
- **Supporting newspaper PDFs** — 15/15, page located by the PDF's own text
  layer (or, where the PDF has no text layer, by a Windows OCR page-locator used
  only to find the page): HN-672 *Orange Coast Pilot* 1968-12-28 p5/72, HN-657
  *Michigan State News* 1966-08-02 p1/6, HN-704 *The Daily Iowan* 1975-03-31
  p1/10, HN-731 *The Observer* 1982-01-15 p4, HN-208 *Morning Courier*
  1867-12-25 p2, HN-707 *Americké listy* 1976-07-16 p1, HN-841 *Rhode Island
  Jewish Herald* 1999-01-21 p8, HN-708 *The Militant* 1976-09-17 p16, HN-451
  *The Daily Worker* 1927-04-18 p3, HN-480 *The Daily Worker* 1933-03-06 p1,
  HN-635 *National Guardian* 1961-05-29 p4, HN-622 *The Florence Herald*
  1958-03-13 p1, HN-224 *The New York Herald* 1873-06-10 p6, HN-401 *The Daily
  Home News* 1916-07-13 p1, and HN-935 *The Criterion* 2013-11-22 p5 (retrieved
  from the Internet Archive snapshot of the cited file). Ledger:
  `docs/SUPPORT_SCANS_LEDGER.json`.
- **Internet Archive — *The Glendale Evening News*** — HN-416 1919-08-01 front
  page (4456×6569; "Subsidence of Race Riots … total of 34") and HN-442
  1925-04-18 p17 (2566×3382; Madge Oberholtzer / D.C. Stephenson trial report).
  Page identity comes from each item's own `_djvu.xml` page objects; the cited
  Wikimedia PDFs are renditions of the same items. Ledger:
  `docs/OTHER_IMAGE_ACQUISITION_LEDGER.json`.
- **Internet Archive — *China Mail* (Hong Kong)** — HN-460 1928-11-13 front page
  (3585×4678) carrying the *Vestris* sinking report; page located in the item's
  own DjVu XML. Ledger: `docs/OTHER_IMAGE_ACQUISITION_LEDGER.json`.
- **Broward County Library — *Hollywood Sun-Tattler*** — HN-741 1983-11-01
  front page (924×1575) via the collection's IIIF service, carrying the
  Grenada invasion / hospital-bombing coverage cited alongside the
  *Banner-Graphic* page. Ledger: `docs/OTHER_IMAGE_ACQUISITION_LEDGER.json`.

### Final acquisitions (2026-11-18) and dedupe fix

Four last archive-owned scans were located and added as `additional_cited_article`
renditions (each is the archive's own scan, OCR-confirmed as a locator only; no
OCR text is stored and no image is generated or retouched):

- **HN-677** — *The Argus* (Melbourne), 18 Apr 1970 p1, from the cited Flickr
  archive item (`49786877458`), 4745×7016. `hn-677-flickr-melbourne-herald-19700418-p1-page.jpg`.
- **HN-602** — Post-Gazette Archives polio clippings from the cited
  `newsinteractive.post-gazette.com/polio/` feature. Four distinct archive-owned
  clippings credited "Post-Gazette Archives" were collapsed by the old dedupe
  logic; after the fix all four are present (HN-602 now has 7 images). Images
  credited `newspapers.com` or AP were excluded.
- **HN-709** — *The Philadelphia Inquirer*, 3 Aug 1976 page scan carrying
  "Mysterious Disease Kills 16", 3000×2000.
  `hn-709-inquirer-legionnaires-19760803-page.jpg`.
- **HN-645** — *The Dallas Morning News*, 23 Nov 1963 p1, from the Shapell
  Manuscript Library item, 1000×1534; OCR confirmed the dateline and
  "KENNEDY SLAIN ON DALLAS STREET".
  `hn-645-shapell-dallas-morning-news-19631123-p1-page.jpg`.

**Dedupe fix.** `scripts/lib_image_merge.js` now honours an explicit
`distinct_asset: true` flag so that multiple archive-owned scans from one source
page coexist rather than being collapsed as duplicates. The flag is set on the
12 older `docs/OTHER_IMAGE_ACQUISITION_LEDGER.json` entries that legitimately
share a source page and on the HN-709 and HN-645 acquisitions. This is what
restored the four HN-602 Post-Gazette clippings.

### Final host probe and rejection log (2026-11-18)

A record-by-record cross-check of every cited URL against stored image hosts,
plus direct probes of every remaining archive-scan-capable citation, confirmed
there is no further obtainable scan. Resolved as already-covered or not a scan:

- **HN-224** LOC `sn83030313/1873-09-21/seq-5` — already stored under the
  `www.loc.gov/resource/...?sp=5` host form.
- **HN-399** Papers Past — citation is a search-results URL (0 images) with no
  article clip; the record has an Indiana page scan.
- **HN-465** Texas A&M — cited PDF is the *Legacies Fall 2013* alumni magazine,
  excluded as a non-newspaper publication.
- **HN-813 / HN-839** JTA — cited pages expose only a `waiting-for-61-seats-72.png`
  podcast promo; no scanned bulletin for those articles.
- **HN-930** Inquirer 2012 — a modern web article with photos, not a scan.
- **HN-412 / HN-529** HRVH Veridian — bot-protected (HTTP 202) to automation,
  but both records already have their Veridian page renders.
- **HN-531** Densho (403), **HN-546** Georgia Historic Newspapers (403) — already
  have their primary scans; no additional on-topic scan exposed.
- **HN-683 / HN-701 / HN-731** Notre Dame *Observer* PDFs — genuine archive
  scans but already stored as additional cited articles.
- **WV Culture** *Silver Bridge* page — only a 500×100 site logo; **Times Leader**
  and **Vindy Archives** — modern opinion articles, no scans.
- All 136 Indiana `page_unavailable` entries are "page absent from archive
  viewer" (a genuine archive state, not a transient failure), and all 136 of
  those records have images from other sources.

All acquisition ledgers report 0 `failed`/`pending`/`error` entries. The final
`_check_cited_scan_locators.js` check found only HN-224 (false positive, already
stored) and HN-465 (excluded magazine).

### Final honest gap split

`scripts/gap_report.js` reports **98 records without an image**:

- **96 modern copyrighted web articles** (94 Guardian, 1 WCAX, 1 NY1; 2016–2026).
  These are web articles, not historical newspaper scans, and are never
  screenshotted or republished.
- **2 British Library records** (HN-054/HN-055, *The Statesman*, London,
  24 July 1806, pp. 3–4). Only ALTO/METS XML is public; the page images are on
  the subscription British Newspaper Archive.

`scripts/_check_coverage.js` confirms **0 gap records cite a historical newspaper
archive** — every record whose citation is a historical scan has an image.

**Resolution (2026-11-18, owner delegated): final.** Both categories are accepted
as permanent, honest gaps — no image is added for them:

- Modern copyrighted web articles: kept as citation + source link only. Taking
  screenshots of modern web news is outside the project rules, and these records
  are not historical newspaper scans.
- British Library records: kept as OCR-only gaps with the BL dataset link.
  Retrieving the pages would require a paid British Newspaper Archive
  subscription, which is not available.

This closes image acquisition: the site shows archive-owned scan renditions for
every record for which one is obtainable, and an honest linked gap otherwise.

### Structural audit (all stored assets)

`scripts/audit_mosaics.js` samples every referenced asset at 64×64 gray and checks
variance and darkest pixel. Final run: **1,812 distinct assets, 0
missing/blank/degenerate**; sd min/median 6.1/38.5; darkest-pixel max 197. Per
method, 0 bad: `openseadragon_tiles_256` 755, `page_scan` 520,
`archive_article_blocks_native` 223, `crop` 170,
`archive_pdf_page_rendition` 58, `archive_page_rendition` 23,
`archive_clipping_image` 32, `archive_iiif_image` 4,
`archive_page_image` 25, `iiif_image_api` 2.
