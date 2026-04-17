const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findProduct() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { sku: { contains: '9023' } },
                { sku: { contains: '2150' } },
                { title: { contains: 'MINA' } }
            ]
        },
        select: {
            sku: true,
            title: true,
            currentPrice: true,
            makingChargeType: true,
            makingChargeValue: true
        },
        take: 20
    });

    console.log('Found', products.length, 'products:\n');
    products.forEach(p => {
        console.log('SKU:', p.sku);
        console.log('Title:', p.title);
        console.log('Price: ₹' + p.currentPrice);
        console.log('Making:', p.makingChargeType, '₹' + p.makingChargeValue);
        console.log('---');
    });

    await prisma.$disconnect();
}

findProduct();
