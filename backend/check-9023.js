const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function checkProduct() {
    const product = await prisma.product.findFirst({
        where: { sku: '9023-MO-2150' },
        include: { gemstones: true }
    });

    if (!product) {
        console.log('❌ Product not found');
        return;
    }

    console.log('\n📦 Product:', product.sku);
    console.log('   Title:', product.title);

    console.log('\n💰 DATABASE:');
    console.log('   Current Price: ₹' + product.currentPrice);
    console.log('   Last Calculated: ₹' + product.lastCalculatedPrice);

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
    let totalGemCost = 0;
    product.gemstones.forEach((gem, i) => {
        const cost = gem.totalPrice || 0;
        totalGemCost += cost;
        console.log(`   ${i + 1}. ${gem.name}: ${gem.pieces} pcs × ${gem.carats} ct × ₹${gem.ratePerCarat}/ct = ₹${cost.toFixed(2)}`);
    });
    console.log('   Total Gem Cost: ₹' + totalGemCost.toFixed(2));

    // Get current metal rate
    const shop = await prisma.shop.findFirst();
    const metalRate = await prisma.metalRate.findFirst({
        where: {
            shopId: shop.id,
            metal: product.metal,
            karat: product.karat
        }
    });

    console.log('\n📊 CURRENT METAL RATE:');
    console.log('   Rate: ₹' + metalRate.ratePerGram + '/g');

    // Manual calculation
    console.log('\n🧮 MANUAL CALCULATION:');
    const grossWeight = product.autoGrossGoldWeight ?
        (product.weightGrams + totalGemCost / metalRate.ratePerGram) :
        product.grossGoldWeight;

    console.log('   Gross Weight Used:', grossWeight + 'g');
    const metalValue = grossWeight * metalRate.ratePerGram;
    const wastage = metalValue * (product.wastagePct / 100);
    const making = product.weightGrams * product.makingChargeValue;
    const subtotal = metalValue + wastage + making + totalGemCost;
    const gst = subtotal * (product.gstPct / 100);
    const total = subtotal + gst;

    console.log('   Metal Value: ₹' + metalValue.toFixed(2));
    console.log('   Wastage: ₹' + wastage.toFixed(2));
    console.log('   Making: ₹' + making.toFixed(2));
    console.log('   Gemstones: ₹' + totalGemCost.toFixed(2));
    console.log('   Subtotal: ₹' + subtotal.toFixed(2));
    console.log('   GST: ₹' + gst.toFixed(2));
    console.log('   TOTAL: ₹' + total.toFixed(2));

    console.log('\n📊 COMPARISON:');
    console.log('   Database: ₹' + product.currentPrice);
    console.log('   Calculated: ₹' + total.toFixed(2));
    console.log('   Modal Shows: ₹23,982.03');
    console.log('   Difference (DB vs Calc): ₹' + (total - product.currentPrice).toFixed(2));

    // Now use pricing service
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

    console.log('\n🔧 PRICING SERVICE RESULT:');
    console.log('   Price: ₹' + result.price);
    console.log('   Matches Modal:', result.price.toFixed(2) === '23982.03' ? 'YES ✅' : 'NO ❌');

    await prisma.$disconnect();
}

checkProduct();
