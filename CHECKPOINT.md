# System Checkpoint: products-ui-stable

**Date:** 2025-12-26
**Commit Label:** `checkpoint/products-ui-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents a fully tested and stable state of the Products module.

### Verified Stable Features
1.  **Product List UI**
    - [x] Parent grouping with clean visual hierarchy
    - [x] Correct sequential numbering (# column)
    - [x] "X variants" badge with correct tone
    - [x] Single-expand accordion behavior
2.  **Filtering & Pagination**
    - [x] Status Filter (All/Active/Draft) works and resets pagination
    - [x] Pagination remains at 50 groups/page
    - [x] Grouping reconstructs dynamic parent groups based on filtered children
3.  **Actions**
    - [x] Download Template (Accurate columns & sample)
    - [x] Import CSV/Excel (Correct Base64 JSON payload)
    - [x] Export CSV (Working backend endpoint)
    - [x] Export Excel (Working backend endpoint)
4.  **Edit Flow**
    - [x] Price Breakdown panel visible with fail-safe context

## 🔄 Rollback Procedure

If a future update introduces regression:

1.  **Identify Checkpoint**
    - Find the commit labeled `checkpoint/products-ui-stable` via `git log`.
2.  **Revert**
    - Run: `git reset --hard <commit-hash>` (CAUTION: Destructive to uncommitted changes)
    - OR: `git revert <bad-commit-hashes>` (Safe for shared branches)
3.  **Verify**
    - Reload Products page.
    - Check Filter -> Active.
    - Click "Download Template".
    - Edit a product to see Price Breakdown.
4.  **Cleanup**
    - No database migration rollbacks are required for UI-only changes.

## 🚧 Change Rules (Going Forward)
- **Experiments**: Must be isolated in separate branches or commits starting with `experiment/`.
- **Guards**: Use `frontend/src/config/features.ts` (if created) for toggles.
- **Do Not Mix**: UI polish and Logic fixes in the same commit.
