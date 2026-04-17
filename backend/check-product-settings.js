const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProductSettings() {
    const product = await prisma.product.findFirst({
        where: { sku: '01591-MO-750' },
        include: { makingGroup: true }
    });

    if (!product) {
        console.log('Product not found');
        return;
    }

    console.log('\n📦 Product:', product.sku);
    console.log('   Current Price:', product.currentPrice);
    console.log('\n🔧 Making Charges:');
    console.log('   Type:', product.makingChargeType);
    console.log('   Value:', product.makingChargeValue);
    console.log('   Group ID:', product.makingGroupId);
    console.log('   Group:', product.makingGroup ? product.makingGroup.name : 'None');

    console.log('\n💎 Other Settings:');
    console.log('   Wastage %:', product.wastagePct);
    console.log('   GST %:', product.gstPct);
    console.log('   Discount:', product.discount, product.discountType);
    console.log('   Enamel:', product.enamelColor, product.enamelWeightGrams + 'g');

    // Check shop settings
    const shop = await prisma.shop.findFirst();
    console.log('\n🏪 Shop Default Settings:');
    console.log('   Settings:', JSON.stringify(shop.settings, null, 2));

    await prisma.$disconnect();
}

checkProductSettings();
