import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Cleanup ---');

    const shops = await prisma.shop.findMany({
        include: {
            _count: {
                select: { products: true, metalRates: true }
            }
        }
    });

    console.log(`Found ${shops.length} shops.`);

    for (const shop of shops) {
        console.log(`- ${shop.domain} (id: ${shop.id})`);
        console.log(`  Products: ${shop._count.products}, Rates: ${shop._count.metalRates}`);

        // If shop has no products and no rates, and it's not the primary one we expect
        if (shop._count.products === 0 && shop._count.metalRates === 0) {
            console.log(`  🗑️ Deleting empty shop...`);
            await prisma.shop.delete({ where: { id: shop.id } });
            console.log(`  ✅ Deleted.`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
