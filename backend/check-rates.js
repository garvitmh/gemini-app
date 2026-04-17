const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRates() {
    const rates = await prisma.metalRate.findMany({
        where: { metal: 'gold', karat: 18 }
    });

    console.log('\n💰 18K GOLD RATES:');
    rates.forEach(r => {
        console.log(`   Shop: ${r.shopId}`);
        console.log(`   Rate: ₹${r.ratePerGram}/g`);
        console.log(`   Updated: ${r.updatedAt}`);
        console.log('---');
    });

    await prisma.$disconnect();
}

checkRates();
