const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function testImportCalculation() {
    const product = await prisma.product.findFirst({
        where: { sku: 'SRJ-LWH-0045' },
        include: { gemstones: true, makingGroup: true }
    });

    if (!product) {
        console.log('❌ Product not found');
        return;
    }

    const shop = await prisma.shop.findFirst();

    console.log('\n🧪 TESTING IMPORT PRICE CALCULATION');
    console.log('Product:', product.sku);
    console.log('Shop ID:', shop.id);
    console.log('Product ID:', product.id);

    try {
        console.log('\n📊 Calling PricingService.calculateBulkPrices...');
        const priceResults = await PricingService.calculateBulkPrices(shop.id, [product.id]);

        console.log('\n✅ Results:', priceResults.length);

        if (priceResults.length > 0) {
            const priceData = priceResults[0];
            console.log('\n💰 Price Data:');
            console.log('   Old Price: ₹' + priceData.oldPrice);
            console.log('   New Price: ₹' + priceData.newPrice);
            console.log('   Breakdown:', JSON.stringify(priceData.breakdown, null, 2));

            console.log('\n✅ This SHOULD be saved to database during import!');
            console.log('   Expected DB price: ₹' + priceData.newPrice);
            console.log('   Current DB price: ₹' + product.currentPrice);

            if (Math.abs(priceData.newPrice - product.currentPrice) > 1) {
                console.log('\n❌ PRICES DO NOT MATCH - Import is NOT saving!');
            } else {
                console.log('\n✅ Prices match - Import is working!');
            }
        } else {
            console.log('\n❌ NO RESULTS RETURNED!');
            console.log('This is why import is not saving prices!');
        }

    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        console.log('Stack:', error.stack);
    }

    await prisma.$disconnect();
}

testImportCalculation();
