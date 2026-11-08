# Import Inventory — Milestone 0 Baseline

**Project:** Historical Newspaper Archives  
**Package:** `Newspaper_Archives_OpenCode_Handoff_v2_2026-11-08.zip`  
**Research path:** `D:\news` (extracted `newspaper/` folder at repo root)  
**Milestone:** 0 — Inventory and baseline  
**Status:** Complete — all source files verified unchanged  

---

## 1. Source-package integrity

All **63 historical source files** were hash-verified against `SOURCE_CHECKSUMS.sha256`:

| Check | Result |
|-------|--------|
| Files checked | 63 / 63 |
| Hash matches | 63 / 63 |
| Mismatches / missing | 0 |
| Original files modified | None (read-only evidence preserved) |

`PACKAGE_MANIFEST.csv` lists **66 entries**: 63 `historical_source`, 1 `handoff_spec`, 1 `integrity_file`, 1 `startup_instructions`. The manifest does not list or hash itself; the extracted folder contains **67 files** total.

File roles:
- **2 final files (top level):** `Historical_Newspaper_Article_Inconsistencies_2026-10-23.md`, `Historical_Newspaper_Inconsistency_Screening_1056_2026-10-23.csv`
- **61 prior/working files:** under `old stuff/`
- **3 packaging/support files:** `START_HERE.md`, `PACKAGE_MANIFEST.csv`, `SOURCE_CHECKSUMS.sha256` (instructions/integrity records, not historical evidence)

---

## 2. Dataset checkpoint — 1,056 HN records

| Measure | Recorded status | Notes |
|---------|----------------|-------|
| HN seed records | 1,056 | HN-001 through HN-1056, 0 missing, 0 duplicates |
| Distinct HN IDs | 1,056 | Continuous HN-001…HN-1056 |
| Nonempty seed URLs | 1,056 | One per record |
| Distinct seed URL strings | 1,018 | 38 URL strings repeat across records |
| Saved research batch reports | 44 docs / 43 distinct intervals | HN-403–427 saved twice (accidental duplicate) |
| Distinct HN batch intervals | 43 | All 1,056 IDs have a range document |
| Curated audit flags | 84 | V=15, R=19, P=11, M=17, F=8, Q=14 |
| Keyword-only screening leads | 105 | Search prompts, not proven disagreements |
| Candidate identity pairs | 140 | Unresolved links, not automatic merges |

**Seed URL origin distribution:** Indiana Historical Newspapers 905, The Guardian 94, Library of Congress 53, British Library 2, WCAX 1, NY1 1.

**Evidence tiers (from screening CSV):** A=47, A+B=12, A+index=1, A+retro=5, A-direct=1, B=14, C=4; 972 rows have no tier recorded (early P/I/N nomenclature to be mapped only after explicit review).

---

## 3. Locked taxonomy (v1.0)

| Check | Result |
|-------|--------|
| First-level categories | 13 |
| Second-level categories | 100 |
| Third-level categories | 361 |
| Discovery rows classified | 1,056 |
| Missing IDs (HN-001–HN-1056) | 0 |
| Duplicate IDs | 0 |
| Populated third-level leaves | 245 |
| Empty third-level leaves | 116 (retained in schema, not displayed as populated) |

Classification decision statuses: `existing` 888, `proposal:add` 127, `proposal:merge` 7, `proposal:broaden` 5, `editorial:subject-reroute` 21, `editorial:media-topic` 3, `held:qualified-route` 4, `broadened-original-leaf` 1.

---

## 4. Full file inventory

All 67 files present under `D:\news`:

### Root (6 files)

| File | Role | Size | Status |
|------|------|------|--------|
| `START_HERE.md` | startup_instructions | 5,808 | Verified |
| `Newspaper_Archives_OpenCode_Handoff_v2.md` | handoff_spec | 48,958 | Verified |
| `PACKAGE_MANIFEST.csv` | integrity_file (manifest) | 10,612 | Verified |
| `SOURCE_CHECKSUMS.sha256` | integrity_file | 8,315 | Verified |
| `Historical_Newspaper_Article_Inconsistencies_2026-10-23.md` | historical_source (final) | 50,064 | Verified |
| `Historical_Newspaper_Inconsistency_Screening_1056_2026-10-23.csv` | historical_source (final) | 336,919 | Verified |

### `old stuff/` (61 files)

