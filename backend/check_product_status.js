const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProduct() {
    const product = await prisma.product.findFirst({
        where: { sku: 'SRJ-LR-3500' }
    });

    if (!product) {
        console.log('Product not found!');
        return;
    }

    console.log('\n=== Product Status ===');
    console.log('SKU:', product.sku);
    console.log('Title:', product.title);
    console.log('Weight:', product.weightGrams, 'g');
    console.log('Metal:', product.metal);
    console.log('Karat:', product.karat);
    console.log('Current Price:', product.currentPrice);
    console.log('Last Calculated Price:', product.lastCalculatedPrice);
    console.log('Last Pushed Price:', product.lastPushedPrice);
    console.log('Last Pushed At:', product.lastPushedAt);
    console.log('Updated At:', product.updatedAt);

    await prisma.$disconnect();
}

checkProduct();
