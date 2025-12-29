# Shopify Price Breakdown - Installation Guide (Updated)

## What's New

This updated version includes:
- ✅ **Per-Piece Gemstone Support**: Shows "10 pcs × ₹500/pc" for per-piece pricing
- ✅ **Per-Carat Gemstone Support**: Shows "2.5ct × ₹2000/ct" for per-carat pricing  
- ✅ **Multiple Gemstones**: Displays all gemstones with individual pricing
- ✅ **Rate Not Set Warning**: Shows warning if gemstone rate is missing
- ✅ **Discount Support**: Strikethrough original prices with "Sale" badges

## Installation Steps

### Step 1: Copy the Template

Copy the entire contents of [`shopify-price-breakdown.liquid`](file:///c:/Users/Sandeep/Downloads/gemini-app%20(1)/gemini-app/shopify-price-breakdown.liquid)

### Step 2: Add to Your Theme

1. Go to **Shopify Admin** → **Online Store** → **Themes**
2. Click **Actions** → **Edit code** on your active theme
3. In the **Snippets** folder, click **Add a new snippet**
4. Name it: `gemini-price-breakdown`
5. Paste the copied code
6. Click **Save**

### Step 3: Include in Product Template

Find your product template (usually `sections/main-product.liquid` or `templates/product.liquid`) and add this line where you want the price breakdown to appear:

```liquid
{% render 'gemini-price-breakdown' %}
```

**Recommended placement**: Right after the product price display

Example:
```liquid
<div class="product-price">
  {{ product.selected_or_first_available_variant.price | money }}
</div>

{% render 'gemini-price-breakdown' %}  <!-- Add here -->
```

### Step 4: Save and Test

1. Click **Save** on your product template
2. Visit a product page that has price breakdown data
3. The breakdown should appear automatically

## Example Output

### Per-Carat Gemstone (Diamond)
```
Price Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gold 22K Price                                    ₹15,000
Wastage (5%)                                         ₹750
Making Charges (₹1500/g)                           ₹3,000
Diamond (IF) D Excellent                           ₹5,000
  2.5ct × ₹2000/ct
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal                                          ₹23,750
GST (3%)                                             ₹713
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Final Price                                       ₹24,463
```

### Per-Piece Gemstone (Sapphire)
```
Price Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gold 22K Price                                    ₹15,000
Wastage (5%)                                         ₹750
Making Charges (₹1500/g)                           ₹3,000
Sapphire Excellent                                 ₹5,000
  10 pcs × ₹500/pc
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal                                          ₹23,750
GST (3%)                                             ₹713
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Final Price                                       ₹24,463
```

### Multiple Gemstones
```
Price Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gold 22K Price                                    ₹15,000
Wastage (5%)                                         ₹750
Making Charges (₹1500/g)                           ₹3,000
Diamond (IF) D Excellent                           ₹5,000
  2.5ct × ₹2000/ct
Sapphire Excellent                                 ₹5,000
  10 pcs × ₹500/pc
Ruby Red                                           ₹3,000
  1.5ct × ₹2000/ct
Total Gemstones                                   ₹13,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal                                          ₹31,750
GST (3%)                                             ₹953
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Final Price                                       ₹32,703
```

### With Discounts
```
Price Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gold 22K Price [Sale]                             ₹14,250
  ₹15,000 (strikethrough)
Wastage (5%)                                         ₹750
Making Charges (₹1500/g) [Sale]                    ₹2,700
  ₹3,000 (strikethrough)
Sapphire Excellent [Sale]                          ₹4,500
  10 pcs × ₹500/pc
  ₹5,000 (strikethrough)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal                                          ₹22,200
GST (3%)                                             ₹666
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Final Price                                       ₹22,866
  ₹24,463 (strikethrough)
```

## Customization

### Change Colors

Edit the style values in the template:

```liquid
<!-- Success green background for final price -->
<tr style="background-color: #f0fdf4;">  <!-- Change this -->
  
<!-- Sale badge color -->
<span style="color: #d93025; background: #fee2e2;">Sale</span>  <!-- Change these -->
```

### Change Font Size

```liquid
<!-- Main table font size -->
<table style="font-size: 14px;">  <!-- Change this -->

<!-- Detail text size -->
<div style="font-size: 12px;">  <!-- Change this -->
```

### Hide Specific Rows

Wrap any section in a comment to hide it:

```liquid
{% comment %}
  <!-- This section will be hidden -->
  <tr>...</tr>
{% endcomment %}
```

## Troubleshooting

### Breakdown Not Showing

**Check 1**: Verify the metafield exists
- Go to product in Shopify admin
- Scroll to **Metafields** section
- Look for `gemini.price_breakdown`
- Should contain JSON data

**Check 2**: Verify the snippet is included
- Check your product template has `{% render 'gemini-price-breakdown' %}`
- Make sure it's not inside a comment block

**Check 3**: Check browser console
- Open browser DevTools (F12)
- Look for any JavaScript errors
- Check if the HTML is being rendered

### Prices Show as ₹0.00

This means the metafield exists but contains zero values. Check:
- Product has weight configured
- Metal type and karat are set
- Rates are configured in the Gemini app
- Price has been calculated and pushed to Shopify

### Formatting Issues

**Mobile display**: The template includes responsive CSS for mobile devices. If it still looks wrong, check your theme's CSS isn't overriding the styles.

**Currency symbol**: The template uses Shopify's `| money` filter which automatically uses your store's currency. To change it, edit the filter or use `| money_with_currency`.

## Advanced: Custom Metafield Namespace

If you're using a different metafield namespace (not `gemini`), update line 13:

```liquid
<!-- Original -->
{% assign breakdown = product.selected_or_first_available_variant.metafields.gemini.price_breakdown %}

<!-- Custom namespace -->
{% assign breakdown = product.selected_or_first_available_variant.metafields.YOUR_NAMESPACE.price_breakdown %}
```

## Support

For issues or questions:
1. Check the Gemini app logs in your admin panel
2. Verify products have been synced and prices calculated
3. Ensure metafields are being pushed to Shopify correctly
4. Contact support with screenshots of the issue

## Version History

**v2.0** (Current)
- Added per-piece gemstone support with pieces display
- Added per-carat rate display in breakdown
- Added "Rate not set" warning for missing rates
- Improved multiple gemstone display
- Better discount visualization

**v1.0**
- Initial release with basic price breakdown
- Single gemstone support only
