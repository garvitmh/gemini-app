
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- SHOP DISTRIBUTION ANALYSIS ---");

    // Group products by Shop ID
    const shopCounts = await prisma.product.groupBy({
        by: ['shopId'],
        _count: {
            id: true
        }
    });

    console.log(`Total Shops with Products: ${shopCounts.length}`);

    for (const shop of shopCounts) {
        console.log(`Shop ID: ${shop.shopId} | Count: ${shop._count.id}`);

        // Detailed check for the largest shop
        const titles = await prisma.product.findMany({
            where: { shopId: shop.shopId },
            select: { title: true }
        });
        const uniqueTitles = new Set(titles.map(t => t.title));
        console.log(`   - Unique Titles in this shop: ${uniqueTitles.size}`);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