| File | Role | Size | Status |
|------|------|------|--------|
| `Historical_Newspaper_Classification_DRAFT.csv` | historical_source | 361,752 | Verified |
| `Historical_Newspaper_Classification_LOCK_CANDIDATE.csv` | historical_source | 418,485 | Verified |
| `Historical_Newspaper_Classification_v1_LOCKED.csv` | historical_source | 418,485 | Verified |
| `Historical_Newspaper_Cross_Thread_Reconciliation_2026-10-23.md` | historical_source | 25,015 | Verified |
| `Historical_Newspaper_Discoveries_1777-2026.md` | historical_source | 967,559 | Verified |
| `Historical_Newspaper_Event_Research_001-025_screening_2026-10-23.md` | historical_source | 17,451 | Verified |
| `Historical_Newspaper_Event_Research_026-052_Consolidated_2026-10-23.md` | historical_source | 49,356 | Verified |
| `Historical_Newspaper_Event_Research_053-077_2026-10-22.md` | historical_source | 12,591 | Verified |
| `Historical_Newspaper_Event_Research_078-102_2026-10-22.md` | historical_source | 20,934 | Verified |
| `Historical_Newspaper_Event_Research_1003-1027_2026-10-23.md` | historical_source | 28,585 | Verified |
| `Historical_Newspaper_Event_Research_1028-1052_2026-10-23.md` | historical_source | 26,711 | Verified |
| `Historical_Newspaper_Event_Research_103-127_2026-10-22.md` | historical_source | 14,660 | Verified |
| `Historical_Newspaper_Event_Research_1053-1056_2026-10-23.md` | historical_source | 17,401 | Verified |
| `Historical_Newspaper_Event_Research_128-152_2026-10-22.md` | historical_source | 15,352 | Verified |
| `Historical_Newspaper_Event_Research_153-177_2026-10-22.md` | historical_source | 19,265 | Verified |
| `Historical_Newspaper_Event_Research_178-202_2026-10-22.md` | historical_source | 26,167 | Verified |
| `Historical_Newspaper_Event_Research_203-227_2026-10-22.md` | historical_source | 26,541 | Verified |
| `Historical_Newspaper_Event_Research_228-252_2026-10-22.md` | historical_source | 33,678 | Verified |
| `Historical_Newspaper_Event_Research_253-277_2026-10-22.md` | historical_source | 34,528 | Verified |
| `Historical_Newspaper_Event_Research_278-302_2026-10-22.md` | historical_source | 31,141 | Verified |
| `Historical_Newspaper_Event_Research_303-327_2026-10-23.md` | historical_source | 31,002 | Verified |
| `Historical_Newspaper_Event_Research_328-352_2026-10-23.md` | historical_source | 35,919 | Verified |
| `Historical_Newspaper_Event_Research_353-377_2026-10-23.md` | historical_source | 36,515 | Verified |
| `Historical_Newspaper_Event_Research_378-402_2026-10-23.md` | historical_source | 34,713 | Verified |
| `Historical_Newspaper_Event_Research_403-427_2026-10-23(1).md` | historical_source | 22,335 | Verified |
| `Historical_Newspaper_Event_Research_403-427_2026-10-23.md` | historical_source | 30,760 | Verified |
| `Historical_Newspaper_Event_Research_428-452_2026-10-23.md` | historical_source | 21,698 | Verified |
| `Historical_Newspaper_Event_Research_453-477_2026-10-23.md` | historical_source | 25,590 | Verified |
| `Historical_Newspaper_Event_Research_478-502_2026-10-23.md` | historical_source | 27,190 | Verified |
| `Historical_Newspaper_Event_Research_503-527_2026-10-23.md` | historical_source | 33,401 | Verified |
| `Historical_Newspaper_Event_Research_528-552_2026-10-23.md` | historical_source | 23,011 | Verified |
| `Historical_Newspaper_Event_Research_553-577_2026-10-23.md` | historical_source | 30,009 | Verified |
| `Historical_Newspaper_Event_Research_578-602_2026-10-23.md` | historical_source | 30,889 | Verified |
| `Historical_Newspaper_Event_Research_603-627_2026-10-23.md` | historical_source | 26,029 | Verified |
| `Historical_Newspaper_Event_Research_628-652_2026-10-23.md` | historical_source | 28,940 | Verified |
| `Historical_Newspaper_Event_Research_653-677_2026-10-23.md` | historical_source | 26,484 | Verified |
| `Historical_Newspaper_Event_Research_678-702_2026-10-23.md` | historical_source | 28,683 | Verified |
| `Historical_Newspaper_Event_Research_703-727_2026-10-23.md` | historical_source | 30,698 | Verified |
| `Historical_Newspaper_Event_Research_728-752_2026-10-23.md` | historical_source | 30,213 | Verified |
| `Historical_Newspaper_Event_Research_753-777_2026-10-23.md` | historical_source | 32,635 | Verified |
| `Historical_Newspaper_Event_Research_778-802_2026-10-23.md` | historical_source | 23,195 | Verified |
| `Historical_Newspaper_Event_Research_803-827_2026-10-23.md` | historical_source | 32,558 | Verified |
| `Historical_Newspaper_Event_Research_828-852_2026-10-23.md` | historical_source | 26,716 | Verified |
| `Historical_Newspaper_Event_Research_853-877_2026-10-23.md` | historical_source | 30,306 | Verified |
| `Historical_Newspaper_Event_Research_878-902_2026-10-23.md` | historical_source | 32,091 | Verified |
| `Historical_Newspaper_Event_Research_903-927_2026-10-23.md` | historical_source | 29,893 | Verified |
| `Historical_Newspaper_Event_Research_928-952_2026-10-23.md` | historical_source | 32,433 | Verified |
| `Historical_Newspaper_Event_Research_953-977_2026-10-23.md` | historical_source | 30,131 | Verified |
| `Historical_Newspaper_Event_Research_978-1002_2026-10-23.md` | historical_source | 27,235 | Verified |
| `Historical_Newspaper_Event_Research_Tracker_v0.1.xlsx` | historical_source | 191,276 | Verified (workbook, not opened for edit) |
| `Historical_Newspaper_Singleton_Final_Review.md` | historical_source | 8,739 | Verified |
| `Historical_Newspaper_Taxonomy_Audit_DRAFT.md` | historical_source | 42,640 | Verified |
| `Historical_Newspaper_Taxonomy_Audit_Data.json` | historical_source | 2,161,369 | Verified |
| `Historical_Newspaper_Taxonomy_Decisions_LOCK_CANDIDATE.md` | historical_source | 24,673 | Verified |
| `Historical_Newspaper_Taxonomy_v1_LOCK_RECORD.md` | historical_source | 3,911 | Verified |
| `audit_historical_taxonomy.mjs` | historical_source | 70,373 | Verified |
| `historical_taxonomy_LOCK_CANDIDATE.txt` | historical_source | 12,182 | Verified |
| `historical_taxonomy_manual_review.txt` | historical_source | 25,117 | Verified |
| `historical_taxonomy_proposed_revision.txt` | historical_source | 11,818 | Verified |
| `historical_taxonomy_v1_LOCKED.txt` | historical_source | 12,182 | Verified |
| `reconcile_historical_taxonomy.mjs` | historical_source | 31,024 | Verified |

