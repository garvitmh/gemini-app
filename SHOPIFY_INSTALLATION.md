# Shopify Price Breakdown - Installation Guide

## Overview

This Liquid template displays a detailed price breakdown for your jewelry products on Shopify, showing:
- Metal price (with sale badges if discounted)
- Wastage charges
- Making charges
- Gemstone prices (supports multiple gemstones)
- Enamel prices
- GST
- Discounts
- Final price

## Files Created

1. **`shopify-price-breakdown.liquid`** - Full-featured template with all components
2. **`shopify-price-breakdown-simple.liquid`** - Simplified version (coming next)

## Installation Instructions

### Method 1: Add to Product Template (Recommended)

1. **Access your Shopify theme editor:**
   - Go to Shopify Admin → Online Store → Themes
   - Click "Customize" on your active theme
   - Or click "Actions" → "Edit code"

2. **Locate your product template:**
   - In the code editor, find your product template file
   - Common locations:
     - `sections/main-product.liquid`
     - `sections/product-template.liquid`
     - `templates/product.liquid`

3. **Add the code:**
   - Copy the entire contents of `shopify-price-breakdown.liquid`
   - Paste it where you want the breakdown to appear
   - Recommended: Place it after the product price section
   - Look for code like `{{ product.price | money }}` and add it below

4. **Save and test:**
   - Click "Save" in the theme editor
   - Visit a product page to see the breakdown

### Method 2: Create as a Snippet (More Organized)

1. **Create a new snippet:**
   - In theme code editor, go to "Snippets" folder
   - Click "Add a new snippet"
   - Name it: `price-breakdown`

2. **Add the code:**
   - Copy contents of `shopify-price-breakdown.liquid`
   - Paste into the new snippet
   - Save the snippet

3. **Include in your product template:**
   - Open your product template (see Method 1, step 2)
   - Add this line where you want the breakdown:
   ```liquid
   {% render 'price-breakdown' %}
   ```
   - Save the template

### Method 3: Add to Product Description (Quick Test)

For testing purposes, you can add the code directly to a product's description:

1. Go to Products → Select a product
2. In the description editor, click "Show HTML"
3. Paste the liquid code at the bottom
4. Save the product

**Note:** This method is not recommended for production as you'd need to add it to each product individually.

## Customization Options

### Change Colors

Edit the inline styles in the template:

```liquid
{% comment %} Header background {% endcomment %}
background-color: #f9fafb;  /* Change to your brand color */

{% comment %} Sale badge color {% endcomment %}
color: #d93025; background: #fee2e2;  /* Red theme */

{% comment %} Final price row {% endcomment %}
background-color: #f0fdf4; color: #166534;  /* Green theme */
```

### Adjust Spacing

```liquid
{% comment %} Container margin {% endcomment %}
margin-top: 20px;  /* Increase/decrease space above */

{% comment %} Cell padding {% endcomment %}
padding: 10px 16px;  /* Adjust row height */
```

### Hide Specific Rows

Comment out sections you don't want to display:

```liquid
{% comment %}
  {% comment %} Wastage Row {% endcomment %}
  <tr style="border-bottom: 1px solid #f1f2f3;">
    ...
  </tr>
{% endcomment %}
```

## Troubleshooting

### Breakdown Not Showing

**Issue:** The price breakdown doesn't appear on product pages.

**Solutions:**
1. Verify the metafield exists:
   - Go to Products → Select a product → Metafields
   - Look for `gemini.price_breakdown`
   - If missing, run "Update All Prices" in your Gemini App

2. Check variant selection:
   - The breakdown uses `product.selected_or_first_available_variant`
   - Make sure your product has at least one variant

3. Verify metafield type:
   - The metafield should be type `json`
   - Check in Settings → Custom data → Variants

### Prices Show as $0.00

**Issue:** All prices display as zero or incorrect amounts.

**Solution:**
- Prices are stored in cents (e.g., 10000 = ₹100.00)
- The template uses `| times: 0.01 | money` to convert
- If your prices are already in rupees, remove `| times: 0.01`

### Styling Conflicts

**Issue:** The breakdown looks broken or unstyled.

**Solutions:**
1. Check for CSS conflicts with your theme
2. Add `!important` to critical styles:
   ```liquid
   style="width: 100% !important; border-collapse: collapse !important;"
   ```
3. Wrap in a unique class and add scoped styles

### Mobile Display Issues

**Issue:** Breakdown doesn't look good on mobile.

**Solution:**
- The template includes responsive CSS at the bottom
- Adjust breakpoint if needed:
  ```css
  @media (max-width: 768px) { /* Change 768px to your preference */ }
  ```

## Testing Checklist

- [ ] Breakdown displays on product pages
- [ ] All price components show correctly
- [ ] Sale badges appear for discounted items
- [ ] Multiple gemstones display properly
- [ ] GST calculation is correct
- [ ] Final price matches product price
- [ ] Mobile view looks good
- [ ] Works with variant switching

## Support

If the breakdown isn't displaying:
1. Check browser console for errors (F12 → Console tab)
2. Verify metafield data in Shopify Admin
3. Test with a simple product first
4. Check theme compatibility

## Next Steps

After installation:
1. Test on a few products
2. Customize colors to match your brand
3. Adjust spacing and layout as needed
4. Add to all product templates
5. Test on mobile devices
