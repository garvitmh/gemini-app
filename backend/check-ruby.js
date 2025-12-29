const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRubyRate() {
    try {
        const rates = await prisma.stoneRate.findMany({
            where: {
                stoneType: 'ruby'
            },
            orderBy: { updatedAt: 'desc' }
        });

        console.log(`\n=== FOUND ${rates.length} RUBY RATES ===\n`);

        rates.forEach((rate, i) => {
            console.log(`${i + 1}. Ruby Rate:`);
            console.log(`   Cut: ${rate.cut || 'any'}`);
            console.log(`   Color: ${rate.color || 'any'}`);
            console.log(`   Clarity: ${rate.clarity || 'any'}`);
            console.log(`   Quality: ${rate.quality || 'any'}`);
            console.log(`   Rate per carat: ${rate.ratePerCarat}`);
            console.log(`   Rate per piece: ${rate.ratePerPiece}`);
            console.log(`   Updated: ${rate.updatedAt}`);
            console.log('');
        });

        // Check the product
        const product = await prisma.product.findFirst({
            where: {
                title: { contains: 'Yellow Sapphire' }
            },
            include: {
                gemstones: true
            }
        });

        if (product && product.gemstones.length > 0) {
            console.log('\n=== PRODUCT GEMSTONES ===\n');
            product.gemstones.forEach((gem, i) => {
                console.log(`${i + 1}. ${gem.gemstoneType}:`);
                console.log(`   Pieces: ${gem.gemstonePieces}`);
                console.log(`   Weight: ${gem.gemstoneWeight}`);
                console.log(`   Cut: ${gem.gemstoneCut}`);
                console.log(`   Clarity: ${gem.gemstoneClarity}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRubyRate();
