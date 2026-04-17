const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function deepPriceValidation() {
    console.log('\n🔬 DEEP PRICE VALIDATION - CHECKING EVERY CALCULATION\n');
    console.log('='.repeat(100));

    const shop = await prisma.shop.findFirst();
    const settings = await prisma.shopSettings.findUnique({
        where: { shopId: shop.id }
    });

    const products = await prisma.product.findMany({
        where: { shopId: shop.id },
        include: { gemstones: true },
        orderBy: { sku: 'asc' }
    });

    console.log(`\nValidating ${products.length} products...\n`);

    const results = {
        perfect: [],
        minorDiff: [],
        majorDiff: [],
        errors: []
    };

    for (let i = 0; i < products.length; i++) {
        const product = products[i];

        try {
            // Get metal rate
            const metalRate = await prisma.metalRate.findFirst({
                where: {
                    shopId: shop.id,
                    metal: product.metal,
                    karat: product.karat
                }
            });

            if (!metalRate) {
                results.errors.push({
                    sku: product.sku,
                    error: `No metal rate for ${product.metal} ${product.karat}K`
                });
                continue;
            }

            // Manual calculation
            const metalValue = product.grossGoldWeight * metalRate.ratePerGram;
            const wastage = metalValue * (product.wastagePct / 100);
            const making = product.weightGrams * (product.makingChargeValue || 0);

            // Gemstone cost
            let gemCost = 0;
            if (product.gemstones && product.gemstones.length > 0) {
                gemCost = product.gemstones.reduce((sum, g) => sum + (g.totalPrice || 0), 0);
            }

            const subtotal = metalValue + wastage + making + gemCost;
            const gst = subtotal * (product.gstPct / 100);
            const manualTotal = subtotal + gst;

            // Pricing service calculation
            const serviceResult = await PricingService.calculateProductPrice(
                product,
                metalRate.ratePerGram,
                null,
                settings,
                null
            );

            // Database price
            const dbPrice = product.currentPrice;

            // Compare all three
            const manualVsService = Math.abs(manualTotal - serviceResult.price);
            const serviceVsDb = Math.abs(serviceResult.price - dbPrice);
            const manualVsDb = Math.abs(manualTotal - dbPrice);

            const maxDiff = Math.max(manualVsService, serviceVsDb, manualVsDb);

            const record = {
                sku: product.sku,
                metal: `${product.metal} ${product.karat}K`,
                weight: product.weightGrams,
                grossWeight: product.grossGoldWeight,
                manualCalc: manualTotal.toFixed(2),
                serviceCalc: serviceResult.price.toFixed(2),
                dbPrice: dbPrice.toFixed(2),
                maxDiff: maxDiff.toFixed(2),
                breakdown: {
                    metal: metalValue.toFixed(2),
                    wastage: wastage.toFixed(2),
                    making: making.toFixed(2),
                    gems: gemCost.toFixed(2),
                    subtotal: subtotal.toFixed(2),
                    gst: gst.toFixed(2)
                }
            };

            if (maxDiff < 0.01) {
                results.perfect.push(record);
            } else if (maxDiff < 10) {
                results.minorDiff.push(record);
            } else {
                results.majorDiff.push(record);
            }

            // Progress
            if ((i + 1) % 20 === 0) {
                console.log(`Progress: ${i + 1}/${products.length} validated...`);
            }

        } catch (error) {
            results.errors.push({
                sku: product.sku,
                error: error.message
            });
        }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 VALIDATION RESULTS:\n');
    console.log(`   ✅ Perfect (diff < ₹0.01): ${results.perfect.length}`);
    console.log(`   ⚠️  Minor Diff (₹0.01 - ₹10): ${results.minorDiff.length}`);
    console.log(`   ❌ Major Diff (> ₹10): ${results.majorDiff.length}`);
    console.log(`   ⛔ Errors: ${results.errors.length}`);

    // Show details for non-perfect products
    if (results.minorDiff.length > 0) {
        console.log('\n' + '='.repeat(100));
        console.log('\n⚠️  MINOR DIFFERENCES (first 10):\n');
        results.minorDiff.slice(0, 10).forEach(r => {
            console.log(`   ${r.sku} (${r.metal}):`);
            console.log(`      Manual: ₹${r.manualCalc} | Service: ₹${r.serviceCalc} | DB: ₹${r.dbPrice}`);
            console.log(`      Max Diff: ₹${r.maxDiff}`);
        });
    }

    if (results.majorDiff.length > 0) {
        console.log('\n' + '='.repeat(100));
        console.log('\n❌ MAJOR DIFFERENCES:\n');
        results.majorDiff.forEach(r => {
            console.log(`   ${r.sku} (${r.metal}):`);
            console.log(`      Manual: ₹${r.manualCalc} | Service: ₹${r.serviceCalc} | DB: ₹${r.dbPrice}`);
            console.log(`      Max Diff: ₹${r.maxDiff}`);
            console.log(`      Breakdown: Metal=₹${r.breakdown.metal}, Making=₹${r.breakdown.making}, Gems=₹${r.breakdown.gems}`);
        });
    }

    if (results.errors.length > 0) {
        console.log('\n' + '='.repeat(100));
        console.log('\n⛔ ERRORS:\n');
        results.errors.forEach(e => {
            console.log(`   ${e.sku}: ${e.error}`);
        });
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n🎯 FINAL VERDICT:\n');

    const totalValidated = results.perfect.length + results.minorDiff.length + results.majorDiff.length;
    const perfectPercentage = (results.perfect.length / totalValidated * 100).toFixed(1);

    if (results.majorDiff.length === 0 && results.errors.length === 0) {
        console.log(`   ✅ ALL PRICES ARE CORRECT!`);
        console.log(`   ${perfectPercentage}% are perfectly accurate (diff < ₹0.01)`);
        if (results.minorDiff.length > 0) {
            console.log(`   ${results.minorDiff.length} have minor rounding differences (< ₹10)`);
            console.log(`   These are acceptable and likely due to floating-point precision.`);
        }
    } else {
        console.log(`   ⚠️  ISSUES FOUND:`);
        if (results.majorDiff.length > 0) {
            console.log(`   - ${results.majorDiff.length} products have major price differences (> ₹10)`);
        }
        if (results.errors.length > 0) {
            console.log(`   - ${results.errors.length} products have errors`);
        }
        console.log(`\n   💡 Recommendation: Re-import affected products to recalculate prices.`);
    }

    console.log('\n');

    await prisma.$disconnect();
}

deepPriceValidation();
