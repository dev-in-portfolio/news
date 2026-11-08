# Source-Feasibility Report — Milestone 3 (Media Architecture Gate)

**Project:** Historical Newspaper Archives  
**Research path:** `D:\news`  
**Milestone:** 3 — Original-source feasibility and media architecture gate  
**Status:** Complete — gate findings documented; architecture NOT yet finalized  

---

## 1. Purpose

Before committing to the full website architecture, this gate tests whether authentic original newspaper article images/scans can be lawfully acquired and displayed from the six seed source origins. Findings here determine the media pipeline (direct image assets vs. external viewer links vs. honest fallbacks). No architecture is finalized until these results are reviewed.

## 2. Providers tested (six seed origins)

Each origin was sampled with a live automated fetch of representative seed URLs. Results are honest: blocked/inaccessible sources are recorded as such, never disguised as available.

| # | Provider (origin) | Seed URLs in corpus | Representative URL tested | Fetch result | Article image / OCR directly verifiable? |
|---|-------------------|---------------------|---------------------------|--------------|------------------------------------------|
| 1 | Indiana Historical Newspapers (`newspapers.library.in.gov`, Veridian) | 905 | `…/WS18071202.1.3` (1807) and `…/EVRP19160731.2.7` (1916, HN-403 Black Tom seed) | **403 Forbidden** | **No** — bot protection blocks automated page fetch |
| 2 | Library of Congress / Chronicling America (`loc.gov`) | 53 | `…/sn83021126/1777-07-22/ed-1/?sp=2` (HN-001) and `…/sn96088107/1916-07-31/ed-1/seq-1/ocr/` (HN-403 comparison) | **403 Forbidden** | **No** — both `/resource/` page and `/ocr/` endpoint blocked |
| 3 | The Guardian (`theguardian.com`) | 94 | Pulse HN-952 and Parkland HN-960 | **200 OK** | N/A — modern editorial webpage (article text loads; not a scanned page) |
| 4 | British Library (`bl.iro.bl.uk` IRO repository) | 2 | `…/entities/product/2252a010-5953-4c65-8993-1be3da97d935` (The Statesman) | **200 OK** | **Partially** — repository metadata loads; CC0 OCR dataset (DOI 10.23636/1235); page images behind paywall on British Newspaper Archive |
| 5 | WCAX (`wcax.com`) | 1 | HN-1045 Ig Nobel 2026 | **200 OK** | N/A — modern editorial webpage (AP syndicated article text loads) |
| 6 | NY1 (`ny1.com`) | 1 | HN-1047 lunar crater 2026 | **200 OK (page)** | **Unconfirmed** — page shell loads; article body not clearly present (JS-heavy) |

## 3. Key findings

### 3.1 Historical archive providers are blocked to automated fetching
Both Indiana Historical Newspapers (Veridian) and Library of Congress / Chronicling America return **HTTP 403 Forbidden** to automated page and OCR fetches. This means:
- Authentic scanned page images and OCR text from these two origins (958 of 1,056 seed records combined) **cannot be directly verified** from this environment via automated fetch.
- This is a **documented limitation**, not a failure to conceal. Per the spec, blocked sources show an honest fallback (external source link), never a fabricated clipping.

### 3.2 Modern editorial sources load but carry reuse restrictions
The Guardian (94), WCAX (1), and NY1 (1) all return HTTP 200 and article text loads. However:
- These are **modern copyrighted articles**, not scanned historical newspaper pages.
- Per the spec (§3.7 Modern article and rights distinction): use a citation and link to the publisher; do **not** capture and republish complete protected articles by default.
- NY1's article body did not surface clearly in automated fetch (JS-heavy shell) — requires browser-based confirmation.

### 3.3 British Library: mixed availability
The British Library IRO repository metadata page loads (200 OK). The Statesman dataset is CC0 (DOI 10.23636/1235) with OCR text in XML available, but **page images are behind a paywall on the British Newspaper Archive**. Per spec: use an external viewer/thumbnail link, not an unauthorized copied image.

