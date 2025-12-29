const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkYellowSapphireProduct() {
    try {
        const product = await prisma.product.findFirst({
            where: {
                title: { contains: 'Yellow Sapphire' }
            },
            include: {
                gemstones: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (!product) {
            console.log('Product not found');
            return;
        }

        console.log('\n=== PRODUCT ===');
        console.log(`Title: ${product.title}`);
        console.log(`Updated: ${product.updatedAt}`);
        console.log(`Gemstones count: ${product.gemstones.length}`);

        if (product.gemstones.length > 0) {
            console.log('\n=== GEMSTONES ===');
            for (const gem of product.gemstones) {
                console.log(`\nType: ${gem.gemstoneType}`);
                console.log(`Cut: ${gem.gemstoneCut}`);
                console.log(`Pieces: ${gem.gemstonePieces}`);
                console.log(`Weight: ${gem.gemstoneWeight}`);

                // Find rate
                const rate = await prisma.stoneRate.findFirst({
                    where: {
                        stoneType: gem.gemstoneType,
                        cut: gem.gemstoneCut || null,
                    },
                    orderBy: { updatedAt: 'desc' }
                });

                if (rate) {
                    console.log(`\n--- RATE ---`);
                    console.log(`Rate per piece: ${rate.ratePerPiece}`);
                    console.log(`Rate per carat: ${rate.ratePerCarat}`);

                    if (rate.ratePerPiece && gem.gemstonePieces) {
                        const gemCost = rate.ratePerPiece * gem.gemstonePieces;
                        const breakdownValue = Math.round(gemCost * 100);
                        console.log(`\n--- CALCULATION ---`);
                        console.log(`${rate.ratePerPiece} × ${gem.gemstonePieces} = ${gemCost}`);
                        console.log(`Breakdown (paise): ${breakdownValue}`);
                        console.log(`Should display: ₹${gemCost}`);
                        console.log(`Breakdown / 100: ₹${breakdownValue / 100}`);
                    }
                }
            }
        } else {
            console.log('\nNo gemstones found - product may not be saved yet');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkYellowSapphireProduct();
