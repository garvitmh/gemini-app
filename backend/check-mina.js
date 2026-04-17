const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function checkMina() {
    const product = await prisma.product.findFirst({
        where: {
            OR: [
                { title: { contains: 'MINA' } },
                { sku: { contains: 'MINA' } }
            ]
        },
        include: { gemstones: true }
    });

    if (!product) {
        console.log('❌ MINA product not found');
        await prisma.$disconnect();
        return;
    }

    const shop = await prisma.shop.findFirst();
    const settings = await prisma.shopSettings.findUnique({
        where: { shopId: shop.id }
    });

    const metalRate = await prisma.metalRate.findFirst({
        where: {
            shopId: shop.id,
            metal: product.metal,
            karat: product.karat
        }
    });

    console.log('\n🔍 MINA MOSSONITE RING 18K ANALYSIS\n');
    console.log('='.repeat(80));

    console.log('\n📦 DATABASE PRODUCT DATA:');
    console.log('   SKU:', product.sku);
    console.log('   Title:', product.title);
    console.log('   Metal:', product.metal, product.karat + 'K');
    console.log('   Weight (for making):', product.weightGrams + 'g');
    console.log('   Gross Weight (for metal):', product.grossGoldWeight + 'g');
    console.log('   Making: ₹' + product.makingChargeValue + '/g');
    console.log('   Wastage %:', product.wastagePct);
    console.log('   GST %:', product.gstPct);

    console.log('\n💰 CURRENT PRICES:');
    console.log('   Database: ₹' + product.currentPrice.toFixed(2));
    console.log('   Modal Shows: ₹30,052.61');
    console.log('   Difference: ₹' + Math.abs(product.currentPrice - 30052.61).toFixed(2));

    console.log('\n🧮 RECALCULATED PRICE:');
    const result = await PricingService.calculateProductPrice(
        product,
        metalRate.ratePerGram,
        null,
        settings,
        null
    );
    console.log('   Service: ₹' + result.price.toFixed(2));

    console.log('\n📊 COMPARISON:');
    console.log('   Database: ₹' + product.currentPrice.toFixed(2));
    console.log('   Recalculated: ₹' + result.price.toFixed(2));
    console.log('   Modal: ₹30,052.61');

    if (Math.abs(product.currentPrice - result.price) < 1) {
        console.log('\n✅ Database and Recalculated MATCH!');
    } else {
        console.log('\n⚠️  Database and Recalculated DIFFER!');
    }

    if (Math.abs(product.currentPrice - 30052.61) < 1) {
        console.log('✅ Database and Modal MATCH!');
    } else {
        console.log('❌ Modal showing OLD/CACHED data - needs refresh!');
        console.log('\n💡 SOLUTION: Refresh the page (F5) to reload product data');
    }

    await prisma.$disconnect();
}

checkMina();
