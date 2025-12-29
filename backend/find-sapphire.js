const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findProduct() {
    try {
        // Search for products with gemstones
        const products = await prisma.product.findMany({
            where: {
                title: { contains: 'Sapphire' }
            },
            include: {
                gemstones: true
            },
            take: 10
        });

        console.log(`\n=== FOUND ${products.length} SAPPHIRE PRODUCTS ===\n`);

        products.forEach((p, i) => {
            console.log(`${i + 1}. ${p.title}`);
            console.log(`   Gemstones: ${p.gemstones.length}`);
            if (p.gemstones.length > 0) {
                p.gemstones.forEach(g => {
                    console.log(`   - ${g.gemstoneType}: ${g.gemstonePieces} pieces, ${g.gemstoneWeight} ct`);
                });
            }
            console.log('');
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findProduct();
