const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function systemCheck() {
    console.log('🔍 BACKEND SYSTEM CHECK\n');

    try {
        // 1. Database
        console.log('1️⃣ Database Connection');
        await prisma.$connect();
        console.log('   ✅ Connected\n');

        // 2. Shop
        console.log('2️⃣ Shop Configuration');
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (shop) {
            console.log(`   ✅ Shop: ${shop.domain}`);
            console.log(`   ${shop.settings ? '✅' : '⚠️ '} Settings configured\n`);
        } else {
            console.log('   ❌ No shop found\n');
        }

        // 3. Products
        console.log('3️⃣ Products');
        const totalProducts = await prisma.product.count();
        const withNewGems = await prisma.product.count({
            where: { gemstones: { some: {} } }
        });
        const withLegacyGems = await prisma.product.count({
            where: { gemstoneType: { not: null } }
        });
        const withBreakdown = await prisma.product.count({
            where: { priceBreakdownHtml: { not: null } }
        });

        console.log(`   Total: ${totalProducts}`);
        console.log(`   With new gemstones: ${withNewGems}`);
        console.log(`   With legacy gemstones: ${withLegacyGems}`);
        console.log(`   With breakdown HTML: ${withBreakdown}\n`);

        // 4. Rates
        console.log('4️⃣ Rates');
        const metalRates = await prisma.metalRate.count();
        const stoneRates = await prisma.stoneRate.count();
        const enamelRates = await prisma.enamelRate.count();

        console.log(`   Metal: ${metalRates}`);
        console.log(`   Stone: ${stoneRates}`);
        console.log(`   Enamel: ${enamelRates}\n`);

        // 5. Gemstones
        console.log('5️⃣ Gemstones');
        const totalGemstones = await prisma.productGemstone.count();
        console.log(`   Total gemstone records: ${totalGemstones}\n`);

        // 6. Conflicts
        console.log('6️⃣ Data Conflicts');
        const conflicting = await prisma.product.findMany({
            where: {
                AND: [
                    { gemstones: { some: {} } },
                    { gemstoneType: { not: null } }
                ]
            },
            select: { id: true, sku: true, title: true },
            take: 10
        });

        if (conflicting.length > 0) {
            console.log(`   ⚠️  ${conflicting.length} products have BOTH new & legacy gemstones:`);
            conflicting.forEach(p => {
                console.log(`      - ${p.sku || 'NO-SKU'}: ${p.title.substring(0, 50)}`);
            });
        } else {
            console.log('   ✅ No conflicting gemstone data');
        }
        console.log('');

        // 7. Missing Breakdowns
        console.log('7️⃣ Missing Price Breakdowns');
        const needingBreakdown = await prisma.product.count({
            where: {
                AND: [
                    { weightGrams: { not: null } },
                    { metal: { not: null } },
                    { priceBreakdownHtml: null }
                ]
            }
        });

        if (needingBreakdown > 0) {
            console.log(`   ⚠️  ${needingBreakdown} products missing breakdown HTML`);
        } else {
            console.log('   ✅ All products have breakdowns');
        }
        console.log('');

        // 8. Price History
        console.log('8️⃣ Price History');
        const totalHistory = await prisma.priceHistory.count();
        const failed = await prisma.priceHistory.count({
            where: { status: 'failed' }
        });

        console.log(`   Total records: ${totalHistory}`);
        console.log(`   Failed pushes: ${failed}\n`);

        // Summary
        console.log('📊 SUMMARY');
        console.log('─'.repeat(50));

        const issues = [];
        if (!shop) issues.push('No shop configured');
        if (metalRates === 0) issues.push('No metal rates');
        if (stoneRates === 0) issues.push('No stone rates');
        if (conflicting.length > 0) issues.push(`${conflicting.length} conflicting products`);
        if (needingBreakdown > 0) issues.push(`${needingBreakdown} missing breakdowns`);

        if (issues.length === 0) {
            console.log('✅ All systems operational!');
        } else {
            console.log(`⚠️  Found ${issues.length} issue(s):`);
            issues.forEach(issue => console.log(`   - ${issue}`));
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

systemCheck();
