import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
    console.log('\n🔍 Checking Database Status...\n');

    try {
        // Check shop
        const shop = await prisma.shop.findFirst();
        console.log('Shop:', shop ? `✅ ${shop.domain}` : '❌ Not found');

        if (!shop) {
            console.log('\n❌ No shop found! Please run setup first.');
            process.exit(1);
        }

        // Check products
        const productCount = await prisma.product.count({ where: { shopId: shop.id } });
        console.log(`Products: ${productCount} total`);

        if (productCount === 0) {
            console.log('   ⚠️  No products found! Please sync from Shopify.');
        } else {
            const sampleProduct = await prisma.product.findFirst({
                where: { shopId: shop.id },
                include: { gemstones: true }
            });
            console.log(`\n   Sample Product: ${sampleProduct?.title}`);
            console.log(`   SKU: ${sampleProduct?.sku}`);
            console.log(`   Weight: ${sampleProduct?.weightGrams}g`);
            console.log(`   Metal: ${sampleProduct?.metal} ${sampleProduct?.karat ? sampleProduct.karat + 'K' : ''}`);
            console.log(`   Current Price: ₹${sampleProduct?.currentPrice || 0}`);
            console.log(`   Last Calculated Price: ₹${sampleProduct?.lastCalculatedPrice || 0}`);
            console.log(`   Last Pushed Price: ₹${sampleProduct?.lastPushedPrice || 0}`);
        }

        // Check metal rates
        const metalRates = await prisma.metalRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
            take: 5
        });
        console.log(`\nMetal Rates: ${metalRates.length} found`);
        if (metalRates.length === 0) {
            console.log('   ⚠️  No metal rates found! Please add rates first.');
        } else {
            metalRates.forEach(rate => {
                console.log(`   ${rate.metal} ${rate.karat ? rate.karat + 'K' : ''}: ₹${rate.ratePerGram}/g`);
            });
        }

        // Check price history
        const priceHistory = await prisma.priceHistory.findMany({
            orderBy: { pushedAt: 'desc' },
            take: 5,
            include: { product: { select: { sku: true } } }
        });
        console.log(`\nRecent Price Updates: ${priceHistory.length} found`);
        priceHistory.forEach(h => {
            console.log(`   ${h.product.sku}: ${h.status} - ₹${h.oldPrice} → ₹${h.newPrice}`);
            if (h.errorMessage) {
                console.log(`      Error: ${h.errorMessage}`);
            }
        });

        console.log('\n✅ Database check complete\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();
