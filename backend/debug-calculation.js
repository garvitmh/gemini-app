const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugCalculation() {
    const product = await prisma.product.findFirst({
        where: { sku: 'MO26CT-1800' },
        include: { gemstones: true }
    });

    const shop = await prisma.shop.findFirst();
    const metalRate = await prisma.metalRate.findFirst({
        where: {
            shopId: shop.id,
            metal: product.metal,
            karat: product.karat
        }
    });

    const settings = await prisma.shopSettings.findUnique({
        where: { shopId: shop.id }
    });

    console.log('\n📊 CALCULATION BREAKDOWN:');
    console.log('\n1. METAL:');
    console.log('   Type:', product.metal, product.karat + 'K');
    console.log('   Rate per gram: ₹' + metalRate.ratePerGram);
    console.log('   Gross Weight:', product.grossGoldWeight + 'g');
    console.log('   Metal Value: ₹' + (product.grossGoldWeight * metalRate.ratePerGram).toFixed(2));

    console.log('\n2. WASTAGE:');
    console.log('   Wastage %:', product.wastagePct);
    const wastage = (product.grossGoldWeight * metalRate.ratePerGram) * (product.wastagePct / 100);
    console.log('   Wastage Amount: ₹' + wastage.toFixed(2));

    console.log('\n3. MAKING CHARGES:');
    console.log('   Type:', product.makingChargeType);
    console.log('   Value: ₹' + product.makingChargeValue);
    console.log('   Weight for making:', product.weightGrams + 'g');
    const making = product.weightGrams * product.makingChargeValue;
    console.log('   Making Charges: ₹' + making.toFixed(2));

    console.log('\n4. GEMSTONES:');
    console.log('   Count:', product.gemstones.length);
    console.log('   Total Cost: ₹0');

    console.log('\n5. SUBTOTAL:');
    const metalValue = product.grossGoldWeight * metalRate.ratePerGram;
    const subtotal = metalValue + wastage + making;
    console.log('   Metal + Wastage + Making: ₹' + subtotal.toFixed(2));

    console.log('\n6. GST:');
    console.log('   GST %:', product.gstPct);
    const gst = subtotal * (product.gstPct / 100);
    console.log('   GST Amount: ₹' + gst.toFixed(2));

    console.log('\n7. FINAL:');
    const total = subtotal + gst;
    console.log('   Total: ₹' + total.toFixed(2));
    console.log('   Database: ₹' + product.currentPrice);
    console.log('   Difference: ₹' + (total - product.currentPrice).toFixed(2));

    // Check if there's a breakdown HTML
    if (product.priceBreakdownHtml) {
        console.log('\n📋 BREAKDOWN HTML EXISTS:');
        console.log(product.priceBreakdownHtml.substring(0, 500) + '...');
    }

    await prisma.$disconnect();
}

debugCalculation();
