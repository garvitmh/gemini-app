import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Create a sample shop (for testing without Shopify OAuth)
    const shop = await prisma.shop.upsert({
        where: { domain: 'daginawala11.myshopify.com' },
        create: {
            domain: 'daginawala11.myshopify.com',
            accessToken: 'test_token',
            scope: 'write_products,read_products',
            isActive: true,
        },
        update: {},
    });

    console.log('Created shop:', shop.domain);

    // Create shop settings
    await prisma.shopSettings.upsert({
        where: { shopId: shop.id },
        create: {
            shopId: shop.id,
            defaultMakingPerGram: 1500,
            defaultMakingChargeType: 'per_gram',
            defaultMakingChargeValue: 1500,
            defaultWastagePct: 2,
            defaultGstPct: 3,
            defaultDiscount: 0,
        },
        update: {},
    });

    // Create metal rates
    const metalRates = [
        { metal: 'gold', karat: 24, ratePerGram: 7200 },
        { metal: 'gold', karat: 22, ratePerGram: 6600 },
        { metal: 'gold', karat: 18, ratePerGram: 5400 },
        { metal: 'gold', karat: 14, ratePerGram: 4200 },
        { metal: 'silver', karat: null, ratePerGram: 85 },
        { metal: 'platinum', karat: null, ratePerGram: 3500 },
    ];

    for (const rate of metalRates) {
        await prisma.metalRate.create({
            data: {
                shopId: shop.id,
                ...rate,
                rateSource: 'manual',
                reason: 'Initial seed data',
            },
        });
    }

    console.log('Created metal rates');

    // Create stone rates
    const stoneRates = [
        { stoneType: 'diamond', ratePerCarat: 250000, ratePerPiece: null, unitType: 'carat' },
        { stoneType: 'ruby', ratePerCarat: 150000, ratePerPiece: null, unitType: 'carat' },
        { stoneType: 'sapphire', ratePerCarat: 120000, ratePerPiece: null, unitType: 'carat' },
        { stoneType: 'emerald', ratePerCarat: 180000, ratePerPiece: null, unitType: 'carat' },
        { stoneType: 'gemstone', ratePerCarat: 50000, ratePerPiece: 5000, unitType: 'carat' },
    ];

    for (const rate of stoneRates) {
        await prisma.stoneRate.create({
            data: {
                shopId: shop.id,
                ...rate,
                reason: 'Initial seed data',
            },
        });
    }

    console.log('Created stone rates');

    // Create sample products
    const products = [
        {
            shopifyProductId: 'gid://shopify/Product/1',
            shopifyVariantId: 'gid://shopify/ProductVariant/1',
            sku: 'RING-001',
            title: 'Gold Diamond Ring',
            weightGrams: 5.5,
            metal: 'gold',
            karat: 22,
            stoneWeightCarat: 0.25,
            stoneType: 'diamond',
            currentPrice: 45000,
        },
        {
            shopifyProductId: 'gid://shopify/Product/2',
            shopifyVariantId: 'gid://shopify/ProductVariant/2',
            sku: 'NECK-001',
            title: 'Gold Chain',
            weightGrams: 15.8,
            metal: 'gold',
            karat: 22,
            currentPrice: 125000,
        },
        {
            shopifyProductId: 'gid://shopify/Product/3',
            shopifyVariantId: 'gid://shopify/ProductVariant/3',
            sku: 'BRAC-001',
            title: 'Silver Bracelet',
            weightGrams: 8.5,
            metal: 'silver',
            currentPrice: 1200,
        },
    ];

    for (const product of products) {
        await prisma.product.upsert({
            where: { shopifyVariantId: product.shopifyVariantId },
            create: {
                shopId: shop.id,
                ...product,
            },
            update: {
                ...product,
            },
        });
    }

    console.log('Created sample products');

    console.log('✅ Seed completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
