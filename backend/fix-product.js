require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixProduct() {
    try {
        const shop = await prisma.shop.findFirst();

        // Get the first product
        const product = await prisma.product.findFirst({
            where: { shopId: shop.id }
        });

        if (!product) {
            console.log('No products found');
            return;
        }

        console.log(`\nFound: ${product.title}`);
        console.log(`Current data: weight=${product.weightGrams}, metal=${product.metal}, karat=${product.karat}`);

        // Update with test data
        const updated = await prisma.product.update({
            where: { id: product.id },
            data: {
                weightGrams: 10,
                metal: 'gold',
                karat: 22,
                makingChargeType: 'per_gram',
                makingChargeValue: 1500
            }
        });

        console.log(`\n✅ Updated product with:`);
        console.log(`   Weight: 10g`);
        console.log(`   Metal: Gold 22K`);
        console.log(`   Making Charge: ₹1500/g`);
        console.log(`\n📝 Next: Go to http://localhost:5173/products and click Save on "${product.title}"`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

fixProduct();
