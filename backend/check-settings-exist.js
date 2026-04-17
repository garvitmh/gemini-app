const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSettings() {
    const shop = await prisma.shop.findFirst();
    const settings = await prisma.shopSettings.findUnique({
        where: { shopId: shop.id }
    });

    console.log('\n🏪 Shop Settings:');
    if (settings) {
        console.log('   ✅ Settings exist!');
        console.log('   Default Making Type:', settings.defaultMakingChargeType);
        console.log('   Default Making Value:', settings.defaultMakingChargeValue);
        console.log('   Default Wastage %:', settings.defaultWastagePct);
        console.log('   Default GST %:', settings.defaultGstPct);
    } else {
        console.log('   ❌ No settings found!');
        console.log('   Need to create default settings');
    }

    await prisma.$disconnect();
}

checkSettings();
