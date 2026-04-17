const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findProduct() {
    const products = await prisma.product.findMany({
        where: {
            title: { contains: 'RUBY MOSSONITE' }
        },
        select: {
            sku: true,
            title: true,
            currentPrice: true,
            makingChargeType: true,
            makingChargeValue: true
        }
    });

    console.log('Found', products.length, 'products:');
    products.forEach(p => {
        console.log('\nSKU:', p.sku);
        console.log('Title:', p.title);
        console.log('Price:', p.currentPrice);
        console.log('Making:', p.makingChargeType, p.makingChargeValue);
    });

    await prisma.$disconnect();
}

findProduct();
