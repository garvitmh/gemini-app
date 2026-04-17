const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProduct() {
    const product = await prisma.product.findFirst({
        where: { sku: 'SRJ-LWH-0045' },
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
    console.log('   Modal Shows: ₹74,516.90');
    console.log('   Difference: ₹' + (product.currentPrice - 74516.90).toFixed(2));

    console.log('\n⚙️ PRODUCT DATA:');
    console.log('   Metal:', product.metal, product.karat + 'K');
    console.log('   Weight:', product.weightGrams + 'g');
    console.log('   Gross Weight:', product.grossGoldWeight + 'g');
    console.log('   Wastage %:', product.wastagePct);
    console.log('   GST %:', product.gstPct);
    console.log('   Making Type:', product.makingChargeType);
    console.log('   Making Value: ₹' + product.makingChargeValue);

    console.log('\n💎 GEMSTONES:', product.gemstones.length);
    product.gemstones.forEach((gem, i) => {
        console.log(`   ${i + 1}. ${gem.name}: ${gem.pieces} pcs × ${gem.carats} ct × ₹${gem.ratePerCarat}/ct = ₹${gem.totalPrice}`);
    });

    console.log('\n📊 ANALYSIS:');
    if (Math.abs(product.currentPrice - 74516.90) < 1) {
        console.log('   ✅ Prices MATCH!');
    } else {
        console.log('   ❌ Prices DO NOT MATCH!');
        console.log('   This is expected - database has old price from old metal rates');
        console.log('   Solution: Re-import this product to update with current rates');
    }

    await prisma.$disconnect();
}

checkProduct();
