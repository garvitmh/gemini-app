const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkShopSettings() {
    const shop = await prisma.shop.findFirst();

    console.log('\n🏪 Shop Settings:');
    console.log('   ID:', shop.id);
    console.log('   Domain:', shop.domain);
    console.log('   Settings:', shop.settings);
    console.log('   Making Charge Per Gram:', shop.makingChargePerGram);
    console.log('   Making Charge Percent:', shop.makingChargePercent);
    console.log('   Default Making Type:', shop.defaultMakingChargeType);
    console.log('   Default Making Value:', shop.defaultMakingChargeValue);

    await prisma.$disconnect();
}

checkShopSettings();
