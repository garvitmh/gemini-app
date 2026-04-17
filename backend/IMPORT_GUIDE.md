# Quick Reference: Excel Import Fix

## What Was Fixed

1. ✅ **Price calculations now work** - When products have complete data (metal, weight, karat)
2. ✅ **Shopify breakdowns now sync** - Price breakdown HTML pushed to `custom.price_breakdown` metafield

## Before You Import

### Run Validation
```bash
cd backend
node validate-import-requirements.js
```

This checks:
- Shop settings configured
- Metal rates exist
- Products have required data
- Test calculation works

### Fix Common Issues

**No metal rates?**
→ Add them in Settings > Metal Rates

**Products missing data?**
→ Your Excel file MUST include:
- Metal Type (e.g., "gold")
- Metal Purity (e.g., 22 for 22K)
- Metal Weight (g) (e.g., 10.5)
- Wastage % (e.g., 2)
- GST % (e.g., 3)

## Excel File Format

Required columns for calculation to work:
```
SKU                 ← Must match existing product
Metal Type          ← gold, silver, platinum
Metal Purity        ← 22, 18, 14 (karat)
Metal Weight (g)    ← 10.5
Wastage %           ← 2
GST %               ← 3
```

Optional columns:
```
Stone 1: Used       ← TRUE/FALSE
Stone 1: Type       ← diamond, ruby, etc.
Stone 1: Weight (ct)
... (up to 3 stones)
Enamel Color
Enamel Weight (g)
Discount Type       ← flat, percent, none
Discount Value
```

## Import Process

1. **Prepare Excel** - Use template or ensure columns match format
2. **Import** - Click Import button, select file
3. **Wait** - System will:
   - Update product data
   - Calculate prices
   - Generate breakdowns
   - Push to Shopify (price + breakdown HTML)
4. **Check Results** - Review import summary for errors

## Verify It Worked

### Check Backend Logs
Look for:
```
[IMPORT] ✓ Shopify sync successful for SKU-123
[IMPORT] ✓ Database updated with new price: 12345.67
```

### Check Database
```sql
SELECT sku, currentPrice, priceBreakdownHtml 
FROM Product 
WHERE sku = 'YOUR-SKU';
```

### Check Shopify
1. Open product in Shopify admin
2. Scroll to "Metafields"
3. Look for `custom.price_breakdown`
4. Should contain HTML table

## Troubleshooting

### "No price results returned"
→ Product missing metal/weight/karat data

### "Shopify sync failed"
→ Check backend logs for specific error
→ Verify Shopify access token is valid

### Breakdown not showing on Shopify
→ Metafield definition might be missing
→ Create `custom.price_breakdown` as "Multi-line text" in Shopify

## Test Files Available

- `test_import_with_data.xlsx` - Sample file with 3 products
- Use this to test the import flow before bulk imports

## Need Help?

Run the test script:
```bash
node test-import-flow.js
```

This will verify:
- Price calculation works
- Breakdown generation works
- Shopify service is ready
- Database updates work
