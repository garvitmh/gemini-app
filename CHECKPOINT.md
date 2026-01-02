# System Checkpoint: custom-gemstone-fix-stable

**Date:** 2026-01-02
**Commit Label:** `checkpoint/custom-gemstone-fix-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents the application after fixing the "Rate not set" error for Custom Gemstones. The system now supports both Weight-based (Price/Carat) and Piece-based (Price/Piece) pricing for custom gems in both backend logic and frontend UI.

### Verified Stable Features
1.  **Custom Gemstone Logic**
    - [x] Backend `server-simple.ts` supports `pricePerCarat` calculation.
    - [x] Backend handles fallback to `pricePerPiece` correctly.
    - [x] Frontend `Products.tsx` UI adds "Pricing Method" toggle.
    - [x] Frontend validates and sends correct price/weight data.
2.  **Regression Checks**
    - [x] Standard gemstone pricing remains unaffected.
    - [x] Existing products with piece-based custom gems load correctly.

## 🔄 Rollback Procedure
If a future update introduces regression:
1.  **Identify Checkpoint**: Commit labeled `checkpoint/custom-gemstone-fix-stable`.
2.  **Revert**: `git reset --hard checkpoint/custom-gemstone-fix-stable`
3.  **Verify**: Open "Add Gemstone", check "Custom Gemstone", and ensure "Pricing Method" toggle exists.

---

# System Checkpoint: pre-massive-audit-baseline

**Date:** 2026-01-02
**Commit Label:** `checkpoint/pre-massive-audit-baseline`

## 🛡️ Stable Baseline Status
This checkpoint represents the application baseline after a comprehensive feature audit. It captures the current stable state of all core jewelry management modules, pricing logic, and Shopify integrations before any further large-scale modifications.

### Verified Stable Features
1.  **Full Feature Audit Completed**
    - [x] All backend routes (Rates, Products, Settings, Automation) documented.
    - [x] Core pricing service math verified (Karat-conversions, Wastage, Making charges).
    - [x] Shopify Sync (Pagination & Bulk Ops) confirmed stable.
2.  **Frontend State**
    - [x] Dashboard live rate display verified.
    - [x] Rates Management for Metals, Stones, and Enamels verified.
    - [x] Product Editor with real-time price preview verified.
3.  **Integration State**
    - [x] Liquid template `SHOPIFY-LIQUID-COMPLETE.liquid` is current.
    - [x] DB Schema matches current models (Audit, History, Jobs).

## 🔄 Rollback Procedure
If a future update introduces regression:
1.  **Identify Checkpoint**: Commit labeled `checkpoint/pre-massive-audit-baseline`.
2.  **Revert**: `git reset --hard checkpoint/pre-massive-audit-baseline`
3.  **Verify**: Reload the Dashboard and check if Live Rates populate correctly.

---

# System Checkpoint: discount-breakdown-fix-stable

**Date:** 2025-12-29
**Commit Label:** `checkpoint/discount-breakdown-fix-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents the application after implementing the fix for Price Breakdown discrepancies. The backend now correctly interprets discount overrides from the frontend, and the frontend sends the complete discount payload.

### Verified Stable Features
1.  **Price Calculation Engine**
    - [x] Backend `/calculate-price` endpoint updated to accept `metalDiscountType`, `makingDiscountType`, `gemstoneDiscountType`, etc.
    - [x] `server-simple.ts` correctly applies these overrides during preview calculation.
    - [x] Forensic logging added to `calculateProductPrice` for detailed discount tracing.
2.  **Frontend Price Breakdown**
    - [x] "Edit Product" modal sends all current discount field states to backend.
    - [x] Strikethrough and "Sale" badges logic aligned with Shopify store design.
    - [x] Subtotal and Final Price calculations match website logic.

## 🔄 Rollback Procedure

If a future update introduces regression:

1.  **Identify Checkpoint**
    - Find the commit labeled `checkpoint/discount-breakdown-fix-stable`.
2.  **Revert**
    - usage: `git reset --hard <commit-hash>`
3.  **Verify**
    - Open "Edit Product" for a discounted item.
    - Check Price Breakdown for "Sale" badges and correct total.
---

# System Checkpoint: shopify-sync-fix-stable

**Date:** 2025-12-29
**Commit Label:** `checkpoint/shopify-sync-fix-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents the application after resolving the Shopify sync infinite loop (pagination fix) and the persistent UI loading issue (database contention fix).

### Verified Stable Features
1.  **Shopify Product Sync**
    - [x] Correct GraphQL pagination using `after` cursor
    - [x] `MAX_PAGES` safety guard to prevent infinite loops
    - [x] Efficient fetching of all variants without redundancy
2.  **UI & Backend Stability**
    - [x] Resolved "Persistent Loading" spinner by clearing DB locks
    - [x] Backend port 3005 health check verified
    - [x] Frontend port 5173 dashboard verified with live rates
3.  **Forensic Auditing**
    - [x] `pushToShopify` forensic logs capture variant ownership and API responses
    - [x] `forensic_diagnostic.log` correctly records sync steps

---

# System Checkpoint: import-pipeline-stable

**Date:** 2025-12-29
**Commit Label:** `checkpoint/import-pipeline-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents the application after a successful forensic audit and fix of the import pipeline. All Shopify actions (Template, Export, Import) are fully verified with real data.

### Verified Stable Features
1.  **Forensic Diagnostic Pipeline**
    - [x] Hard-fail with explicit row/column error reporting
    - [x] Header contract assertion (case-sensitive)
    - [x] Required field validation (SKU, metal, karat, weight)
2.  **Import/Export Precision**
    - [x] Correct `multipart/form-data` handling in frontend and backend
    - [x] Precision numeric parsing (no `NaN` crashes)
    - [x] Real SKU lookups (no orphan data)
    - [x] Safe instructional row skipping (Example/Note rows)
3.  **Gemstone Reconstruction**
    - [x] Automatic detection of expanded columns vs JSON
    - [x] Accurate rebuild of gemstone arrays during import
    - [x] Backward compatibility for existing products

---

# System Checkpoint: app-running-stable

**Date:** 2025-12-29
**Commit Label:** `checkpoint/app-running-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents the application running stably on local host with backend (3005) and frontend (5173).

### Verified Stable Features
1.  **Environment Connectivity**
    - [x] Backend running on port 3005
    - [x] Frontend running on port 5173
    - [x] SQLite database initialized and seeded
2.  **Product List UI**

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
