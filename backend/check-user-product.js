const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserProduct() {
    try {
        // Find Yellow Sapphire product with gemstones
        const product = await prisma.product.findFirst({
            where: {
                title: { contains: 'Yellow Sapphire' }
            },
            include: {
                gemstones: true
            }
        });

        if (!product) {
            console.log('Product not found');
            return;
        }

        console.log('\n=== PRODUCT ===');
        console.log(`Title: ${product.title}`);
        console.log(`Gemstones count: ${product.gemstones.length}`);

        if (product.gemstones.length > 0) {
            console.log('\n=== GEMSTONES ===');
            for (const gem of product.gemstones) {
                console.log(`\nType: ${gem.gemstoneType}`);
                console.log(`Pieces: ${gem.gemstonePieces}`);
                console.log(`Weight: ${gem.gemstoneWeight}`);

                // Find rate
                const rate = await prisma.stoneRate.findFirst({
                    where: {
                        stoneType: gem.gemstoneType,
                        cut: gem.gemstoneCut || null,
                        color: gem.gemstoneColor || null,
                        clarity: gem.gemstoneClarity || null,
                    }
                });

                if (rate) {
                    console.log(`Rate per piece (DB): ${rate.ratePerPiece}`);
                    console.log(`Rate per carat (DB): ${rate.ratePerCarat}`);

                    if (rate.ratePerPiece && gem.gemstonePieces) {
                        const calc = rate.ratePerPiece * gem.gemstonePieces;
                        console.log(`Calculation: ${rate.ratePerPiece} × ${gem.gemstonePieces} = ${calc}`);
                        console.log(`In breakdown (paise): ${Math.round(calc * 100)}`);
                        console.log(`Displayed: ₹${calc}`);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUserProduct();
