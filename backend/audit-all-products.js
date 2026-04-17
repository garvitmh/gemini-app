const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function auditAllProducts() {
    console.log('\n🔍 AUDITING ALL PRODUCTS\n');
    console.log('='.repeat(80));

    const shop = await prisma.shop.findFirst();
    const products = await prisma.product.findMany({
        where: { shopId: shop.id },
        include: { gemstones: true },
        orderBy: { sku: 'asc' }
    });

    console.log(`\nTotal Products: ${products.length}\n`);

    const issues = [];
    const summary = {
        total: products.length,
        withMakingCharges: 0,
        withoutMakingCharges: 0,
        priceMatches: 0,
        priceMismatches: 0,
        missingMetalRate: 0,
        errors: 0
    };

    for (let i = 0; i < products.length; i++) {
        const product = products[i];

        try {
            // Check making charges
            if (product.makingChargeType && product.makingChargeValue) {
                summary.withMakingCharges++;
            } else {
                summary.withoutMakingCharges++;
                issues.push({
                    sku: product.sku,
                    issue: 'Missing making charges',
                    severity: 'HIGH'
                });
            }

            // Check if metal rate exists
            const metalRate = await prisma.metalRate.findFirst({
                where: {
                    shopId: shop.id,
                    metal: product.metal,
                    karat: product.karat
                }
            });

            if (!metalRate) {
                summary.missingMetalRate++;
                issues.push({
                    sku: product.sku,
                    issue: `No metal rate for ${product.metal} ${product.karat}K`,
                    severity: 'CRITICAL'
                });
                continue;
            }

            // Recalculate price
            const settings = await prisma.shopSettings.findUnique({
                where: { shopId: shop.id }
            });

            const result = await PricingService.calculateProductPrice(
                product,
                metalRate.ratePerGram,
                null,
                settings,
                null
            );

            const priceDiff = Math.abs(result.price - product.currentPrice);

            if (priceDiff > 1) {
                summary.priceMismatches++;
                issues.push({
                    sku: product.sku,
                    issue: `Price mismatch: DB=₹${product.currentPrice.toFixed(2)}, Calc=₹${result.price.toFixed(2)}, Diff=₹${priceDiff.toFixed(2)}`,
                    severity: priceDiff > 1000 ? 'HIGH' : 'MEDIUM'
                });
            } else {
                summary.priceMatches++;
            }

            // Progress indicator
            if ((i + 1) % 20 === 0) {
                console.log(`Progress: ${i + 1}/${products.length} products checked...`);
            }

        } catch (error) {
            summary.errors++;
            issues.push({
                sku: product.sku,
                issue: `Error: ${error.message}`,
                severity: 'CRITICAL'
            });
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   Total Products: ${summary.total}`);
    console.log(`   ✅ With Making Charges: ${summary.withMakingCharges}`);
    console.log(`   ❌ Without Making Charges: ${summary.withoutMakingCharges}`);
    console.log(`   ✅ Price Matches: ${summary.priceMatches}`);
    console.log(`   ❌ Price Mismatches: ${summary.priceMismatches}`);
    console.log(`   ⚠️  Missing Metal Rate: ${summary.missingMetalRate}`);
    console.log(`   ❌ Errors: ${summary.errors}`);

    if (issues.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('\n⚠️  ISSUES FOUND:\n');

        // Group by severity
        const critical = issues.filter(i => i.severity === 'CRITICAL');
        const high = issues.filter(i => i.severity === 'HIGH');
        const medium = issues.filter(i => i.severity === 'MEDIUM');

        if (critical.length > 0) {
            console.log(`\n🔴 CRITICAL (${critical.length}):`);
            critical.forEach(i => console.log(`   ${i.sku}: ${i.issue}`));
        }

        if (high.length > 0) {
            console.log(`\n🟠 HIGH (${high.length}):`);
            high.slice(0, 10).forEach(i => console.log(`   ${i.sku}: ${i.issue}`));
            if (high.length > 10) {
                console.log(`   ... and ${high.length - 10} more`);
            }
        }

        if (medium.length > 0) {
            console.log(`\n🟡 MEDIUM (${medium.length}):`);
            medium.slice(0, 5).forEach(i => console.log(`   ${i.sku}: ${i.issue}`));
            if (medium.length > 5) {
                console.log(`   ... and ${medium.length - 5} more`);
            }
        }
    } else {
        console.log('\n✅ NO ISSUES FOUND! All products are correctly configured.');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 RECOMMENDATIONS:\n');

    if (summary.withoutMakingCharges > 0) {
        console.log(`   • ${summary.withoutMakingCharges} products missing making charges - re-import to fix`);
    }

    if (summary.priceMismatches > 0) {
        console.log(`   • ${summary.priceMismatches} products have price mismatches - re-import to recalculate`);
    }

    if (summary.missingMetalRate > 0) {
        console.log(`   • ${summary.missingMetalRate} products have missing metal rates - add rates in Settings`);
    }

    if (issues.length === 0) {
        console.log('   ✅ All products are correctly configured!');
    }

    console.log('\n');

    await prisma.$disconnect();
}

auditAllProducts();
