const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProduct() {
    const product = await prisma.product.findFirst({
        where: { sku: 'MOZSCT-1800' },
        include: {
            gemstones: true,
            makingGroup: true
        }
    });

    if (!product) {
        console.log('❌ Product not found');
        return;
    }

    console.log('\n📦 Product:', product.sku);
    console.log('   Title:', product.title);
    console.log('\n💰 PRICES:');
    console.log('   Database Current Price:', product.currentPrice);
    console.log('   Last Calculated Price:', product.lastCalculatedPrice);
    console.log('   Last Pushed Price:', product.lastPushedPrice);

    console.log('\n⚙️ PRODUCT DATA:');
    console.log('   Metal:', product.metal, product.karat + 'K');
    console.log('   Weight:', product.weightGrams + 'g');
    console.log('   Gross Weight:', product.grossGoldWeight + 'g');
    console.log('   Wastage %:', product.wastagePct);
    console.log('   GST %:', product.gstPct);

    console.log('\n🔧 MAKING CHARGES:');
    console.log('   Type:', product.makingChargeType);
    console.log('   Value:', product.makingChargeValue);
    console.log('   Group:', product.makingGroup ? product.makingGroup.name : 'None');

    console.log('\n💎 GEMSTONES:', product.gemstones.length);
    product.gemstones.forEach((gem, i) => {
        console.log(`   ${i + 1}. ${gem.name}: ${gem.pieces} pcs, ${gem.carats} ct, ₹${gem.ratePerCarat}/ct = ₹${gem.totalPrice}`);
    });

    console.log('\n🎨 ENAMEL:');
    console.log('   Color:', product.enamelColor || 'None');
    console.log('   Weight:', product.enamelWeightGrams + 'g');
    console.log('   Discount:', product.enamelDiscountValue, product.enamelDiscountType);

    console.log('\n💸 DISCOUNTS:');
    console.log('   Overall:', product.discount, product.discountType);

    console.log('\n📊 BREAKDOWN HTML:');
    console.log(product.priceBreakdownHtml ? '   ✅ Exists' : '   ❌ Missing');

    await prisma.$disconnect();
}

checkProduct();