---

## 5. Known reconciliations / open items carried forward

- **HN-403–427 duplicate batch:** Two saved reports exist (`…403-427_2026-10-23.md` main, `…403-427_2026-10-23(1).md` alternate). 113 normalized URL candidates across them; 22 pages appear in both, 49 main-only, 42 alternate-only. **Do not de-duplicate automatically.** Reconciliation queue reserved for Milestone 2.
- **HN-426 grade conflict:** Main report = B, alternate = A for *Morning Tulsa Daily World*, 2 June 1921, p. 1. Held at B/unresolved pending page-text check.
- **HN-026–052:** 27 IDs lack a separate range-named report but were researched in the master tracker's Search log / Coverage finds (69 rows: 27 baseline + 42 leads). **Do not redo that work.**
- **10 pilot event packets** (11 HN rows) exist as planned follow-on to exploratory pilots, not evidence of whole-batch repetition.
- Source files must remain unchanged; generated datasets/indexes/ledgers go in a separate output tree (not the source directory).

---

## 6. Milestone 0 acceptance

- [x] All 63 research files hash-verified against `SOURCE_CHECKSUMS.sha256` (0 mismatches)
- [x] Package paths verified against `PACKAGE_MANIFEST.csv` (66 entries)
- [x] 1,056 HN IDs confirmed (HN-001–HN-1056), 0 missing, 0 duplicates
- [x] 1,056 nonempty / 1,018 distinct seed URLs confirmed
- [x] Locked taxonomy confirmed (13 roots / 100 subs / 361 leaves; 1,056 rows classified)
- [x] `docs/IMPORT_INVENTORY.md` produced (this file)
- [x] Machine-readable import inventory produced (`docs/import_inventory.json`)
- [x] No original source files modified

**Next action:** Begin **Milestone 1 — Canonical extraction** (extract source references from seed CSV, workbook, Markdown reports; build structured dataset and per-record ingestion ledger for all 1,056 HN IDs; establish search coverage ledger).

---
