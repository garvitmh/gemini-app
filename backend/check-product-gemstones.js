const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProduct() {
    try {
        // Find the Yellow Sapphire product
        const product = await prisma.product.findFirst({
            where: {
                title: {
                    contains: 'Yellow Sapphire'
                }
            },
            include: {
                gemstones: true
            }
        });

        if (!product) {
            console.log('Product not found');
            return;
        }

        console.log('\n=== PRODUCT DATA ===');
        console.log('Title:', product.title);
        console.log('SKU:', product.sku);
        console.log('\n=== LEGACY GEMSTONE FIELDS ===');
        console.log('gemstoneType:', product.gemstoneType);
        console.log('gemstoneCut:', product.gemstoneCut);
        console.log('gemstoneColor:', product.gemstoneColor);
        console.log('gemstoneClarity:', product.gemstoneClarity);
        console.log('stoneWeightCarat:', product.stoneWeightCarat);
        console.log('stonePieces:', product.stonePieces);
        console.log('isManualGemstonePrice:', product.isManualGemstonePrice);
        console.log('manualGemstonePrice:', product.manualGemstonePrice);

        console.log('\n=== NEW GEMSTONES ARRAY ===');
        console.log('Number of gemstones:', product.gemstones.length);
        if (product.gemstones.length > 0) {
            product.gemstones.forEach((gem, i) => {
                console.log(`\nGemstone ${i + 1}:`);
                console.log('  Type:', gem.gemstoneType);
                console.log('  Cut:', gem.gemstoneCut);
                console.log('  Color:', gem.gemstoneColor);
                console.log('  Clarity:', gem.gemstoneClarity);
                console.log('  Weight:', gem.gemstoneWeight);
                console.log('  Pieces:', gem.gemstonePieces);
            });
        } else {
            console.log('No gemstones in array');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkProduct();
