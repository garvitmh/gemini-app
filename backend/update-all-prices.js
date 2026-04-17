const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function updateAllPrices() {
    console.log('🔄 UPDATING ALL PRODUCT PRICES WITH CURRENT RATES\n');

    const shop = await prisma.shop.findFirst();
    const products = await prisma.product.findMany({
        where: { shopId: shop.id },
        include: { gemstones: true },
        take: 10 // Limit to 10 for testing
    });

    console.log(`Found ${products.length} products to update\n`);

    let updated = 0;
    let errors = 0;

    for (const product of products) {
        try {
            console.log(`Updating ${product.sku}...`);
            console.log(`  Old Price: ₹${product.currentPrice}`);

            // Get metal rate
            const metalRate = await prisma.metalRate.findFirst({
                where: {
                    shopId: shop.id,
                    metal: product.metal,
                    karat: product.karat
                }
            });

            if (!metalRate) {
                console.log(`  ❌ No metal rate found for ${product.metal} ${product.karat}K`);
                errors++;
                continue;
            }

            // Get settings
            const settings = await prisma.shopSettings.findUnique({
                where: { shopId: shop.id }
            });

            // Get enamel rate if needed
            let enamelRate = null;
            if (product.enamelColor) {
                enamelRate = await prisma.enamelRate.findFirst({
                    where: {
                        shopId: shop.id,
                        enamelColor: product.enamelColor
                    }
                });
            }

            // Calculate new price
            const result = await PricingService.calculateProductPrice(
                product,
                metalRate.ratePerGram,
                null,
                settings,
                enamelRate
            );

            // Update database
            await prisma.product.update({
                where: { id: product.id },
                data: {
                    currentPrice: result.price,
                    lastCalculatedPrice: result.price
                }
            });

            console.log(`  New Price: ₹${result.price}`);
            console.log(`  ✅ Updated!\n`);
            updated++;

        } catch (error) {
            console.log(`  ❌ Error: ${error.message}\n`);
            errors++;
        }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total: ${products.length}`);

    await prisma.$disconnect();
}

updateAllPrices();
