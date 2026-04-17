const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllRates() {
    const rates = await prisma.metalRate.findMany({
        orderBy: { updatedAt: 'desc' }
    });

    console.log('\n💰 ALL METAL RATES:');
    rates.forEach((r, i) => {
        console.log(`${i + 1}. ${r.metal} ${r.karat}K: ₹${r.ratePerGram}/g (Updated: ${r.updatedAt.toISOString().split('T')[0]})`);
    });

    console.log('\n🔍 DUPLICATE CHECK:');
    const duplicates = {};
    rates.forEach(r => {
        const key = `${r.shopId}-${r.metal}-${r.karat}`;
        if (!duplicates[key]) {
            duplicates[key] = [];
        }
        duplicates[key].push(r);
    });

    Object.keys(duplicates).forEach(key => {
        if (duplicates[key].length > 1) {
            console.log(`\n⚠️  DUPLICATE: ${key.split('-')[1]} ${key.split('-')[2]}K`);
            duplicates[key].forEach((r, i) => {
                console.log(`   ${i + 1}. ₹${r.ratePerGram}/g (ID: ${r.id}, Updated: ${r.updatedAt.toISOString()})`);
            });
        }
    });

    await prisma.$disconnect();
}

checkAllRates();
