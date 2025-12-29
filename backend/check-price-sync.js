const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPriceSync() {
    try {
        const shop = await prisma.shop.findFirst();

        // Find Yellow Sapphire product
        const product = await prisma.product.findFirst({
            where: {
                shopId: shop.id,
                title: { contains: 'Yellow Sapphire' }
            }
        });

        if (!product) {
            console.log('Product not found');
            return;
        }

        console.log('\n📊 Price Sync Check for:', product.title);
        console.log('─'.repeat(60));
        console.log(`SKU: ${product.sku}`);
        console.log(`Current Price (DB): ₹${(product.currentPrice || 0).toFixed(2)}`);
        console.log(`Last Calculated: ₹${(product.lastCalculatedPrice || 0).toFixed(2)}`);
        console.log(`Last Pushed: ₹${(product.lastPushedPrice || 0).toFixed(2)}`);

        // Get latest price history
        const history = await prisma.priceHistory.findFirst({
            where: { productId: product.id },
            orderBy: { timestamp: 'desc' }
        });

        if (history) {
            console.log(`\nLatest Price History:`);
            console.log(`  Timestamp: ${history.timestamp}`);
            console.log(`  Old Price: ₹${(history.oldPrice || 0).toFixed(2)}`);
            console.log(`  New Price: ₹${(history.newPrice || 0).toFixed(2)}`);
            console.log(`  Status: ${history.status}`);
        }

        console.log('\n' + '─'.repeat(60));

        if (product.currentPrice !== product.lastCalculatedPrice) {
            console.log('⚠️  WARNING: currentPrice !== lastCalculatedPrice');
            console.log(`   Difference: ₹${Math.abs((product.currentPrice || 0) - (product.lastCalculatedPrice || 0)).toFixed(2)}`);
        } else {
            console.log('✅ Prices are in sync');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkPriceSync();
