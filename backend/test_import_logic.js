const { PrismaClient } = require('@prisma/client');
const { PricingService } = require('./dist/services/pricing.service');
const prisma = new PrismaClient();

async function test() {
    console.log('--- TEST IMPORT LOGIC ---');
    try {
        // 1. Get a product
        const product = await prisma.product.findFirst({
            include: { gemstones: true }
        });
        if (!product) {
            console.log('No product found in DB to test.');
            return;
        }
        console.log(`Testing Product: ${product.sku}`);
        console.log(`Initial: Weight=${product.weightGrams}, Price=${product.currentPrice}`);

        // 2. Simulate Import: Update Weight
        const newWeight = (product.weightGrams || 10) + 1;
        console.log(`Updating weight to ${newWeight}...`);

        await prisma.product.update({
            where: { id: product.id },
            data: { weightGrams: newWeight }
        });

        // 3. Simulate Logic: Recalculate
        console.log('Calculating price...');
        const priceResults = await PricingService.calculateBulkPrices(product.shopId, [product.id]);

        if (priceResults.length === 0) {
            console.log('ERROR: No price results returned.');
        } else {
            console.log('Price Result:', priceResults[0]);

            // 4. Update DB Price
            await prisma.product.update({
                where: { id: product.id },
                data: {
                    currentPrice: priceResults[0].newPrice,
                    lastCalculatedPrice: priceResults[0].newPrice
                }
            });
            console.log('DB Updated with new price.');
        }

        // 5. Verify Final State
        const finalProduct = await prisma.product.findUnique({ where: { id: product.id } });
        console.log(`Final: Weight=${finalProduct.weightGrams}, Price=${finalProduct.currentPrice}`);

        if (finalProduct.currentPrice !== product.currentPrice) {
            console.log('SUCCESS: Price changed.');
        } else {
            console.log('WARNING: Price did not change (check if weight change impacts price).');
        }

    } catch (err) {
        console.error('TEST FAILED:', err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
