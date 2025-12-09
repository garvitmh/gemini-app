
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const calculateProductPrice = (product: any, ratePerGram: number, settings: any) => {
    const weight = product.weightGrams || 0;
    const metalValueRaw = ratePerGram * weight;
    const wastageAmount = metalValueRaw * ((settings.defaultWastagePct || 0) / 100);
    const metalValue = metalValueRaw + wastageAmount;

    // Making charge (per gram)
    const makingCharge = (settings.defaultMakingPerGram || 0) * weight;

    let gemstoneCost = 0;
    if (product.isManualGemstonePrice) {
        gemstoneCost = product.manualGemstonePrice || 0;
    }

    const subtotal = metalValue + makingCharge + gemstoneCost;
    const gstAmount = subtotal * ((settings.defaultGstPct || 0) / 100);
    const finalPrice = subtotal + gstAmount - (settings.defaultDiscount || 0);

    return {
        price: finalPrice,
        breakdown: {
            metal_rate: ratePerGram,
            metal_value: metalValue,
            wastage_amount: wastageAmount,
            wastage_pct: settings.defaultWastagePct || 0,
            making_charges: makingCharge,
            making_charge_per_gram: settings.defaultMakingPerGram || 0,
            gemstone_price: gemstoneCost,
            subtotal: subtotal,
            gst: gstAmount,
            gst_pct: settings.defaultGstPct || 0,
            discount: settings.defaultDiscount || 0,
            total: finalPrice
        }
    };
};

async function main() {
    const shop = await prisma.shop.findFirst({ include: { settings: true } });
    if (!shop) {
        console.log('No shop found');
        return;
    }

    console.log('--- Settings ---');
    console.log(JSON.stringify(shop.settings, null, 2));

    const metalRate = await prisma.metalRate.findFirst({ orderBy: { updatedAt: 'desc' } });
    console.log('--- Latest Metal Rate ---');
    console.log(JSON.stringify(metalRate, null, 2));

    const product = await prisma.product.findFirst({ where: { weightGrams: { gt: 0 } } });
    if (!product) {
        console.log('No product with weight found');
        return;
    }
    console.log('--- Sample Product ---');
    console.log(`Title: ${product.title}`);
    console.log(`Weight: ${product.weightGrams}`);
    console.log(`Manual Gemstone: ${product.isManualGemstonePrice} (${product.manualGemstonePrice})`);

    // Simulate Calculation
    const settings = shop.settings || {
        defaultMakingPerGram: 1500,
        defaultWastagePct: 2,
        defaultGstPct: 3,
        defaultDiscount: 0,
    };

    // Mock settings check
    if (!shop.settings) console.log('WARNING: Using default settings fallback!');

    if (metalRate) {
        console.log('--- Calculation Result ---');
        const calc = calculateProductPrice(product, metalRate.ratePerGram, settings);
        console.log(JSON.stringify(calc, null, 2));
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
