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

- **Last successful verification:** All Milestones 0–5 complete and pushed to `origin/main` (commit pending).
- **Working tree:** Clean.
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

1. **Milestone 6 — Media acquisition:** Merge batch-report URLs (2,986) into `SOURCE_ACQUISITION_MANIFEST.csv`; attempt manual/browser-based direct image acquisition from Indiana and LOC (both currently blocked by bot protection).
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
| **Total** | **293** | **584** | **37** | |

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
- **Blocked and not automated:** Indiana (`newspapers.library.in.gov`, Cloudflare
  challenge), Papers Past (Incapsula JS challenge), British Newspaper Archive
  (subscription paywall), NewspaperArchive and RareNewspapers (commercial
  licensing). Modern paywalled titles (Washington Post, LA Times, Guardian) are
  not scraped and are never republished.

**Honesty constraints preserved**

- Every stored JPEG is a rendition of the archive's own scan; none is generated
  or retouched.
- Crops exist only where a quoted batch-report headline matches OCR text at
  score >= 0.6. All other pages show the full scan alone.
- Full pages are 1,200-px-wide renditions; article crops are native-resolution.
  The archive viewer is linked from every card.
- LOC and Oklahoma/Texas pages carry no crops because those services expose no
  word coordinates (or no headline metadata for the page).

**Verification (this run)**

- `scripts/verify_images.js`: 293 records, 584 scans, 37 crops, 0 missing files,
  0 broken references.
- `scripts/verify_milestone7.js`: 40/40.
- `scripts/coverage_report.js`: 293/1,056 records (27.7%) have scans;
  31 records (2.9%) have a verified crop; 210 records link only to
  blocked/paywalled providers.

**New scripts**

- `scripts/acquire_loc_images.js` — LOC JSON + IIIF + word coordinates.
- `scripts/acquire_sc_images.js` — South Carolina JP2 + coordinates + ffmpeg.
- `scripts/acquire_portal_images.js` — Oklahoma and Texas IIIF.
- `scripts/lib_image_merge.js` — merges all provider ledgers into
  `site/data/images.json`.
