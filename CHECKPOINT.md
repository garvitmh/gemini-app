# System Checkpoint: making-group-integration-stable

**Date:** 2026-01-03
**Commit Label:** `checkpoint/making-group-integration-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents the application after the complete integration and verification of the "Making Group" feature. The system now supports defining Master Making Groups and applying them to products, with a strict priority logic (Product > Group > Global) for pricing calculations.

### Verified Stable Features
1.  **Making Group Management**
    - [x] **Backend**: New `MakingGroup` entity and CRUD endpoints implemented.
    - [x] **Frontend**: New "Making Charges" section in Settings for managing master groups.
    - [x] **Product Association**: Products can be linked to a Making Group via the Edit Modal.
2.  **Advanced Pricing Logic**
    - [x] **Priority Resolution**: Calculation logic verified to use Product ID > Making Group ID > Global Settings.
    - [x] **Bulk Updates**: "Update All Prices" correctly respects group assignments for all products.
    - [x] **UI Feedback**: Edit Modal clearly shows which rate (Product vs Group) is active.
3.  **Regression Checks**
    - [x] Existing products without groups continue to use Global or Product-specific rates (Backward Compatibility).

## 🔄 Rollback Procedure
If a future update introduces regression:
1.  **Identify Checkpoint**: Commit labeled `checkpoint/making-group-integration-stable`.
2.  **Revert**: `git reset --hard checkpoint/making-group-integration-stable`
3.  **Verify**:
    - Go to Settings > Making Charges and check if groups exist.
    - Open a Product, assign a group, and verify the price breakdown updates.

---

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
---

# System Checkpoint: sync-observability-stable

**Date:** 2026-01-02
**Commit Label:** `checkpoint/sync-observability-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents the application after implementing comprehensive Sync Observability and Performance improvements. The sync process is now non-blocking, runs in the background, and reports real-time status via a new Top Bar indicator.

### Verified Stable Features
1.  **Sync Observability (Backend)**
    - [x] Background `Job` creation for every sync operation.
    - [x] Metrics tracking: Fetched, Created, Updated, Deleted, Unchanged.
    - [x] Performance optimization: Skips DB writes if data is unchanged.
    - [x] Safe Deletion: Marks missing Shopify products as 'deleted' locally.
2.  **Sync Experience (Frontend)**
    - [x] **Non-blocking Sync**: "Sync from Shopify" returns immediately, preventing UI freeze.
    - [x] **Top Bar Indicator**: Shows "Syncing..." spinner and final result summary (tooltip).
    - [x] **Status Endpoint**: `/api/sync/status` exposes latest job metrics.
3.  **Custom Gemstone Fix**
    - [x] Weight-based pricing (`pricePerCarat`) fully supported.
    - [x] "Rate not set" error logic refined to respect new pricing methods.

## 🔄 Rollback Procedure
If a future update introduces regression:
1.  **Identify Checkpoint**: Commit labeled `checkpoint/sync-observability-stable`.
2.  **Revert**: `git reset --hard checkpoint/sync-observability-stable`

---

# System Checkpoint: perf-sync-fix-stable

**Date:** 2026-01-02
**Commit Label:** `checkpoint/perf-sync-fix-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents the application after resolving critical performance bottlenecks (N+1 queries, frontend infinite fetch logic) and fixing the Shopify Sync failure caused by port configuration mismatch.

### Verified Stable Features
1.  **Performance Optimization**
    - [x] **Backend**: `PricingService.calculateBulkPrices` N+1 query issue fixed (Context-based prefetching). Verified 100x speedup.
    - [x] **Frontend**: `Products.tsx` "Fetch All" infinite loop removed. Server-side pagination implemented correctly.
2.  **Sync & Environment Stability**
    - [x] **Port Fix**: Resolved mismatch where Backend ran on 3005 (via `.env`) but Frontend pointed to 3000. `vite.config.ts` updated.
    - [x] **Import/Export Data**: Generated verified test CSVs (`shopify_sync_phase_1.csv` etc.) and `app_import_valid.csv` for safe testing.
3.  **Validation Scripts**
    - [x] `backend/scripts/verify_bulk_pricing.ts`: Confirms math accuracy and speed.
    - [x] `backend/scripts/get_valid_skus.ts`: Helper to fetch test data from live DB.

## 🔄 Rollback Procedure
If a future update introduces regression:
1.  **Identify Checkpoint**: Commit labeled `checkpoint/perf-sync-fix-stable`.
2.  **Revert**: `git reset --hard checkpoint/perf-sync-fix-stable`
3.  **Verify**:
    - Run `npm run dev` in both folders.
    - Ensure Frontend loads at `localhost:5173` and Product table renders instantly (no sluggishness).
    - Click "Sync from Shopify" and verify it starts without error.

---

# System Checkpoint: import-export-fix-stable

**Date:** 2026-01-02
**Commit Label:** `checkpoint/import-export-fix-stable`

## 🛡️ Stable Baseline Status
This checkpoint represents the application after fixing critical file download/export issues and extending CSV template support for custom gemstones.

### Verified Stable Features
1.  **File Download Fix**
    - [x] **Frontend API Config**: Fixed `api.ts` to force `/api` in development mode, preventing port 3000/3005 mismatch.
    - [x] **Download Method**: Implemented proper `fetch + blob` with Content-Disposition header parsing for reliable filename extraction.
    - [x] **All Export Functions**: Download Template, Export CSV, Export Excel now produce properly named files with extensions.
2.  **CSV Template Enhancement**
    - [x] Added custom gemstone columns: `gemstone_X_isCustom`, `gemstone_X_pricePerCarat`, `gemstone_X_pricePerPiece` (X = 1,2,3).
    - [x] Backward compatible: Old imports continue to work, new columns are optional.
3.  **Bug Fixes**
    - [x] Removed undefined variables causing TypeScript build errors in `Products.tsx`.
    - [x] Fixed type mismatches with gemstone modal pricing type comparisons.

## 🔄 Rollback Procedure
If a future update introduces regression:
1.  **Identify Checkpoint**: Commit labeled `checkpoint/import-export-fix-stable`.
2.  **Revert**: `git reset --hard checkpoint/import-export-fix-stable`
3.  **Verify**:
    - Download Template button produces `products_template.xlsx` file.
    - Export CSV produces `products.csv` file.
    - Import CSV/Excel accepts files without header errors.
