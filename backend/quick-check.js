const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNow() {
    const product = await prisma.product.findFirst({
        where: { sku: 'SRJ-LWH-0045' },
        include: { gemstones: true }
    });

    console.log('\n📦 Product: SRJ-LWH-0045');
    console.log('💰 Database Price: ₹' + product.currentPrice);
    console.log('📱 Modal Shows: ₹74,516.90');
    console.log('📊 Difference: ₹' + Math.abs(product.currentPrice - 74516.90).toFixed(2));

    console.log('\n⚙️ Product Details:');
    console.log('   Metal:', product.metal, product.karat + 'K');
    console.log('   Weight:', product.weightGrams + 'g');
    console.log('   Gross Weight:', product.grossGoldWeight + 'g');
    console.log('   Making Type:', product.makingChargeType);
    console.log('   Making Value: ₹' + product.makingChargeValue);
    console.log('   Wastage %:', product.wastagePct);
    console.log('   GST %:', product.gstPct);
    console.log('   Gemstones:', product.gemstones.length);

    if (Math.abs(product.currentPrice - 74516.90) < 100) {
        console.log('\n✅ PRICES ARE CLOSE! Import worked!');
    } else {
        console.log('\n❌ PRICES STILL DIFFERENT!');
        console.log('   Need to investigate further...');
    }

    await prisma.$disconnect();
}

checkNow();
