const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testShopifyMetafieldUpdate() {
    console.log('🔌 Testing Shopify Metafield Update\n');

    try {
        // Get shop
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            console.log('❌ No shop found');
            return;
        }
        console.log(`✓ Shop: ${shop.domain}\n`);

        // Get a product with complete data
        const product = await prisma.product.findFirst({
            where: {
                shopId: shop.id,
                metal: { not: null },
                weightGrams: { gt: 0 },
                karat: { gt: 0 }
            },
            include: { gemstones: true }
        });

        if (!product) {
            console.log('❌ No suitable product found');
            return;
        }

        console.log('📦 Test Product:');
        console.log(`  SKU: ${product.sku}`);
        console.log(`  Variant ID: ${product.shopifyVariantId}`);
        console.log(`  Current Price: ₹${product.currentPrice}`);
        console.log('');

        // Calculate price
        console.log('💰 Calculating Price...');
        const { PricingService } = require('./dist/services/pricing.service');
        const priceResults = await PricingService.calculateBulkPrices(shop.id, [product.id]);

        if (priceResults.length === 0) {
            console.log('❌ No price results');
            return;
        }

        const priceData = priceResults[0];
        console.log(`  New Price: ₹${priceData.newPrice}`);
        console.log('');

        // Generate breakdown HTML
        const generateBreakdownHtml = (breakdown) => {
            if (!breakdown) return '';
            const formatPrice = (cents) => `₹${(cents / 100).toFixed(2)}`;
            let html = '<div class="price-breakdown">\n';
            html += '  <h3>Price Breakdown</h3>\n';
            html += '  <table>\n';
            if (breakdown.metal_value) {
                html += `    <tr><td>${breakdown.metal_name || 'Metal'}</td><td>${formatPrice(breakdown.metal_value)}</td></tr>\n`;
            }
            if (breakdown.making_charges) {
                html += `    <tr><td>Making Charges</td><td>${formatPrice(breakdown.making_charges)}</td></tr>\n`;
            }
            if (breakdown.subtotal) {
                html += `    <tr class="subtotal"><td>Subtotal</td><td>${formatPrice(breakdown.subtotal)}</td></tr>\n`;
            }
            if (breakdown.gst_amount) {
                html += `    <tr><td>GST (${breakdown.gst_pct}%)</td><td>${formatPrice(breakdown.gst_amount)}</td></tr>\n`;
            }
            if (breakdown.total) {
                html += `    <tr class="total"><td><strong>Total Price</strong></td><td><strong>${formatPrice(breakdown.total)}</strong></td></tr>\n`;
            }
            html += '  </table>\n';
            html += '</div>';
            return html;
        };

        const breakdownHtml = generateBreakdownHtml(priceData.breakdown);
        console.log('📝 Generated Breakdown HTML:');
        console.log(`  Length: ${breakdownHtml.length} characters`);
        console.log(`  Preview: ${breakdownHtml.substring(0, 150)}...\n`);

        // Test Shopify update
        console.log('🚀 Pushing to Shopify...');
        console.log(`  Variant ID: ${product.shopifyVariantId}`);
        console.log(`  Price: ₹${priceData.newPrice}`);
        console.log(`  Breakdown: ${breakdownHtml.length} chars\n`);

        const { ShopifyService } = require('./dist/services/shopify.service');
        const shopifyService = await ShopifyService.forShop(shop.domain);

        const results = await shopifyService.updateVariantPricesBatch([{
            variantId: product.shopifyVariantId,
            price: priceData.newPrice,
            breakdown: breakdownHtml
        }]);

        console.log('\n📊 Shopify Update Results:');
        console.log(`  Success: ${results[0]?.success}`);

        if (results[0]?.success) {
            console.log('  ✅ Update successful!');
            console.log('\n📋 Next Steps:');
            console.log('  1. Go to Shopify admin');
            console.log(`  2. Find product: ${product.title}`);
            console.log('  3. Scroll to Metafields section');
            console.log('  4. Look for: custom.price_breakdown');
            console.log('  5. Should contain HTML table with breakdown');
        } else {
            console.log('  ❌ Update failed!');
            console.log('  Error:', JSON.stringify(results[0]?.error, null, 2));

            console.log('\n🔍 Troubleshooting:');
            console.log('  1. Check if metafield definition exists in Shopify');
            console.log('  2. Go to Settings > Custom Data > Variants');
            console.log('  3. Add definition: namespace=custom, key=price_breakdown, type=Multi-line text');
            console.log('  4. Retry import after creating definition');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

testShopifyMetafieldUpdate();
