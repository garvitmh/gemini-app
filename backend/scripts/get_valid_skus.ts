
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // 1. Get valid products WITH SKUs
    const products = await prisma.product.findMany({
        take: 3,
        where: { sku: { not: null } },
        select: { sku: true, title: true, weightGrams: true, metal: true, karat: true }
    });

    console.log('VALID_PRODUCTS_JSON_START');
    console.log(JSON.stringify(products, null, 2));
    console.log('VALID_PRODUCTS_JSON_END');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
