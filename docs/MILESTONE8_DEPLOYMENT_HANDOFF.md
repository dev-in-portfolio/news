# Deployment Handoff — Milestone 8

**Project:** Historical Newspaper Archives  
**Research path:** `D:\news`  
**Site output:** `D:\news\site`  
**GitHub:** https://github.com/dev-in-portfolio/news.git  
**Milestone:** 8 — Deployment handoff  
**Status:** Documentation complete — **no deployment authorized**

---

## 1. Deployment authorization

**No live deployment has been authorized.** Per the project specification (§9, §14):

> "Do not publish until the user explicitly selects the target and asks for deployment."

> "No publication or external write until explicitly directed by the user; local building and source retrieval for the approved project are in scope."

A later possible path is `darkstarconsultinggroup.com/newspaper-archives`, but it is **not an established deployment target**. Before any publication, the user must:

1. Select the deployment target (GitHub Pages, Netlify, or other).
2. Explicitly authorize publication.
3. Confirm whether `darkstarconsultinggroup.com/newspaper-archives` is the intended destination.

This handoff document prepares everything needed so deployment can proceed immediately upon authorization.

---

## 2. Reproducible build / preview / test commands

All commands run from `D:\news` with Node.js v18+ (v24.16.0 installed on this workstation).

### Build the static site

```powershell
# Step 1: Prepare normalized data JSON from verified source ledgers
node scripts/build-data.js

# Step 2: Generate all static HTML pages
node scripts/build-pages.js
```

Outputs are written to `site/`. Re-running is idempotent: all generated files are overwritten from source; original source data under `D:\news` (and `old stuff/`) is never modified.

### Local preview

```powershell
# Option A: Python
python -m http.server 8000 --directory site

# Option B: Node (serve)
npx serve site
```

Then visit `http://localhost:8000`.

### Test

```powershell
# Run the full verification suite
node scripts/verify_milestone7.js

# Expected: 40/40 checks pass
```

The verification checks:
- 1,056 HN detail pages + 3 reference stories exist
- All detail pages have required elements (evidence tier, taxonomy, verbatim seed URL)
- 6,830 internal links checked, 0 broken
- Re-import idempotence (records.json byte-identical)
- No private research notes in public pages

---

## 3. Architecture rationale

Favor a **local-first, data-driven, statically generated** archive:

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build pipeline | Node.js scripts (`scripts/build-data.js`, `scripts/build-pages.js`) | Node v24 available; zero new accounts; zero paid services; trivial CI |
| Site output | Static HTML + JSON | No server, no database, no runtime required to serve |
| Styling | Hand-written CSS | No framework dependency; full archival aesthetic control |
| Interactivity | Vanilla JavaScript | Client-side search over lean JSON index; no framework |
| Data | Normalized JSON (`site/data/`) | Portable, versionable, regenerable from source |
| Deployment target | GitHub Pages or Netlify (static) | Fits existing GitHub/Netlify ecosystem; free tier sufficient |

**Not chosen (and why):**
- Server-side framework/database: no requirement demands dynamic server logic; adds cost and maintenance
- New paid platform / identity provider / admin auth: explicitly excluded by spec
- Static-site generator (11ty, Hugo, Jekyll): adds dependency; small Node build script is equally repeatable

Full rationale documented in `docs/ARCHITECTURE_DECISION.md`.

---

## 4. Documented environment needs

| Requirement | Detail |
|-------------|--------|
| Runtime | Node.js v18+ (v24.16.0 confirmed) |
| Build | `node scripts/build-data.js && node scripts/build-pages.js` |
| Preview | Any static file server (Python `http.server`, `npx serve`) |
| Disk | ~5 MB for site output; source data ~4.2 MB remains unchanged |
| Network | None required for build/preview; external archive links fetch at runtime |
| Database | None |
| Paid accounts | None |
| Admin authentication | None (public visitors cannot modify records) |

---

## 5. Research / media refresh procedure

### Refresh source data

1. Obtain updated `ingestion_ledger.json` / `reconciliation_ledger.json` from the research package.
2. Place in `docs/` (replacing existing files; originals hash-verified against `SOURCE_CHECKSUMS.sha256`).
3. Re-run `node scripts/build-data.js` then `node scripts/build-pages.js`.
4. Run `node scripts/verify_milestone7.js` to confirm no regressions.

### Refresh media acquisition (Milestone 6)

The `docs/SOURCE_ACQUISITION_MANIFEST.csv` tracks 4,042 source URLs with acquisition status. To expand coverage:

1. Test additional URLs from the manifest (batch-report URLs from `scripts/batch_urls.json`).
2. Update `acquisition_status`, `last_checked_at`, `failure_reason`, `next_action` fields.
3. Regenerate detail pages via `node scripts/build-pages.js` (reads manifest for status badges).

