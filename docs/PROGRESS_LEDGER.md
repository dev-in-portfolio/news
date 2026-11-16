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

- **Last successful verification:** Milestones 0–8 complete; `verify_milestone7.js` 40/40, `verify_images.js` 0 broken assets.
- **Working tree:** Phase-2 image acquisition is uncommitted as of this checkpoint (checkpointed together with this ledger).
- **Original source files:** Unchanged and read-only (hash-verified against `SOURCE_CHECKSUMS.sha256`).
- **Generated data:** All under `site/data/` and `docs/`; none mixed with original source data.
- **HTML pages:** 1,065 (1,056 detail pages + 6 section pages + 3 reference stories).

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
| Distinct resolved source URLs | 3,240 | `scripts/hn_urls.json` |
| Records with no source URL at all | 0 | every record has a cited URL |
| Records with ≥1 stored image | 825 | `site/data/images.json` |
| Stored image renditions (entries) | 1,168 | 1,144 full-page + 61 crops (overlap where both exist) |
| Full-page scans | 1,144 | Oregon 420, Indiana 510, LOC 86, OK 53, TX 25, SC 20, SCVHistory 16, other 14 |
| Word-coordinate-verified article crops | 31 | score ≥ 0.6 against quoted headline |
| Archive article clips | 21 | Indiana block-level crops (no OCR verification available) |
| Indiana tile mosaics | 510 pages / 463 documents | `docs/INDIANA_MOSAIC_LEDGER.json` (143 page-unavailable, 1 residual failed) |
| PDF-rendered page images | 11 | 9 records, `archive_pdf_page_rendition` |
| Other-archive page renditions | 19 | Quartex / CONTENTdm / SCVHistory / LOC guide page (4 records) |
| Image files on disk | 1,211 | 639 MB under `site/assets/images/` |
| Records still without an image | 231 | 0 with no source URL, 231 with only blocked/paywalled/non-newspaper URLs |

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
   - **Unavailable section-2 pages (143):** several Indiana titles cite
     section-2 pages (e.g. `?a=d&d=JCDC19000505.2.89`) that the viewer does not
     expose. Verified directly on four titles: fetching the cited URL returns
     HTTP 200, but `pageImageSizes` lists only 4–8 `1.x` pages and zero `2.x`
     keys. The cited page is genuinely absent from the digital object, so these
     are recorded as `page_unavailable` (honest gaps); no page mapping is
     invented.
   - **Every remaining Indiana gap is documented:** cross-checking the 133
     Indiana records still listed in `docs/IMAGE_GAP_REPORT.csv` against
     `docs/INDIANA_MOSAIC_LEDGER.json` shows all 133 have at least one
     `page_unavailable` entry (0 unexplained, 0 with an image from another
     provider). No Indiana gap is silent or unattributed.
2. **Open the master tracker Excel workbook** (`Historical_Newspaper_Event_Research_Tracker_v0.1.xlsx`) to complete the 140 candidate identity pair inventory (135 deduped from seed peer column; authoritative 140 in workbook).
3. **User review of Milestone 3–5 findings** before scaling design/acquisition strategy or requesting deployment.
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
- 9 section-2 citations confirmed absent from the archive viewer
  (`page_unavailable`: HN-243, HN-296, HN-304, HN-313, HN-343, HN-348, HN-351,
  HN-357, HN-375). The viewer's `pageImageSizes` map has no key for those
  section-2 pages, so no image is stored and no page mapping is invented.
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

Result: 510 mosaic pages across 463 documents stored. 143 cited pages report
`UNAVAILABLE (not in viewer)`; this is a genuine archive gap, not a token issue:
the cited section-2 keys (e.g. `JCDC19000505.2.89`, `RLRP18860429.2.61`) do not
exist in the viewer's `pageImageSizes`, which exposes only 4–8 `1.x` pages for
those issues. The batch initially left 9 retryable failures; all 9 succeeded on
a `--retry-failed` pass. One residual ledger entry (HN-704) is superseded by the
record's issue-PDF page image from Newport Beach. A later pass processed 34
previously unindexed seed pages: 25 acquired and 9 more section-2
`page_unavailable`. Ledger: `docs/INDIANA_MOSAIC_LEDGER.json`.

Structural audit of all 510 mosaics (64×64 gray sampling): **0 blank or
degenerate** — minimum standard deviation 6.1, median 39.7, and every page has
at least one pixel at luma ≤ 191, so none is a blank white or black tile.

### Blocked, with the reason established

- **British Library IRO** (`bl.iro.bl.uk`): the product page for *The Statesman*
  exposes two ZIP bitstreams (0.55 MB and 207 MB). Both contain only
  ALTO/METS **XML**, no page images. The page images are on the British
  Newspaper Archive, which is subscription-gated. HN-054/HN-055 stay without an
  image.
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
