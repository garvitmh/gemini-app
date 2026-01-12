import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- PRODUCT SUMMARY ---');
    const totalProducts = await prisma.product.count();
    console.log(`Total Products in DB: ${totalProducts}`);

    const shops = await prisma.shop.findMany();
    for (const shop of shops) {
        const count = await prisma.product.count({ where: { shopId: shop.id } });
        console.log(`Shop: ${shop.domain} (ID: ${shop.id}) - Products: ${count}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
