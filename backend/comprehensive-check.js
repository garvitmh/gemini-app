const { PrismaClient } = require('@prisma/client');
const PricingService = require('./dist/services/pricing.service').PricingService;

const prisma = new PrismaClient();

async function comprehensiveCheck() {
    const product = await prisma.product.findFirst({
        where: { sku: 'SRJ-LWH-0045' },
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

    console.log('\n🔍 COMPREHENSIVE PRICE ANALYSIS');
    console.log('================================\n');

    console.log('📦 PRODUCT DATA (from database):');
    console.log('   SKU:', product.sku);
    console.log('   Metal:', product.metal, product.karat + 'K');
    console.log('   Weight (for making):', product.weightGrams + 'g');
    console.log('   Gross Weight (for metal):', product.grossGoldWeight + 'g');
    console.log('   Wastage %:', product.wastagePct);
    console.log('   Making Type:', product.makingChargeType);
    console.log('   Making Value: ₹' + product.makingChargeValue);
    console.log('   GST %:', product.gstPct);

    console.log('\n💰 METAL RATE:');
    console.log('   Rate: ₹' + metalRate.ratePerGram + '/g');

    console.log('\n🧮 MANUAL CALCULATION:');
    const metalValue = product.grossGoldWeight * metalRate.ratePerGram;
    const wastage = metalValue * (product.wastagePct / 100);
    const making = product.weightGrams * product.makingChargeValue;
    const subtotal = metalValue + wastage + making;
    const gst = subtotal * (product.gstPct / 100);
    const total = subtotal + gst;

    console.log('   Metal: ' + product.grossGoldWeight + 'g × ₹' + metalRate.ratePerGram + '/g = ₹' + metalValue.toFixed(2));
    console.log('   Wastage: ₹' + metalValue.toFixed(2) + ' × ' + product.wastagePct + '% = ₹' + wastage.toFixed(2));
    console.log('   Making: ' + product.weightGrams + 'g × ₹' + product.makingChargeValue + '/g = ₹' + making.toFixed(2));
    console.log('   Subtotal: ₹' + subtotal.toFixed(2));
    console.log('   GST: ₹' + subtotal.toFixed(2) + ' × ' + product.gstPct + '% = ₹' + gst.toFixed(2));
    console.log('   TOTAL: ₹' + total.toFixed(2));

    console.log('\n🔧 PRICING SERVICE CALCULATION:');
    const result = await PricingService.calculateProductPrice(
        product,
        metalRate.ratePerGram,
        null,
        settings,
        null
    );
    console.log('   Result: ₹' + result.price);

    console.log('\n📊 COMPARISON:');
    console.log('   Manual Calc: ₹' + total.toFixed(2));
    console.log('   Pricing Service: ₹' + result.price);
    console.log('   Database: ₹' + product.currentPrice);
    console.log('   Modal Shows: ₹74,516.90');

    console.log('\n🎯 MODAL REVERSE CALCULATION:');
    // If modal shows ₹74,516.90, what weights would give that?
    // Assuming: Subtotal = ₹72,346.50, GST = ₹2,170.40
    const modalSubtotal = 74516.90 / 1.03;
    console.log('   Modal Subtotal (before GST): ₹' + modalSubtotal.toFixed(2));

    // If making = ₹15,727.50 (same), then metal must be:
    const modalMetal = modalSubtotal - making;
    console.log('   Modal Metal Value: ₹' + modalMetal.toFixed(2));

    // What gross weight gives this metal value?
    const modalGrossWeight = modalMetal / metalRate.ratePerGram;
    console.log('   Modal Gross Weight: ' + modalGrossWeight.toFixed(3) + 'g');
    console.log('   Database Gross Weight: ' + product.grossGoldWeight + 'g');
    console.log('   Difference: ' + (product.grossGoldWeight - modalGrossWeight).toFixed(3) + 'g');

    await prisma.$disconnect();
}

comprehensiveCheck();
