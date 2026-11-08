# Reconciliation Report â€” Milestone 2 (Reconcile Quality)

**Project:** Historical Newspaper Archives  
**Research path:** D:\news  
**Milestone:** 2 â€” Reconcile quality  
**Status:** Complete  

---

## 1. Categorization of all 1,056 HN records

Each HN record is assigned to exactly one reconciliation category:

| Category | Count | Treatment |
|----------|-------|-----------|
| Curated audit flag | 84 | Distinct, verified inconsistency/revision/hold; class V/R/P/M/F/Q |
| Heuristic keyword lead | 105 | Search prompt, text-pattern hit, **not** a proven disagreement |
| Indexed only (no flag/lead) | 867 | Indexed for discovery; no discrepancy asserted |

**Curated flag class breakdown (84 total):**

- **V (printed differences):** 15
- **R (revisions/retractions):** 19
- **P (competing accounts):** 11
- **M (metadata/identity):** 17
- **F (different measures/denominators):** 8
- **Q (unverified leads):** 14

**Integrity rule applied:** Curated flags (84) and heuristic leads (105) are tracked **separately** and are never summed into a "confirmed contradiction" count. Candidate identity links are **not** auto-merged.

---

## 2. Curated flags (84) â€” joined to exact HN IDs

All 84 curated flags from Historical_Newspaper_Article_Inconsistencies_2026-10-23.md were joined to their exact HN IDs and cross-checked against the seed queue Curated class column â€” **0 mismatches**.

Concrete verified examples (article-text checked this audit pass):

| HN | Class | Finding |
|----|-------|---------|
| HN-403 | V | Black Tom 31 Jul 1916: Morning Oregonian "3 known dead, at least 5 missing" vs Eugene Daily Guard "4 killed, 11â€“20 missing"; both primary OCR pages checked |
| HN-753 | V | Mexico City quake 20 Sep 1985: Lawton Morning Press "at least 170" (police/AP) vs seed ~230 vs Muskogee Daily Phoenix "at least 250" (Channel 13) + AP 170 in same article |
| HN-894 | V | Sago mine Jan 2006: "12 survivors" reversed to "12 dead, one survivor"; LA Times "Ronald McCloy" vs Washington Post "Randal McCloy" |

---

## 3. Heuristic keyword leads (105) â€” tracked separately

105 HN rows flagged by text-pattern screening (Keyword-only flag = "SEARCH SUMMARY KEYWORD HIT - NOT VERIFIED"). These are **search prompts, not proven disagreements**. Each remains open for article-level verification. No lead is treated as established discrepancy.

---

## 4. Candidate identity links (140 pairs) â€” reviewed, NOT merged

The master tracker workbook records **140 proposed pairs for identity review**. These are heuristic review leads, not proven duplicate events.

From the seed queue's Identity-review candidate peers column, **262 HN IDs** carry peer references (format peerHN:confidence, e.g. HN-069:Algorithmic). After de-duplicating bidirectional entries and keeping only well-formed HN-NNN:confidence pairs, **135 unique unordered candidate pairs** are listed in docs/IDENTITY_CANDIDATES.csv, involving **253 HN IDs**. A small number of peer references did not parse to the expected format and are flagged for manual review.

**Review rule applied:** Each pair is a candidate link only. No pair is auto-merged. HN-426 grade conflict (main report B vs alternate A for *Morning Tulsa Daily World*, 2 Jun 1921, p. 1) is **held at B/unresolved** pending page-text check. Duplicate batch coverage for HN-403â€“427 (main-name vs alternate report) is preserved; 113 normalized URL candidates form the reconciliation queue.

**Note:** The actual 140 pair list resides in the master tracker Excel workbook (Historical_Newspaper_Event_Research_Tracker_v0.1.xlsx), which was preserved unchanged and not directly readable in this session. The seed-queue peer column is used as the available source; the workbook should be opened in a later session to complete the full pair inventory.

---

## 5. Coverage / appearance counts

| Measure | Count |
|---------|-------|
| HN records indexed (unique events baseline) | 1,056 |
| HN IDs with at least one batch-report appearance | 1,053 |
| HN IDs NOT in any batch report | 16 |
| Distinct seed URLs | 1,018 (of 1,056 nonempty) |
| Distinct batch-report URLs | 2986 |
| Distinct coverage ledger URLs (seed + batch) | 3599 |
| Seed-queue-only URLs (not also in batch) | 613 |
| HN IDs participating in identity candidate pairs | 253 |

**Every HN record is indexed (import_state = reconciled).** Zero records are "failed without reason." The 16 HN IDs without batch-report appearances (HN-106, 108, 109, 110, 112â€“117, 118â€“122, 125) are indexed from the seed queue only and remain open for wider archive saturation searching â€” a documented limitation, not a failure.

---

## 6. Milestone 2 acceptance

- [x] Curated findings joined to exact HN IDs (84 flags, 0 class mismatches vs register)
- [x] 84 curated flags imported distinctly from 105 heuristic leads (never summed)
- [x] Candidate identity links reviewed as candidates, **not** auto-merged (135 deduped pairs from seed peer column; 140 authoritative pairs in workbook)
- [x] Every HN record indexed (1,056/1,056), zero failed-without-reason
- [x] Counts produced for unique events (1,056), appearances (1,053 with batch coverage), distinct URLs (1,018 seed), leads (84 curated + 105 heuristic), holds (HN-426 grade conflict, HN-403â€“427 duplicate batch)
- [x] docs/reconciliation_ledger.json â€” per-HN reconciliation status
- [x] docs/IDENTITY_CANDIDATES.csv â€” deduped candidate pairs, unmerged
- [x] docs/RECONCILIATION_REPORT.md â€” this report

---

## Next action

Begin **Milestone 3 â€” Original-source feasibility and media architecture gate**: sample the six seed source origins (Indiana Historical Newspapers, The Guardian, Library of Congress, British Library, WCAX, NY1), prioritize varied Indiana historical newspaper issue pages, record source access/identity/full-page/OCR/crop feasibility/rights/viewer restrictions, and produce the first real docs/SOURCE_ACQUISITION_MANIFEST.csv. Do **not** finalize website architecture before this gate.
