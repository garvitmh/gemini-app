const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validateImportRequirements() {
    console.log('🔍 Validating Import Requirements...\n');

    const issues = [];
    const warnings = [];

    try {
        // 1. Check Shop Exists
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            issues.push('❌ No shop found in database');
            return { issues, warnings };
        }
        console.log(`✓ Shop found: ${shop.domain}\n`);

        // 2. Check Shop Settings
        const settings = await prisma.shopSettings.findUnique({
            where: { shopId: shop.id }
        });

        if (!settings) {
            issues.push('❌ Shop settings not configured');
        } else {
            console.log('✓ Shop Settings:');
            console.log(`  - Making Charge: ${settings.defaultMakingChargeType} = ${settings.defaultMakingChargeValue}`);
            console.log(`  - Wastage: ${settings.defaultWastagePct}%`);
            console.log(`  - GST: ${settings.defaultGstPct}%`);

            if (settings.defaultMakingChargeValue === 0) {
                warnings.push('⚠️  Default making charge is 0');
            }
        }
        console.log('');

        // 3. Check Metal Rates
        const metalRates = await prisma.metalRate.findMany({
            where: { shopId: shop.id }
        });

        if (metalRates.length === 0) {
            issues.push('❌ No metal rates configured');
        } else {
            console.log(`✓ Metal Rates (${metalRates.length} configured):`);
            metalRates.forEach(rate => {
                console.log(`  - ${rate.metal}${rate.karat ? ` ${rate.karat}K` : ''}: ₹${rate.ratePerGram}/gram`);
            });
        }
        console.log('');

        // 4. Check Products
        const products = await prisma.product.findMany({
            where: { shopId: shop.id },
            include: { gemstones: true }
        });

        if (products.length === 0) {
            warnings.push('⚠️  No products found - sync from Shopify first');
        } else {
            console.log(`✓ Products: ${products.length} total\n`);

            // Check for products missing critical data
            let missingMetal = 0;
            let missingWeight = 0;
            let missingKarat = 0;
            let hasGemstones = 0;

            products.forEach(p => {
                if (!p.metal || p.metal === 'none') missingMetal++;
                if (!p.weightGrams || p.weightGrams === 0) missingWeight++;
                if (!p.karat || p.karat === 0) missingKarat++;
                if (p.gemstones && p.gemstones.length > 0) hasGemstones++;
            });

            console.log('Product Data Quality:');
            if (missingMetal > 0) {
                warnings.push(`⚠️  ${missingMetal} products missing metal type`);
                console.log(`  ⚠️  ${missingMetal} products missing metal type`);
            } else {
                console.log(`  ✓ All products have metal type`);
            }

            if (missingWeight > 0) {
                warnings.push(`⚠️  ${missingWeight} products missing weight`);
                console.log(`  ⚠️  ${missingWeight} products missing weight`);
            } else {
                console.log(`  ✓ All products have weight`);
            }

            if (missingKarat > 0) {
                warnings.push(`⚠️  ${missingKarat} products missing karat`);
                console.log(`  ⚠️  ${missingKarat} products missing karat`);
            } else {
                console.log(`  ✓ All products have karat`);
            }

            console.log(`  ℹ️  ${hasGemstones} products have gemstones`);
        }
        console.log('');

        // 5. Check Gemstone Rates (if products use gemstones)
        const stoneRates = await prisma.stoneRate.findMany({
            where: { shopId: shop.id }
        });

        if (stoneRates.length === 0) {
            warnings.push('⚠️  No gemstone rates configured');
            console.log('⚠️  Gemstone Rates: None configured');
        } else {
            console.log(`✓ Gemstone Rates: ${stoneRates.length} configured`);
            const uniqueTypes = [...new Set(stoneRates.map(r => r.stoneType))];
            console.log(`  Types: ${uniqueTypes.join(', ')}`);
        }
        console.log('');

        // 6. Test a sample calculation
        const testProduct = products.find(p =>
            p.metal && p.metal !== 'none' &&
            p.weightGrams && p.weightGrams > 0 &&
            p.karat && p.karat > 0
        );

        if (testProduct) {
            console.log('🧪 Testing Price Calculation...');
            console.log(`  Product: ${testProduct.title} (${testProduct.sku})`);

            try {
                const { PricingService } = require('./dist/services/pricing.service');
                const results = await PricingService.calculateBulkPrices(shop.id, [testProduct.id]);

                if (results.length > 0) {
                    const result = results[0];
                    console.log(`  ✓ Calculation successful!`);
                    console.log(`    Old Price: ₹${result.oldPrice}`);
                    console.log(`    New Price: ₹${result.newPrice}`);
                    console.log(`    Breakdown: ${result.breakdown ? 'Generated' : 'Missing'}`);
                } else {
                    issues.push('❌ Price calculation returned no results');
                    console.log(`  ❌ No results returned`);
                }
            } catch (calcError) {
                issues.push(`❌ Price calculation failed: ${calcError.message}`);
                console.log(`  ❌ Calculation error: ${calcError.message}`);
            }
        } else {
            warnings.push('⚠️  No suitable product found for test calculation');
            console.log('⚠️  Cannot test calculation - no valid products');
        }
        console.log('');

    } catch (error) {
        issues.push(`❌ Validation error: ${error.message}`);
        console.error('Error during validation:', error);
    } finally {
        await prisma.$disconnect();
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));

    if (issues.length === 0 && warnings.length === 0) {
        console.log('✅ All checks passed! System is ready for import.');
    } else {
        if (issues.length > 0) {
            console.log('\n❌ CRITICAL ISSUES (must fix before import):');
            issues.forEach(issue => console.log(`  ${issue}`));
        }

        if (warnings.length > 0) {
            console.log('\n⚠️  WARNINGS (may affect some products):');
            warnings.forEach(warning => console.log(`  ${warning}`));
        }
    }
    console.log('');

    return { issues, warnings };
}

validateImportRequirements();
