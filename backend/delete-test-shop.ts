import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const deleted = await prisma.shop.deleteMany({
        where: { domain: 'test-shop.myshopify.com' }
    });
    console.log(`Deleted ${deleted.count} shop(s) for test-shop.myshopify.com`);

    // Verify remaining shops
    const shops = await prisma.shop.findMany();
    console.log('Remaining shops:', shops.map(s => s.domain));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
