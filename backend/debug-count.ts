import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shops = await prisma.shop.findMany();
    console.log('Found shops:', shops.length);

    for (const s of shops) {
        const count = await prisma.product.count({ where: { shopId: s.id } });
        console.log(`Shop: ${s.domain} (ID: ${s.id}) - Products: ${count}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
