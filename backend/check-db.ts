import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
    try {
        const shop = await prisma.shop.findFirst();
        console.log('Shop:', shop ? `${shop.domain} (ID: ${shop.id})` : 'NOT FOUND');

        const metalRates = await prisma.metalRate.findMany({
            orderBy: { updatedAt: 'desc' }
        });
        console.log('\nMetal Rates:', metalRates.length);
        metalRates.forEach(r => {
            console.log(`  - ${r.metal} ${r.karat ? r.karat + 'K' : ''}: ₹${r.ratePerGram}/g (Updated: ${r.updatedAt})`);
        });

        const products = await prisma.product.findMany({
            take: 5
        });
        console.log('\nProducts:', await prisma.product.count());
        if (products.length > 0) {
            console.log('Sample products:');
            products.forEach(p => console.log(`  - ${p.sku}: ${p.title}`));
        }

        const settings = await prisma.shopSettings.findFirst();
        console.log('\nSettings:', settings ? 'EXISTS' : 'NOT FOUND');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
