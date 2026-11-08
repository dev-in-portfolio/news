# Historical Newspaper Discoveries — Taxonomy v1.0 Lock Record

**Status:** LOCKED — classification and category structure, not published  
**Locked on:** October 22, 2026 (America/New_York)  
**Corpus:** `Historical_Newspaper_Discoveries_1777-2026.md`  
**Scope:** 1,056 distinct records, HN-001 through HN-1056

## Authoritative version-one files

1. **Category tree:** `historical_taxonomy_v1_LOCKED.txt` — 13 first-level, 100 second-level, and 361 third-level categories.
2. **Record-by-record classification:** `Historical_Newspaper_Classification_v1_LOCKED.csv` — the 1,056 primary three-level routes, with original placements, decisions, qualifications and source URLs retained.

These are **byte-for-byte copies** of the reviewed `LOCK_CANDIDATE` files, retained separately for the audit trail. The source corpus and prior drafts were not modified by this lock.

## Lock validation

An independent parse of the locked tree and classification CSV confirmed:

| Check | Result |
| --- | ---: |
| First-level categories | 13 |
| Second-level categories | 100 |
| Third-level categories | 361 |
| Discovery rows | 1,056 |
| Unique discovery IDs | 1,056 |
| Missing IDs in HN-001–HN-1056 | 0 |
| Duplicate discovery IDs | 0 |
| Primary routes not found in the tree | 0 |
| Third-level categories containing at least one record | 245 |
| Third-level categories currently empty | 116 |

**Browse behavior:** Show populated leaves when displaying records. Keep the 116 empty leaves available in the underlying extensible taxonomy, but do not display them as populated categories. No browse interface was changed or published by this lock.

## Final review and editorial rules

- Fifty-one proposed labels received explicit decisions: 46 additions, four merges, and one broader replacement of an original leaf; the final reconciliation additionally included the evidence-backed policy debate category for HN-577.
- The concluding review examined 21 proposed singleton categories: 20 were retained for distinct subject matter, one was merged into existing wartime press-freedom coverage, and none were left awaiting a further decision.
- Stories whose genre was **editorial commentary** were classified principally by the subject of the story; three genuinely about journalism remained under journalism.
- Preserve qualifications for potentially contested reports, including HN-109, HN-577, HN-871, and HN-1053; category placement does not certify a newspaper allegation as true.
- A news brief containing two subjects may have one **primary** route and explanatory related-topic notes; the primary route need not imply that the two events were causally connected.
- Original accounts, citations, ambiguous evidence, and review rationales remain available for future corrections.

Supporting, preserved audit files:

- `Historical_Newspaper_Taxonomy_Decisions_LOCK_CANDIDATE.md`
- `Historical_Newspaper_Singleton_Final_Review.md`
- `reconcile_historical_taxonomy.mjs`

## Integrity hashes (SHA-256)

```text
5b8b7a65d2c390e4387b27e25f558e662b5807e0d7a7a07b31c0d254d58679d4  historical_taxonomy_v1_LOCKED.txt
a8754e921e08b7471b1ca872e3e3e424565bb4adcc5233c712eeb6ee8ec3ad02  Historical_Newspaper_Classification_v1_LOCKED.csv
bb8c4bd13c51a54c437b470242b3e553fcc8951bdae9ccda19898cd9403a209c  Historical_Newspaper_Taxonomy_Decisions_LOCK_CANDIDATE.md
2cef54bd98d804cb519beb03295841daa1ab3c115791e11cfa9427bedda39244  Historical_Newspaper_Singleton_Final_Review.md
```

## Change control

This lock freezes the version-one structure and placements as an identifiable baseline. Subsequent justified changes should be recorded in a versioned amendment (for example, v1.1) with specific HN IDs, before/after paths, evidence and a fresh validation; never silently overwrite the v1.0 locked files. This administrative lock does **not** publish a website or independently fact-check every historical news report.
