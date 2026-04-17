const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;
const fs = require('fs');

const prisma = new PrismaClient();

async function deepPriceValidation() {
    const output = [];
    const log = (msg) => {
        console.log(msg);
        output.push(msg);
    };

    log('\n🔬 DEEP PRICE VALIDATION\n');
    log('='.repeat(80));

    const shop = await prisma.shop.findFirst();
    const settings = await prisma.shopSettings.findUnique({
        where: { shopId: shop.id }
    });

    const products = await prisma.product.findMany({
        where: { shopId: shop.id },
        include: { gemstones: true },
        orderBy: { sku: 'asc' }
    });

    log(`\nValidating ${products.length} products...\n`);

    const results = {
        perfect: [],
        minorDiff: [],
        majorDiff: [],
        errors: []
    };

    for (let i = 0; i < products.length; i++) {
        const product = products[i];

        try {
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

            // Pricing service calculation
            const serviceResult = await PricingService.calculateProductPrice(
                product,
                metalRate.ratePerGram,
                null,
                settings,
                null
            );

            const dbPrice = product.currentPrice;
            const diff = Math.abs(serviceResult.price - dbPrice);

            const record = {
                sku: product.sku,
                serviceCalc: serviceResult.price.toFixed(2),
                dbPrice: dbPrice.toFixed(2),
                diff: diff.toFixed(2)
            };

            if (diff < 0.01) {
                results.perfect.push(record);
            } else if (diff < 10) {
                results.minorDiff.push(record);
            } else {
                results.majorDiff.push(record);
            }

            if ((i + 1) % 20 === 0) {
                console.log(`Progress: ${i + 1}/${products.length}...`);
            }

        } catch (error) {
            results.errors.push({
                sku: product.sku,
                error: error.message
            });
        }
    }

    log('\n' + '='.repeat(80));
    log('\n📊 VALIDATION RESULTS:\n');
    log(`   ✅ Perfect (diff < ₹0.01): ${results.perfect.length}`);
    log(`   ⚠️  Minor Diff (₹0.01 - ₹10): ${results.minorDiff.length}`);
    log(`   ❌ Major Diff (> ₹10): ${results.majorDiff.length}`);
    log(`   ⛔ Errors: ${results.errors.length}`);

    if (results.minorDiff.length > 0) {
        log('\n⚠️  MINOR DIFFERENCES:\n');
        results.minorDiff.forEach(r => {
            log(`   ${r.sku}: Service=₹${r.serviceCalc}, DB=₹${r.dbPrice}, Diff=₹${r.diff}`);
        });
    }

    if (results.majorDiff.length > 0) {
        log('\n❌ MAJOR DIFFERENCES:\n');
        results.majorDiff.forEach(r => {
            log(`   ${r.sku}: Service=₹${r.serviceCalc}, DB=₹${r.dbPrice}, Diff=₹${r.diff}`);
        });
    }

    if (results.errors.length > 0) {
        log('\n⛔ ERRORS:\n');
        results.errors.forEach(e => {
            log(`   ${e.sku}: ${e.error}`);
        });
    }

    log('\n' + '='.repeat(80));
    log('\n🎯 FINAL VERDICT:\n');

    const totalValidated = results.perfect.length + results.minorDiff.length + results.majorDiff.length;
    const perfectPercentage = (results.perfect.length / totalValidated * 100).toFixed(1);

    if (results.majorDiff.length === 0 && results.errors.length === 0) {
        log(`   ✅ ALL PRICES ARE CORRECT!`);
        log(`   ${perfectPercentage}% (${results.perfect.length}/${totalValidated}) are perfectly accurate`);
        if (results.minorDiff.length > 0) {
            log(`   ${results.minorDiff.length} have minor rounding differences (acceptable)`);
        }
    } else {
        log(`   ⚠️  ISSUES FOUND - Need to re-import affected products`);
    }

    log('\n');

    // Save to file
    fs.writeFileSync('price-validation-report.txt', output.join('\n'));
    console.log('Report saved to: price-validation-report.txt');

    await prisma.$disconnect();
}

deepPriceValidation();
