const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testImportDebug() {
    try {
        // Get a shop
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            console.log('❌ No shop found');
            return;
        }
        console.log(`✓ Found shop: ${shop.domain}`);

        // Get a product with SKU
        const product = await prisma.product.findFirst({
            where: { shopId: shop.id },
            include: { gemstones: true }
        });

        if (!product) {
            console.log('❌ No products found');
            return;
        }

        console.log(`\n✓ Found product:`);
        console.log(`  SKU: ${product.sku}`);
        console.log(`  Title: ${product.title}`);
        console.log(`  Current Price: ${product.currentPrice}`);
        console.log(`  Weight: ${product.weightGrams}g`);
        console.log(`  Metal: ${product.metal} ${product.karat}K`);
        console.log(`  Gemstones: ${product.gemstones.length}`);
        console.log(`  Price Breakdown HTML: ${product.priceBreakdownHtml ? 'Present' : 'Missing'}`);

        // Check settings
        const settings = await prisma.shopSettings.findUnique({
            where: { shopId: shop.id }
        });

        console.log(`\n✓ Shop Settings:`);
        console.log(`  Default Making Charge: ${settings?.defaultMakingChargeType} - ${settings?.defaultMakingChargeValue}`);
        console.log(`  Default Wastage: ${settings?.defaultWastagePct}%`);
        console.log(`  Default GST: ${settings?.defaultGstPct}%`);

        // Check metal rates
        const metalRate = await prisma.metalRate.findFirst({
            where: {
                shopId: shop.id,
                metal: product.metal
            }
        });

        console.log(`\n✓ Metal Rate for ${product.metal}:`);
        console.log(`  Rate per gram: ₹${metalRate?.ratePerGram || 'NOT SET'}`);

        // Test price calculation
        console.log(`\n🧪 Testing Price Calculation...`);
        const { PricingService } = require('./dist/services/pricing.service');

        const priceResults = await PricingService.calculateBulkPrices(shop.id, [product.id]);

        if (priceResults.length > 0) {
            const result = priceResults[0];
            console.log(`\n✓ Price Calculation Result:`);
            console.log(`  Old Price: ₹${result.oldPrice}`);
            console.log(`  New Price: ₹${result.newPrice}`);
            console.log(`  Breakdown Present: ${result.breakdown ? 'YES' : 'NO'}`);

            if (result.breakdown) {
                console.log(`\n  Breakdown Details:`);
                console.log(`    Metal Value: ₹${result.breakdown.metal_value / 100}`);
                console.log(`    Making Charges: ₹${result.breakdown.making_charges / 100}`);
                console.log(`    Gemstone Price: ₹${result.breakdown.gemstone_price / 100}`);
                console.log(`    Subtotal: ₹${result.breakdown.subtotal / 100}`);
                console.log(`    GST (${result.breakdown.gst_pct}%): ₹${result.breakdown.gst_amount / 100}`);
                console.log(`    Total: ₹${result.breakdown.total / 100}`);
            }
        } else {
            console.log('❌ No price calculation results returned');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

testImportDebug();
