
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Independent implementation of logic to verify against
const verifyPrice = (product: any, rate: number, settings: any) => {
    const weight = product.weightGrams || 0;
    const metalValueRaw = rate * weight;

    // Defaults Logic Check
    const wastagePct = settings.defaultWastagePct ?? 2;
    const makingPerGram = settings.defaultMakingPerGram ?? 1500;
    const gstPct = settings.defaultGstPct ?? 3;
    const discount = settings.defaultDiscount ?? 0;

    const wastageAmount = metalValueRaw * (wastagePct / 100);
    const metalValue = metalValueRaw + wastageAmount;
    const makingCharge = makingPerGram * weight;

    const gemstoneCost = product.isManualGemstonePrice ? (product.manualGemstonePrice || 0) : 0; // Simplified for manual

    const subtotal = metalValue + makingCharge + gemstoneCost;
    const gstAmount = subtotal * (gstPct / 100);
    const finalPrice = subtotal + gstAmount - discount;

    return {
        finalPrice,
        breakdown: {
            metalValue,
            makingCharge,
            gstAmount,
            subtotal
        }
    };
};

async function main() {
    console.log('🔍 Starting Full System Verification...');

    // 1. Check Shop Settings
    const shop = await prisma.shop.findFirst({ include: { settings: true } });
    if (!shop || !shop.settings) {
        console.error('❌ FAIL: Shop or Settings not found!');
        process.exit(1);
    }
    console.log('✅ Shop Settings Found');
    if (shop.settings.defaultMakingPerGram !== 1500) console.warn('⚠️ Warning: Making Charge is not 1500 (Standard default)');
    if (shop.settings.defaultWastagePct !== 2) console.warn('⚠️ Warning: Wastage is not 2% (Standard default)');

    // 2. Check Metal Rate
    const rate = await prisma.metalRate.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!rate) {
        console.error('❌ FAIL: No Metal Rate found!');
        process.exit(1);
    }
    console.log(`✅ Metal Rate Found: ${rate.metal} @ ${rate.ratePerGram}`);

    // 3. Check Product
    const product = await prisma.product.findFirst({ where: { weightGrams: { gt: 0 } } });
    if (!product) {
        console.error('❌ FAIL: No test product found!');
        process.exit(1);
    }
    console.log(`✅ Test Product Found: ${product.title} (${product.weightGrams}g)`);

    // 4. Verify Math
    console.log('🧮 Verifying Calculation Logic...');
    const verification = verifyPrice(product, rate.ratePerGram, shop.settings);

    console.log(`   Expected Price: ${verification.finalPrice.toFixed(2)}`);
    console.log(`   DB Current Price: ${product.currentPrice?.toFixed(2)}`);

    // Allow small float diff
    const diff = Math.abs(verification.finalPrice - (product.currentPrice || 0));
    if (diff > 0.05) {
        console.error(`❌ FAIL: Price Mismatch! Expected ${verification.finalPrice}, got ${product.currentPrice}`);
        // Note: Mismatch might happen if rate changed but product wasn't updated yet.
        console.log('   (Note: Run a Rate Update to sync)');
    } else {
        console.log('✅ Price Logic Matches DB');
    }

    console.log('✅ Verification Complete');
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
