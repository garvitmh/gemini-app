const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRates() {
    try {
        const rates = await prisma.stoneRate.findMany({
            where: {
                ratePerPiece: { not: null }
            },
            take: 5
        });

        console.log('\n=== STONE RATES (PER PIECE) ===');
        rates.forEach(rate => {
            console.log(`Stone: ${rate.stoneType}`);
            console.log(`Rate per piece (stored): ${rate.ratePerPiece}`);
            console.log(`Rate per piece (₹): ₹${rate.ratePerPiece / 100}`);
            console.log('---');
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRates();
