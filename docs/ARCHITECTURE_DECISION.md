# Architecture Decision — Historical Newspaper Archives

**Project:** Historical Newspaper Archives  
**Research path:** `D:\news`  
**Site output:** `D:\news\site`  
**Milestone:** 5 — Functional full-catalog website  
**Status:** Adopted  

---

## 1. Chosen stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build pipeline | Node.js script (`scripts/build-data.js`, `scripts/build-pages.js`) | Node v24 is available on the workstation; zero new accounts, zero paid services, trivial to run locally and in CI. |
| Site output | Static HTML + JSON | All pages pre-rendered at build time; no server, no database, no runtime language required to serve. |
| Styling | Hand-written CSS (`site/assets/style.css`) | No framework dependency; full control over the archival aesthetic (cream/ink/bronze) and accessibility. |
| Interactivity | Vanilla JavaScript (`site/assets/app.js`) | Client-side search over a lean JSON index (~1,056 records); no framework, no build step for JS. |
| Data | Normalized JSON (`site/data/`) | `records.json`, `search.json`, `taxonomy.json`, `comparisons.json`, `stats.json` — portable, versionable, regenerable from source. |
| Deployment target | GitHub Pages or Netlify (static) | Fits the existing GitHub/Netlify ecosystem; no paid platform, no identity provider, no database. |

**Not chosen (and why):**
- **Server-side framework/database (Django, Rails, etc.):** No requirement demands dynamic server logic; adds cost, maintenance, and deployment complexity.
- **New paid platform / identity provider / admin auth:** Explicitly excluded by the spec (§9, §14).
- **Static-site generator (11ty, Hugo, Jekyll):** Would add a dependency and learning curve; a small Node build script is equally repeatable and more transparent for this scale.

---

## 2. Build pipeline

```
docs/ingestion_ledger.json   (1,056 records — Milestone 1)
docs/reconciliation_ledger.json  (Milestone 2)
docs/SOURCE_ACQUISITION_MANIFEST.csv  (Milestone 3)
        |
        v
scripts/build-data.js  -->  site/data/{records,search,taxonomy,comparisons,stats}.json
        |
        v
scripts/build-pages.js -->  site/{index,search,taxonomy,timeline,comparisons,about}.html
                              site/stories/hn-NNN.html  (1,056 pages)
                              site/assets/{style.css,app.js}
```

**Commands:**
- `node scripts/build-data.js` — prepare normalized data JSON.
- `node scripts/build-pages.js` — generate all static HTML pages.
- Re-running is idempotent: all outputs are overwritten from source; original source files under `D:\news` (and `old stuff/`) are never modified.

---

## 3. Deployment suitability

- **GitHub Pages:** Serve the `site/` directory (or copy its contents to the Pages publishing branch). Free, fits the existing GitHub ecosystem, no custom domains required.
- **Netlify:** Connect the GitHub repo; static output deploys on push. Free tier sufficient; no paid add-ons.
- **Neither requires a database, server process, or paid account.**

**Decision:** Do not publish until the user explicitly selects the target and authorizes deployment (spec §9, §14). Local building and preview are in scope; publication is not.

---

## 4. Performance and storage assumptions

- 1,056 records; `search.json` is small enough to load entirely in the browser for instant client-side search.
- `records.json` (~2.6 MB) contains full per-record text; detail pages are individual static files, so no single page loads the full corpus.
- Original scanned images are **not** stored locally; the site links to external archive viewers (honest "blocked"/"no scan" fallbacks where acquisition is restricted). This keeps storage minimal and avoids republishing rights-restricted media.

---

## 5. Risks

- **Archive bot protection:** Indiana (Veridian) and Library of Congress block automated fetches (HTTP 403). The site degrades to external source links with honest "blocked_access" status rather than fabricating images.
- **Modern copyrighted articles:** Guardian/WCAX/NY1 load but are rights-restricted; shown as citation + link only.
- **Mojibake in source OCR:** Some 18th–19th century OCR text arrived with UTF-8-as-Latin-1 corruption; a deterministic repair table fixes the most common sequences (`â€”` → `—`, etc.) in display text only; identifiers and URLs are never altered.
- **No server search:** Client-side search scans the JSON index; acceptable for 1,056 records but would need a different approach at much larger scale.

---

## 6. Compliance with spec

- Local-first, data-driven, statically generated (§9 architecture baseline).
- Repeatable import/build pipeline; portable normalized data files (§9).
- Existing GitHub/Netlify ecosystem; no new paid platform or database (§9, §14).
- No deployment without explicit user direction (§14).
- Original source files preserved unchanged; generated output separate from source data (§0, §13).