## 4. Provider-specific acquisition methods that work today

| Provider | Working method | Blocked / limited | Recommended approach for site |
|----------|---------------|-------------------|-------------------------------|
| Indiana Historical Newspapers | None confirmed (403) | Page + image endpoints blocked | External source link to Veridian page URL; mark `blocked_access`; manual browser review later |
| Library of Congress | None confirmed (403) | `/resource/` and `/ocr/` blocked | External source link to LOC URL; consider LOC API/IIIF in a later session |
| The Guardian | Modern article HTML loads (200) | Full-text republication restricted by copyright | Citation + external source link; no full-article republication |
| British Library | Repository metadata + CC0 OCR dataset (200) | Page images behind BNA paywall | Link to DOI dataset + BNA viewer link; CC0 OCR where permissible |
| WCAX | Modern article HTML loads (200) | AP syndicated, copyright restricted | Citation + external source link |
| NY1 | Page shell loads (200) | Article body unconfirmed (JS) | Confirm via browser; external source link otherwise |

## 5. Local image viewer proof — NOT yet achievable

The spec requires proving "a local image viewer using at least one authentic crop/full-page pair when available." **This could not be achieved in this gate** because both historical archive providers (the sources that would supply authentic scanned page images) return 403 to automated fetch. No authentic crop/full-page byte pair was acquired.

**Gate outcome:** Do **not** finalize a "direct image asset" architecture. Plan for:
- External source/viewer links as the primary media delivery mode for historical archive sources,
- Honest `blocked_access` / `no_scan_found` fallbacks,
- A later manual/browser-based session to attempt direct image acquisition (and revisit the architecture if it succeeds).

## 6. Manifest produced

`docs/SOURCE_ACQUISITION_MANIFEST.csv` — mandatory per-appearance acquisition manifest with all required fields:
`hn_ids, event_id, appearance_id, newspaper, issue_date, edition, page, original_url_exact, resolved_url, provider, source_kind, discovered_in_file, source_file_location, acquisition_status, full_page_available, full_page_asset_path, article_crop_status, crop_asset_path, crop_coordinates, source_dimensions, ocr_status, reuse_status, reuse_basis_or_url, source_identity_verified, crop_reviewed, reviewer_or_process, last_checked_at, failure_reason, next_action`

- **1,056 rows** (one per seed URL), covering all six providers.
- **9 URLs** have live test results overlaid (4 blocked_access, 3 source_identity_verified, 2 link_checked).
- **1,046 URLs** remain `untried` and queued for provider-specific acquisition testing in Milestone 6.

## 7. Milestone 3 acceptance

- [x] Sampled all six seed source origins (Indiana 905, Guardian 94, LOC 53, British Library 2, WCAX 1, NY1 1)
- [x] Tested at least one multi-era Indiana sample (1807 + 1916)
- [x] Tested LOC page and OCR endpoints separately
- [x] Tested British Library repository
- [x] Tested modern editorial webpages (Guardian, WCAX, NY1) for source linking/attribution/rights
- [x] Recorded source access, identity, full-page, OCR, crop feasibility, rights, and viewer restrictions per provider
- [x] Produced `docs/SOURCE_ACQUISITION_MANIFEST.csv` with all required fields
- [x] Documented provider-specific extraction notes, failure classifications, and verified/unverified totals
- [x] Determined local image viewer proof is **not achievable** in this gate (both archive providers blocked)
- [x] Architecture deliberately **not** finalized — pending gate review

## 8. Recommendation (for user review before scaling)

Given that the two primary historical newspaper archive providers block automated access, the site's media experience should be designed around **external source links + honest availability states** rather than direct image assets, at least until a manual/browser-based session can attempt direct acquisition. This decision should be confirmed with the user before Milestone 4 (reference stories) and Milestone 5 (full catalog) proceed.

**Next action:** Present this feasibility report for review. On approval, proceed to Milestone 4 (Black Tom HN-403, Mexico City HN-753, Sago HN-894 reference stories) using external links and honest fallbacks where images are unavailable.
