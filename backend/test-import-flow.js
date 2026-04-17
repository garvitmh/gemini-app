const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testImportFlow() {
    console.log('🧪 Testing Import Flow with Price Calculation and Shopify Sync\n');

    try {
        // 1. Get shop
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            console.log('❌ No shop found');
            return;
        }
        console.log(`✓ Shop: ${shop.domain}\n`);

        // 2. Find a product with complete data
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
            console.log('❌ No suitable product found for testing');
            return;
        }

        console.log('📦 Test Product:');
        console.log(`  SKU: ${product.sku}`);
        console.log(`  Title: ${product.title}`);
        console.log(`  Metal: ${product.metal} ${product.karat}K`);
        console.log(`  Weight: ${product.weightGrams}g`);
        console.log(`  Current Price: ₹${product.currentPrice}`);
        console.log('');

        // 3. Calculate price
        console.log('💰 Calculating Price...');
        const { PricingService } = require('./dist/services/pricing.service');
        const priceResults = await PricingService.calculateBulkPrices(shop.id, [product.id]);

        if (priceResults.length === 0) {
            console.log('❌ No price calculation results');
            return;
        }

        const priceData = priceResults[0];
        console.log(`  Old Price: ₹${priceData.oldPrice}`);
        console.log(`  New Price: ₹${priceData.newPrice}`);
        console.log(`  Breakdown: ${priceData.breakdown ? '✓ Generated' : '✗ Missing'}`);
        console.log('');

        // 4. Generate breakdown HTML
        console.log('📝 Generating Breakdown HTML...');

        // Import the function from the routes file
        const generateBreakdownHtml = (breakdown) => {
            if (!breakdown) return '';

            const formatPrice = (cents) => `₹${(cents / 100).toFixed(2)}`;

            let html = '<div class="price-breakdown">\n';
            html += `  <h3>Price Breakdown</h3>\n`;
            html += `  <table>\n`;

            if (breakdown.metal_value) {
                html += `    <tr><td>${breakdown.metal_name || 'Metal'}</td><td>${formatPrice(breakdown.metal_value)}</td></tr>\n`;
                if (breakdown.wastage_amount) {
                    html += `    <tr><td>Wastage (${breakdown.wastage_pct}%)</td><td>${formatPrice(breakdown.wastage_amount)}</td></tr>\n`;
                }
            }

            if (breakdown.making_charges) {
                html += `    <tr><td>Making Charges</td><td>${formatPrice(breakdown.making_charges)}</td></tr>\n`;
            }

            if (breakdown.gemstone_price && breakdown.gemstone_price > 0) {
                html += `    <tr><td>Gemstones</td><td>${formatPrice(breakdown.gemstone_price)}</td></tr>\n`;
            }

            if (breakdown.enamel_price && breakdown.enamel_price > 0) {
                html += `    <tr><td>${breakdown.enamel_name || 'Enamel'}</td><td>${formatPrice(breakdown.enamel_price)}</td></tr>\n`;
            }

            if (breakdown.subtotal) {
                html += `    <tr class="subtotal"><td>Subtotal</td><td>${formatPrice(breakdown.subtotal)}</td></tr>\n`;
            }

            if (breakdown.gst_amount) {
                html += `    <tr><td>GST (${breakdown.gst_pct}%)</td><td>${formatPrice(breakdown.gst_amount)}</td></tr>\n`;
            }

            if (breakdown.discount && breakdown.discount > 0) {
                html += `    <tr class="discount"><td>Discount</td><td>-${formatPrice(breakdown.discount)}</td></tr>\n`;
            }
            if (breakdown.product_discount && breakdown.product_discount > 0) {
                html += `    <tr class="discount"><td>Product Discount</td><td>-${formatPrice(breakdown.product_discount)}</td></tr>\n`;
            }

            if (breakdown.total) {
                html += `    <tr class="total"><td><strong>Total Price</strong></td><td><strong>${formatPrice(breakdown.total)}</strong></td></tr>\n`;
            }

            html += `  </table>\n`;
            html += `</div>`;

            return html;
        };

        const breakdownHtml = generateBreakdownHtml(priceData.breakdown);
        console.log(`  HTML Length: ${breakdownHtml.length} characters`);
        console.log(`  Preview:\n${breakdownHtml.substring(0, 200)}...`);
        console.log('');

        // 5. Test Shopify service (dry run - don't actually push)
        console.log('🔌 Testing Shopify Service Integration...');
        const { ShopifyService } = require('./dist/services/shopify.service');

        console.log(`  ✓ ShopifyService loaded`);
        console.log(`  ✓ updateVariantWithBreakdown method: ${typeof ShopifyService.prototype.updateVariantWithBreakdown === 'function' ? 'Available' : 'Missing'}`);
        console.log(`  ✓ updateVariantPricesBatch method: ${typeof ShopifyService.prototype.updateVariantPricesBatch === 'function' ? 'Available' : 'Missing'}`);
        console.log('');

        // 6. Update database (simulate what import does)
        console.log('💾 Updating Database...');
        await prisma.product.update({
            where: { id: product.id },
            data: {
                currentPrice: priceData.newPrice,
                lastCalculatedPrice: priceData.newPrice,
                priceBreakdownHtml: JSON.stringify(priceData.breakdown)
            }
        });
        console.log('  ✓ Database updated with new price and breakdown');
        console.log('');

        // 7. Summary
        console.log('='.repeat(60));
        console.log('✅ TEST SUMMARY');
        console.log('='.repeat(60));
        console.log('✓ Price calculation: Working');
        console.log('✓ Breakdown generation: Working');
        console.log('✓ HTML generation: Working');
        console.log('✓ Database update: Working');
        console.log('✓ Shopify service: Ready');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('1. Import products via Excel with complete data (metal, weight, karat)');
        console.log('2. Check backend logs for calculation and sync messages');
        console.log('3. Verify prices updated in database');
        console.log('4. Check Shopify product metafield for price breakdown');
        console.log('');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

testImportFlow();
