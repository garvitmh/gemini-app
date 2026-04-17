const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function comparePrices() {
    // Get a sample product
    const product = await prisma.product.findFirst({
        where: { sku: 'MO26CT-1800' },
        include: { gemstones: true }
    });

    if (!product) {
        console.log('Product not found');
        return;
    }

    console.log('\n📦 Product:', product.sku);
    console.log('   Title:', product.title);
    console.log('\n💰 DATABASE PRICES:');
    console.log('   Current Price: ₹' + product.currentPrice);
    console.log('   Last Calculated: ₹' + product.lastCalculatedPrice);

    console.log('\n⚙️ PRODUCT DATA:');
    console.log('   Metal:', product.metal, product.karat + 'K');
    console.log('   Weight:', product.weightGrams + 'g');
    console.log('   Gross Weight:', product.grossGoldWeight + 'g');
    console.log('   Wastage %:', product.wastagePct);
    console.log('   GST %:', product.gstPct);
    console.log('   Making Type:', product.makingChargeType);
    console.log('   Making Value: ₹' + product.makingChargeValue);
    console.log('   Gemstones:', product.gemstones.length);

    // Now recalculate using the pricing service
    const PricingService = require('./dist/services/pricing.service').PricingService;

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

    console.log('\n🧮 RECALCULATED PRICE:');
    console.log('   New Price: ₹' + result.price);
    console.log('   Difference: ₹' + (result.price - product.currentPrice).toFixed(2));

    if (Math.abs(result.price - product.currentPrice) > 0.01) {
        console.log('\n⚠️  PRICES DO NOT MATCH!');
        console.log('   Database needs update');
    } else {
        console.log('\n✅ PRICES MATCH!');
    }

    await prisma.$disconnect();
}

comparePrices();
