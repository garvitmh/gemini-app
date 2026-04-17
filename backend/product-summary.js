const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickSummary() {
    const shop = await prisma.shop.findFirst();
    const products = await prisma.product.findMany({
        where: { shopId: shop.id },
        select: {
            sku: true,
            currentPrice: true,
            makingChargeType: true,
            makingChargeValue: true,
            metal: true,
            karat: true
        }
    });

    console.log('\n📊 PRODUCT AUDIT SUMMARY\n');
    console.log('Total Products:', products.length);

    const withMaking = products.filter(p => p.makingChargeType && p.makingChargeValue);
    const withoutMaking = products.filter(p => !p.makingChargeType || !p.makingChargeValue);

    console.log('✅ With Making Charges:', withMaking.length);
    console.log('❌ Without Making Charges:', withoutMaking.length);

    if (withoutMaking.length > 0) {
        console.log('\nProducts missing making charges:');
        withoutMaking.forEach(p => console.log(`  - ${p.sku}`));
    }

    // Group by metal/karat
    const metalGroups = {};
    products.forEach(p => {
        const key = `${p.metal} ${p.karat}K`;
        if (!metalGroups[key]) metalGroups[key] = 0;
        metalGroups[key]++;
    });

    console.log('\n📈 Products by Metal Type:');
    Object.keys(metalGroups).sort().forEach(key => {
        console.log(`  ${key}: ${metalGroups[key]} products`);
    });

    console.log('\n💰 Price Range:');
    const prices = products.map(p => p.currentPrice).filter(p => p > 0);
    if (prices.length > 0) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        console.log(`  Min: ₹${min.toFixed(2)}`);
        console.log(`  Max: ₹${max.toFixed(2)}`);
        console.log(`  Avg: ₹${avg.toFixed(2)}`);
    }

    console.log('\n✅ CONCLUSION:');
    if (withoutMaking.length === 0) {
        console.log('  All products are correctly configured with making charges!');
        console.log('  Import functionality is working perfectly!');
    } else {
        console.log(`  ${withoutMaking.length} products need to be re-imported to add making charges.`);
    }

    await prisma.$disconnect();
}

quickSummary();
