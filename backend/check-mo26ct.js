const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProduct() {
    const product = await prisma.product.findFirst({
        where: { sku: 'MO26CT-1800' },
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
    console.log('   Database Current Price: ₹' + product.currentPrice);
    console.log('   Last Calculated Price: ₹' + product.lastCalculatedPrice);
    console.log('   Modal Shows: ₹11,001.64');
    console.log('   DISCREPANCY: ₹' + (11001.64 - product.currentPrice).toFixed(2));

    console.log('\n⚙️ PRODUCT DATA:');
    console.log('   Metal:', product.metal, product.karat + 'K');
    console.log('   Weight:', product.weightGrams + 'g');
    console.log('   Gross Weight:', product.grossGoldWeight + 'g');
    console.log('   Wastage %:', product.wastagePct);
    console.log('   GST %:', product.gstPct);

    console.log('\n🔧 MAKING CHARGES:');
    console.log('   Type:', product.makingChargeType);
    console.log('   Value: ₹' + product.makingChargeValue);
    console.log('   Group:', product.makingGroup ? product.makingGroup.name : 'None');

    console.log('\n💎 GEMSTONES:', product.gemstones.length);
    let totalGemCost = 0;
    product.gemstones.forEach((gem, i) => {
        const cost = gem.totalPrice || (gem.pieces * gem.carats * gem.ratePerCarat);
        totalGemCost += cost;
        console.log(`   ${i + 1}. ${gem.name}: ${gem.pieces} pcs × ${gem.carats} ct × ₹${gem.ratePerCarat}/ct = ₹${cost.toFixed(2)}`);
    });
    console.log('   Total Gemstone Cost: ₹' + totalGemCost.toFixed(2));

    console.log('\n🎨 ENAMEL:');
    console.log('   Color:', product.enamelColor || 'None');
    console.log('   Weight:', product.enamelWeightGrams + 'g');
    console.log('   Discount:', product.enamelDiscountValue, product.enamelDiscountType);

    console.log('\n💸 DISCOUNTS:');
    console.log('   Overall:', product.discount, product.discountType);

    console.log('\n📊 BREAKDOWN HTML:');
    if (product.priceBreakdownHtml) {
        console.log('   ✅ Exists');
        console.log('\n' + product.priceBreakdownHtml);
    } else {
        console.log('   ❌ Missing');
    }

    // Manual calculation
    console.log('\n🧮 MANUAL CALCULATION:');
    const metalRate = 4200; // 18K gold rate (approximate)
    const metalValue = product.grossGoldWeight * metalRate;
    const wastage = metalValue * (product.wastagePct / 100);
    const makingCharges = product.weightGrams * product.makingChargeValue;
    const subtotal = metalValue + wastage + makingCharges + totalGemCost;
    const gst = subtotal * (product.gstPct / 100);
    const total = subtotal + gst;

    console.log('   Metal Value: ₹' + metalValue.toFixed(2) + ' (' + product.grossGoldWeight + 'g × ₹' + metalRate + ')');
    console.log('   Wastage: ₹' + wastage.toFixed(2) + ' (' + product.wastagePct + '%)');
    console.log('   Making: ₹' + makingCharges.toFixed(2) + ' (' + product.weightGrams + 'g × ₹' + product.makingChargeValue + ')');
    console.log('   Gemstones: ₹' + totalGemCost.toFixed(2));
    console.log('   Subtotal: ₹' + subtotal.toFixed(2));
    console.log('   GST: ₹' + gst.toFixed(2) + ' (' + product.gstPct + '%)');
    console.log('   TOTAL: ₹' + total.toFixed(2));

    await prisma.$disconnect();
}

checkProduct();
