const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function testBracelet() {
    const product = await prisma.product.findFirst({
        where: { title: { contains: 'STUDDED BRACELET' } },
        include: { gemstones: true }
    });

    if (!product) {
        console.log('Product not found');
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

    console.log('\n🧮 MAKING CHARGE CALCULATION TEST\n');
    console.log('Product:', product.title);
    console.log('SKU:', product.sku);
    console.log('\n📏 WEIGHTS:');
    console.log('   Net Weight (weightGrams):', product.weightGrams + 'g');
    console.log('   Gross Weight (grossGoldWeight):', product.grossGoldWeight + 'g');
    console.log('\n💰 MAKING CHARGE CALCULATION:');
    console.log('   Rate: ₹' + product.makingChargeValue + '/g');
    console.log('   OLD (using net weight): ' + product.weightGrams + 'g × ₹' + product.makingChargeValue + ' = ₹' + (product.weightGrams * product.makingChargeValue).toFixed(2));
    console.log('   NEW (using gross weight): ' + product.grossGoldWeight + 'g × ₹' + product.makingChargeValue + ' = ₹' + (product.grossGoldWeight * product.makingChargeValue).toFixed(2));
    console.log('   Difference: ₹' + Math.abs((product.grossGoldWeight - product.weightGrams) * product.makingChargeValue).toFixed(2));

    const result = await PricingService.calculateProductPrice(
        product,
        metalRate.ratePerGram,
        null,
        settings,
        null
    );

    console.log('\n✅ NEW CALCULATED PRICE: ₹' + result.price.toFixed(2));
    console.log('\n');

    await prisma.$disconnect();
}

testBracelet();