### Media acquisition gate status

| Provider | URLs | Accessible via automated fetch | Notes |
|----------|------|-------------------------------|-------|
| Indiana Historical Newspapers | 905 | No (403 blocked) | External link only |
| Library of Congress | 53 | No (403 blocked) | External link only |
| The Guardian | 94 | Yes (20 tested, all OK) | Citation + link only (copyright) |
| British Library | 2 | Metadata only | Page images behind BNA paywall |
| WCAX | 1 | Yes | Citation + link only (copyright) |
| NY1 | 1 | Page loads; body unconfirmed | External link only |
| Other/secondary | 1,459 | Untried | Queued for testing |

Direct image acquisition from archive providers is **blocked** to automated fetch (Indiana/LOC return 403). The site degrades gracefully to external source links with honest "blocked_access" status rather than fabricating images.

---

## 6. Progress ledger and outstanding issues

### Milestone completion record

| Milestone | Title | Status |
|-----------|-------|--------|
| 0 | Inventory and baseline | Complete |
| 1 | Canonical extraction | Complete |
| 2 | Reconcile quality | Complete |
| 3 | Original-source feasibility & media architecture gate | Complete |
| 4 | Three complete reference story slices | Complete |
| 5 | Functional full-catalog website | Complete |
| 7 | Verification and polish | Complete |
| 8 | Deployment handoff | Complete (documentation only) |

### Outstanding issues / next actions

1. **Deployment authorization required.** No publication until user explicitly selects target and asks for deployment.
2. **Media acquisition:** 2,942 of 4,042 source URLs remain `untried`; Indiana (Veridian) and LOC blocked by bot protection. Manual/browser-based session needed for direct image acquisition.
3. **Master tracker workbook:** `Historical_Newspaper_Event_Research_Tracker_v0.1.xlsx` preserved unchanged; 140 candidate identity pairs reside in workbook (135 deduped from seed peer column). Open in Excel to complete pair inventory.
4. **Milestone 7 verification:** All 40 checks pass; report at `docs/MILESTONE7_VERIFICATION_REPORT.md`.

---

## 7. Deployment checklist (when authorized)

- [ ] User selects deployment target (GitHub Pages / Netlify / other)
- [ ] User explicitly authorizes publication
- [ ] Confirm target URL (e.g., `darkstarconsultinggroup.com/newspaper-archives`)
- [ ] Run `node scripts/build-data.js && node scripts/build-pages.js`
- [ ] Run `node scripts/verify_milestone7.js` (expect 40/40)
- [ ] Deploy static `site/` directory to selected target
- [ ] Verify live site loads homepage, search, detail pages
- [ ] Confirm no private research notes exposed in public build

---

## 8. Files delivered

**Source data (read-only, unchanged):**
- `D:\news\` root + `old stuff/` — 63 research files, hash-verified

**Generated outputs (`docs/`):**
- `IMPORT_INVENTORY.md`, `import_inventory.json` — Milestone 0
- `ingestion_ledger.json`, `COVERAGE_SEARCH_LEDGER.csv`, `DATA_SCHEMA.md`, `EXTRACTION_SUMMARY.md` — Milestone 1
- `reconciliation_ledger.json`, `IDENTITY_CANDIDATES.csv`, `RECONCILIATION_REPORT.md` — Milestone 2
- `SOURCE_ACQUISITION_MANIFEST.csv` (4,042 rows), `FEASIBILITY_REPORT.md`, `PROGRESS_LEDGER.md` — Milestone 3
- `REFERENCE_STORIES_REVIEW.md` — Milestone 4
- `ARCHITECTURE_DECISION.md`, `CORRECTIONS_POLICY.md`, `README.md` — Milestone 5
- `MILESTONE7_VERIFICATION_REPORT.md` — Milestone 7

**Generated site (`site/`):**
- `index.html`, `search.html`, `taxonomy.html`, `timeline.html`, `comparisons.html`, `about.html`
- `stories/hn-NNN.html` (1,056 HN pages) + `stories/hn-403-black-tom.html`, `hn-753-mexico-city.html`, `hn-894-sago-mine.html`
- `assets/style.css`, `assets/app.js`
- `data/records.json`, `data/search.json`, `data/taxonomy.json`, `data/comparisons.json`, `data/stats.json`

**Build scripts (`scripts/`):**
- `build-data.js`, `build-pages.js`, `verify_milestone7.js`, `find_broken_links.js`, plus Milestone 6 analysis scripts

---

**Ready for deployment upon your explicit authorization.** No publication has occurred and will not occur without your direction.
