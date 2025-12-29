const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCalculation() {
    try {
        // Find a rate with ratePerPiece
        const rate = await prisma.stoneRate.findFirst({
            where: {
                ratePerPiece: { not: null }
            }
        });

        if (!rate) {
            console.log('No per-piece rates found');
            return;
        }

        console.log('\n=== RATE INFO ===');
        console.log(`Stone: ${rate.stoneType}`);
        console.log(`Rate per piece (stored): ${rate.ratePerPiece}`);
        console.log(`Rate per piece (displayed): ₹${rate.ratePerPiece}`);

        // Simulate calculation
        const pieces = 3;
        const gemCost = rate.ratePerPiece * pieces;
        const finalCost = gemCost; // No discount
        const breakdownValue = Math.round(finalCost * 100);

        console.log('\n=== CALCULATION ===');
        console.log(`Pieces: ${pieces}`);
        console.log(`Calculation: ${rate.ratePerPiece} × ${pieces} = ${gemCost}`);
        console.log(`Final cost: ₹${finalCost}`);
        console.log(`Breakdown (paise): ${breakdownValue}`);
        console.log(`Breakdown (displayed): ₹${breakdownValue / 100}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testCalculation();
