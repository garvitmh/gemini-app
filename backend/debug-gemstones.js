// Debug script to check multiple gemstones calculation
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugMultipleGemstones() {
    try {
        const shop = await prisma.shop.findFirst();

        // Find Yellow Sapphire product
        const product = await prisma.product.findFirst({
            where: {
                shopId: shop.id,
                title: { contains: 'Yellow Sapphire' }
            },
            include: {
                gemstones: true
            }
        });

        if (!product) {
            console.log('Product not found');
            return;
        }

        console.log('\n📊 Multiple Gemstones Debug');
        console.log('─'.repeat(60));
        console.log(`Product: ${product.title}`);
        console.log(`\nGemstones in database: ${product.gemstones.length}`);

        if (product.gemstones.length > 0) {
            product.gemstones.forEach((gem, idx) => {
                console.log(`\n  Gemstone ${idx + 1}:`);
                console.log(`    Type: ${gem.gemstoneType}`);
                console.log(`    Cut: ${gem.gemstoneCut || 'N/A'}`);
                console.log(`    Color: ${gem.gemstoneColor || 'N/A'}`);
                console.log(`    Clarity: ${gem.gemstoneClarity || 'N/A'}`);
                console.log(`    Weight: ${gem.gemstoneWeight || 'N/A'}ct`);
                console.log(`    Pieces: ${gem.gemstonePieces || 'N/A'}`);
                console.log(`    Discount: ${gem.discountType || 'none'} ${gem.discountValue || 0}`);
            });
        } else {
            console.log('  ⚠️  No gemstones found in database!');
        }

        console.log('\n' + '─'.repeat(60));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

debugMultipleGemstones();
