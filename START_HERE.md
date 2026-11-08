# Historical Newspaper Archives — Start Here (OpenCode, Windows)

**Package:** `Newspaper_Archives_OpenCode_Handoff_v2_2026-11-08.zip`  
**Implementation instructions:** `Newspaper_Archives_OpenCode_Handoff_v2.md`  
**Status:** Research and website build handoff; the original article screenshots have **not** already been acquired as a finished image collection. No website has yet been built or deployed.

## What you have

- **63 original research files**: two final files in this folder and 61 earlier, important research files under `old stuff/`.
- One self-contained **v2 product/build specification** describing the website, authentic newspaper media, evidentiary cautions, implementation stages, and test gates.
- `PACKAGE_MANIFEST.csv`: expected relative filenames, roles, sizes and SHA-256 values.
- `SOURCE_CHECKSUMS.sha256`: baseline SHA-256 values for the 63 unmodified source research files.

The package manifest lists **66 other files** (63 originals, two instructions, one source-checksum file); it intentionally does not list or hash itself. The extracted `newspaper/` folder therefore contains **67 files** total.

The research includes 1,056 numbered HN source records and their original seed URLs; those records are **not** necessarily 1,056 distinct historical events or verified article screenshots. The source directories and original files must remain unchanged during development.

## 1. Download and extract on Windows

If the ZIP was downloaded to your usual Downloads folder, paste this into PowerShell. It creates a new folder beside the ZIP; if a same-named extraction folder already exists, it stops so existing work cannot be overwritten.

```powershell
$zipPath = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads\Newspaper_Archives_OpenCode_Handoff_v2_2026-11-08.zip'
if (-not (Test-Path -LiteralPath $zipPath -PathType Leaf)) { throw "ZIP not found. Set `$zipPath to its actual downloaded location." }
$extractTo = Join-Path (Split-Path -Parent $zipPath) 'Newspaper_Archives_OpenCode_Handoff_v2_2026-11-08'
if (Test-Path -LiteralPath $extractTo) { throw "Extraction folder already exists: $extractTo. Choose a different name before extracting." }
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractTo
$researchPath = (Resolve-Path -LiteralPath (Join-Path $extractTo 'newspaper')).Path
$researchPath
$researchPath | Set-Clipboard
```

`$researchPath` is the exact absolute path to give OpenCode, and the last command copies it to your clipboard. If your browser saved the ZIP elsewhere, edit only `$zipPath` to its real file path. If necessary, locate the ZIP with:

```powershell
Get-ChildItem -Path (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads') -Filter '*Newspaper_Archives_OpenCode_Handoff_v2*.zip' -File -Recurse | Select-Object -ExpandProperty FullName
```

## 2. Optional source-integrity check in PowerShell

Run after extraction in the same PowerShell session. This verifies all 63 research files against the source manifest (it does not modify them):

```powershell
$sourceRows = Import-Csv -LiteralPath (Join-Path $researchPath 'PACKAGE_MANIFEST.csv') | Where-Object { $_.role -eq 'historical_source' }
$failures = @($sourceRows | Where-Object {
    $candidate = Join-Path $researchPath ($_.relative_path -replace '/', '\')
    -not (Test-Path -LiteralPath $candidate -PathType Leaf) -or
    (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLowerInvariant() -ne $_.sha256
})
"Verified original source files: $($sourceRows.Count - $failures.Count) / $($sourceRows.Count)"
if ($failures.Count -gt 0) { $failures | Select-Object relative_path; throw 'Missing or changed sources detected.' }
```

## 3. Give OpenCode this instruction

Substitute your copied absolute `$researchPath` for the bracketed path:

> Build our Historical Newspaper Archives website using the extracted research package at `[PASTE_ABSOLUTE_PATH_HERE]`. First read `START_HERE.md` and the entire `Newspaper_Archives_OpenCode_Handoff_v2.md`. Inventory and hash-verify all 63 original research files without modifying them; import and reconcile all 1,056 HN records and the locked taxonomy. Follow the specified source-first sequence: test authentic original newspaper images from the archive providers, make the source acquisition/rights/crop ledger, then build three end-to-end local reference stories (Black Tom, Mexico City earthquake, and Sago). Only after the real-image and viewer feasibility gate, build the complete searchable archive and continue systematic media acquisition. Keep actual counts, evidence tiers, URLs, review notes, reproducible tests and a durable progress ledger. Do not invent newspaper screenshots, cite uninspected article bodies as checked, or modify/deploy an existing website without my explicit direction.

## 4. Working rules and outcomes

- OpenCode can work with local file paths. You do not need to attach the package to the OpenCode chat.
- Create a separate implementation/output project; **do not write generated files into the original source-data directory**.
- A working initial preview is not the same as a completely researched archive; always show verified/partial/blocked states.
- Modern articles may require external source links rather than republished screenshots; respect rights and authentication boundaries.
- At major milestones, request an inventory, changed-file summary, real test results, source-image acquisition counts and the next action.
- No live deployment has been authorized. A later possible URL is `darkstarconsultinggroup.com/newspaper-archives`, but it is not an established deployment target.

For the comprehensive source hierarchy, product vision, data model, media pipeline, milestones and tests, the **v2 handoff specification is authoritative**.
