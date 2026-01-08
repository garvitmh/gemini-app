
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const sku = 'm-1500-6';
    const product = await prisma.product.findFirst({
        where: { sku: { contains: '1500-6' } },
        include: { gemstones: true, makingGroup: true }
    });

    if (!product) {
        console.log('Product not found');
        return;
    }

    console.log('Product Found:', product.id);
    console.log('Gemstones:', JSON.stringify(product.gemstones, null, 2));
    console.log('Discount:', product.discount);
    console.log('DiscountType:', product.discountType);
    console.log('Current Price:', product.currentPrice);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
