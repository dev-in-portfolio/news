# Extraction Summary â€” Milestone 1 (Canonical Extraction)

**Research path:** D:\news  
**Milestone:** 1 â€” Canonical extraction  
**Status:** Complete

## Inputs processed

| Input | Records/items |
|-------|---------------|
| Seed queue CSV (Historical_Newspaper_Inconsistency_Screening_1056_2026-10-23.csv) | 1,056 HN rows |
| Locked taxonomy CSV (old stuff\Historical_Newspaper_Classification_v1_LOCKED.csv) | 1,056 classification rows |
| Curated inconsistency audit (Historical_Newspaper_Article_Inconsistencies_2026-10-23.md) | 84 registered rows |
| Discoveries ledger (old stuff\Historical_Newspaper_Discoveries_1777-2026.md) | 941 HN entries |
| Batch reports (old stuff\Historical_Newspaper_Event_Research_*.md) | 44 files |

## Curated class distribution (from seed queue)

V (printed differences): 15  
R (revisions/retractions): 19  
P (competing accounts): 11  
M (metadata/identity): 17  
F (different measures/denominators): 8  
Q (unverified leads): 14  
(blank / not curated): 972  
**Total curated flags: 84**

## Evidence tier distribution (from seed queue)

A: 47  
A+B: 12  
A+index: 1  
A+retro: 5  
A-direct: 1  
B: 14  
C: 4  
(blank): 972

## Coverage

- HN IDs appearing in at least one batch report: 1053 / 1,056
- HN IDs NOT in any batch report: 16
- HN IDs with batch table entries: 281
- Unique source URLs extracted from batch reports: 2986
- Seed URLs (authoritative baseline): 1,056 (1,018 distinct)
- Total coverage ledger entries: 3599

## Outputs

| File | Description |
|------|-------------|
| docs/ingestion_ledger.json | Per-record structured ledger for all 1,056 HN IDs |
| docs/COVERAGE_SEARCH_LEDGER.csv | All extracted source URLs with HN/file/context |
| docs/DATA_SCHEMA.md | Data model and field documentation |
| docs/EXTRACTION_SUMMARY.md | This file |

## Milestone 1 acceptance

- [x] Source references extracted from seed CSV, taxonomy, audit, discoveries, and all 44 batch reports
- [x] Event candidates and article appearances extracted with source-file pointers
- [x] Dates and publication names retained as original strings (no destructive normalization)
- [x] Duplicate reference URLs identified (1,018 distinct of 1,056 seed URLs); independently published appearances not collapsed
- [x] Structured dataset generated (docs/ingestion_ledger.json)
- [x] Per-record ingestion ledger produced for all 1,056 HN IDs
- [x] Search coverage ledger established (docs/COVERAGE_SEARCH_LEDGER.csv)
- [x] docs/DATA_SCHEMA.md produced

## Next action

Begin **Milestone 2 â€” Reconcile quality**: join curated findings to exact HN IDs, import 84 flags distinctly from 105 heuristic leads, review the 140 candidate identity links without auto-merging, and produce counts for unique events, appearances, distinct URLs, scans, leads and holds.
