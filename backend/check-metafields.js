const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMetafields() {
    try {
        const product = await prisma.product.findFirst({
            where: {
                title: { contains: 'Yellow Sapphire' }
            }
        });

        if (!product) {
            console.log('Product not found');
            return;
        }

        console.log('\n=== PRODUCT ===');
        console.log(`Title: ${product.title}`);
        console.log(`Shopify Product ID: ${product.shopifyProductId}`);
        console.log(`Shopify Variant ID: ${product.shopifyVariantId}`);
        console.log(`Current Price: ₹${product.currentPrice}`);
        console.log(`Price Breakdown HTML length: ${product.priceBreakdownHtml?.length || 0}`);

        if (product.priceBreakdownHtml) {
            console.log('\n=== PRICE BREAKDOWN HTML (first 500 chars) ===');
            console.log(product.priceBreakdownHtml.substring(0, 500));
        } else {
            console.log('\n❌ NO PRICE BREAKDOWN HTML STORED');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMetafields();
