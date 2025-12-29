const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSpecificProduct() {
    try {
        const product = await prisma.product.findFirst({
            where: {
                title: { contains: 'G VS2 / 3 Ct' }
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
        console.log(`Current Price: ₹${product.currentPrice}`);
        console.log(`Gemstones count: ${product.gemstones.length}`);

        if (product.gemstones.length > 0) {
            console.log('\n=== GEMSTONES ===');
            for (let i = 0; i < product.gemstones.length; i++) {
                const gem = product.gemstones[i];
                console.log(`\n--- Gemstone ${i + 1} ---`);
                console.log(`Type: ${gem.gemstoneType}`);
                console.log(`Cut: ${gem.gemstoneCut}`);
                console.log(`Color: ${gem.gemstoneColor}`);
                console.log(`Clarity: ${gem.gemstoneClarity}`);
                console.log(`Pieces: ${gem.gemstonePieces}`);
                console.log(`Weight: ${gem.gemstoneWeight}`);

                // Find matching rate
                const rate = await prisma.stoneRate.findFirst({
                    where: {
                        stoneType: gem.gemstoneType,
                        cut: gem.gemstoneCut || null,
                        color: gem.gemstoneColor || null,
                        clarity: gem.gemstoneClarity || null,
                    },
                    orderBy: { updatedAt: 'desc' }
                });

                if (rate) {
                    console.log(`\n--- RATE FOUND ---`);
                    console.log(`Rate per piece: ${rate.ratePerPiece}`);
                    console.log(`Rate per carat: ${rate.ratePerCarat}`);

                    if (rate.ratePerPiece && gem.gemstonePieces) {
                        const calc = rate.ratePerPiece * gem.gemstonePieces;
                        console.log(`\n--- CALCULATION ---`);
                        console.log(`${rate.ratePerPiece} × ${gem.gemstonePieces} = ${calc}`);
                        console.log(`In breakdown (paise): ${Math.round(calc * 100)}`);
                        console.log(`Should display: ₹${calc}`);
                    } else if (rate.ratePerCarat && gem.gemstoneWeight) {
                        const calc = rate.ratePerCarat * gem.gemstoneWeight;
                        console.log(`\n--- CALCULATION ---`);
                        console.log(`${rate.ratePerCarat} × ${gem.gemstoneWeight} = ${calc}`);
                        console.log(`In breakdown (paise): ${Math.round(calc * 100)}`);
                        console.log(`Should display: ₹${calc}`);
                    }
                } else {
                    console.log(`NO RATE FOUND for this gemstone`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSpecificProduct();
