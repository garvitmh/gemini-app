const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function checkProduct() {
    const product = await prisma.product.findFirst({
        where: { sku: '0023-MO.2150' },
        include: { gemstones: true }
    });

    if (!product) {
        console.log('❌ Product not found');
        return;
    }

    console.log('\n📦 Product:', product.sku);
    console.log('   Title:', product.title);

    console.log('\n💰 PRICES:');
    console.log('   Database: ₹' + product.currentPrice);
    console.log('   Modal Shows: ₹23,982.03');
    console.log('   Difference: ₹' + (product.currentPrice - 23982.03).toFixed(2));

    console.log('\n⚙️ PRODUCT DATA:');
    console.log('   Metal:', product.metal, product.karat + 'K');
    console.log('   Weight:', product.weightGrams + 'g');
    console.log('   Gross Weight:', product.grossGoldWeight + 'g');
    console.log('   Auto Gross Weight:', product.autoGrossGoldWeight);
    console.log('   Wastage %:', product.wastagePct);
    console.log('   GST %:', product.gstPct);
    console.log('   Making Type:', product.makingChargeType);
    console.log('   Making Value: ₹' + product.makingChargeValue);

    console.log('\n💎 GEMSTONES:', product.gemstones.length);
    product.gemstones.forEach((gem, i) => {
        console.log(`   ${i + 1}. ${gem.name}:`);
        console.log(`      Pieces: ${gem.pieces}`);
        console.log(`      Carats: ${gem.carats}`);
        console.log(`      Rate/ct: ₹${gem.ratePerCarat}`);
        console.log(`      Total: ₹${gem.totalPrice}`);
    });

    // Recalculate
    const shop = await prisma.shop.findFirst();
    const metalRate = await prisma.metalRate.findFirst({
        where: {
            shopId: shop.id,
            metal: product.metal,
            karat: product.karat
        }
    });

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

    console.log('\n🔧 RECALCULATED:');
    console.log('   Price: ₹' + result.price);
    console.log('   Matches Modal:', Math.abs(result.price - 23982.03) < 1 ? 'YES ✅' : 'NO ❌');
    console.log('   Matches Database:', Math.abs(result.price - product.currentPrice) < 1 ? 'YES ✅' : 'NO ❌');

    console.log('\n📊 BREAKDOWN:');
    console.log(JSON.stringify(result.breakdown, null, 2));

    await prisma.$disconnect();
}

checkProduct();
