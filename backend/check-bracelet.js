const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function checkBracelet() {
    // Find the bracelet product
    const product = await prisma.product.findFirst({
        where: {
            title: { contains: 'STUDDED BRACELET' }
        },
        include: { gemstones: true }
    });

    if (!product) {
        console.log('❌ Product not found - trying all products with BRACELET...');
        const allBracelets = await prisma.product.findMany({
            where: { title: { contains: 'BRACELET' } },
            select: { sku: true, title: true, currentPrice: true }
        });
        console.log('Found bracelets:');
        allBracelets.forEach(p => console.log(`  ${p.sku}: ${p.title} - ₹${p.currentPrice}`));
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

    console.log('\n🔍 STUDDED BRACELET 18K ANALYSIS\n');
    console.log('='.repeat(80));

    console.log('\n📦 PRODUCT DATA:');
    console.log('   SKU:', product.sku);
    console.log('   Title:', product.title);
    console.log('   Metal:', product.metal, product.karat + 'K');
    console.log('   Weight:', product.weightGrams + 'g');
    console.log('   Gross Weight:', product.grossGoldWeight + 'g');
    console.log('   Making: ₹' + product.makingChargeValue + '/g');

    console.log('\n💰 PRICES:');
    console.log('   Database: ₹' + product.currentPrice.toFixed(2));
    console.log('   Modal: ₹84,274.81');
    console.log('   Difference: ₹' + Math.abs(product.currentPrice - 84274.81).toFixed(2));

    // Calculate
    const result = await PricingService.calculateProductPrice(
        product,
        metalRate.ratePerGram,
        null,
        settings,
        null
    );

    console.log('\n🔧 RECALCULATED:');
    console.log('   Service: ₹' + result.price.toFixed(2));

    if (Math.abs(product.currentPrice - 84274.81) < 1) {
        console.log('\n✅ Database and Modal MATCH!');
    } else {
        console.log('\n❌ MISMATCH - Modal needs to reload product data');
        console.log('   Close and reopen the modal to refresh');
    }

    await prisma.$disconnect();
}

checkBracelet();
