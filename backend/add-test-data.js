const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addTestProduct() {
    console.log('\n🔧 Adding test product data...\n');

    try {
        const shop = await prisma.shop.findFirst();

        // Find a product
        const product = await prisma.product.findFirst({
            where: {
                shopId: shop.id,
                shopifyVariantId: '42375841972314'
            }
        });

        if (!product) {
            console.log('Product not found');
            process.exit(1);
        }

        console.log(`Updating product: ${product.title}`);

        // Update with complete data
        await prisma.product.update({
            where: { id: product.id },
            data: {
                weightGrams: 10,
                metal: 'gold',
                karat: '22',
                makingChargeType: 'per_gram',
                makingChargeValue: 1500
            }
        });

        console.log('✅ Product updated with:');
        console.log('   Weight: 10g');
        console.log('   Metal: Gold 22K');
        console.log('   Making Charge: ₹1500/g');
        console.log('\nNow trigger a price update from the admin panel!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

addTestProduct();
