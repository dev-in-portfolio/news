# Data Schema â€” Historical Newspaper Archives (Milestone 1)

**Source:** `Historical_Newspaper_Inconsistency_Screening_1056_2026-10-23.csv` (seed queue),  
`old stuff\Historical_Newspaper_Classification_v1_LOCKED.csv` (taxonomy),  
`Historical_Newspaper_Article_Inconsistencies_2026-10-23.md` (curated audit),  
`old stuff\Historical_Newspaper_Discoveries_1777-2026.md` (discoveries),  
`old stuff\Historical_Newspaper_Event_Research_*.md` (44 batch reports).

## Core entity: ResearchRecord (ingestion_ledger.json)

One row per HN ID (1,056 records, HN-001 through HN-1056). Fields preserved verbatim from the seed queue
plus enrichment from taxonomy, audit, discoveries, and batch reports.

| Field | Source | Description |
|-------|--------|-------------|
| hn_id | seed queue | Stable original HN identifier (HN-001â€¦HN-1056) |
| seed_heading | seed queue | Seed newspaper heading / working title |
| seed_publication_date | seed queue | Seed publication date (original string, not normalized) |
| seed_url | seed queue | Original seed URL, preserved verbatim |
| saved_research_report | seed queue | Batch report file covering this HN ID |
| curated_class | seed queue | Curated inconsistency class (V/R/P/M/F/Q) or blank |
| recorded_finding | seed queue | Recorded finding from audit |
| evidence_tier | seed queue | Evidence tier (A/B/C or early P/I/N) or blank |
| keyword_only_flag | seed queue | Keyword-only screening flag or blank |
| identity_review_peers | seed queue | Identity-review candidate peers or blank |
| audit_status | seed queue | Audit status text |
| taxonomy_root / taxonomy_sub / taxonomy_leaf | locked taxonomy | Locked v1.0 three-level category route |
| decision_status | locked taxonomy | Classification decision status (existing/proposal:add/â€¦) |
| genre_or_evidence | locked taxonomy | Genre or evidence annotation |
| rationale | locked taxonomy | Classification rationale |
| link | locked taxonomy | Source link retained from classification |
| audit_class | inconsistency audit | Curated audit class (V/R/P/M/F/Q) |
| audit_finding / audit_assessment / audit_prior_evidence / audit_source_links | inconsistency audit | Curated audit detail |
| discovery_title / discovery_body | discoveries ledger | Discovery narrative for this HN ID |
| batch_entries_count | batch reports | Number of batch table entries for this HN ID |
| batch_summary | batch reports | Concatenated batch table rows (JSON) |
| in_batch_reports | derived | "yes"/"no" â€” whether HN ID appears in any batch report |
| import_state | derived (Milestone 1) | Baseline: "indexed" |
| import_notes | derived | Provenance note |

## Related entities

- **Event**: derived in Milestone 2; links one or more HN IDs via `EventRecordLink`. No irreversible auto-merge.
- **Publication**: newspaper name, variants, city/region, archive identifiers.
- **ArticleAppearance**: one per newspaper appearance; links to Event(s) and Publication; retains original headline, issue date, page, first URL, evidence tier.
- **SourceReference**: exact URL, source kind, discovered-in file/location, access outcome, rights/access status.
- **ImageAsset**: related appearance/source, original page URL, local asset or external viewer link, checksum, dimensions, crop geometry, status, attribution, rights basis.
- **ArticleText**: OCR/raw/transcription, source, text-review status, confidence (machine OCR separate from reviewed text).
- **Claim**: statement/value, measure/unit/denominator, attributed speaker/source, article appearance, supporting passage.
- **Comparison**: related claims/appearances, type V/R/P/M/F/Q, explained/unresolved status, evidence pointers.

## Integrity rules

- Original seed URLs are never rewritten; redirects normalized only in a separate canonical-link field.
- HN IDs are immutable; HN-001 through HN-1056 all present, 0 missing, 0 duplicates.
- Curated flags (84) and heuristic leads (105) tracked separately; never summed into a "confirmed contradiction" count.
- Candidate identity pairs (140) are unresolved links, not automatic merges.
- Source files under the extracted `newspaper/` tree are read-only; all generated data lives under `docs/`.

## Outputs

- `docs/ingestion_ledger.json` â€” machine-readable per-record ledger (1,056 records)
- `docs/COVERAGE_SEARCH_LEDGER.csv` â€” search coverage ledger (all extracted URLs)
- `docs/IMPORT_INVENTORY.md` â€” Milestone 0 package integrity (see Milestone 0)
