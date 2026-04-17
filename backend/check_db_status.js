const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DB STATE DUMP (JS) ---');
    try {
        const jobs = await prisma.job.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        console.log('\nRECENT JOBS:');
        jobs.forEach(j => {
            console.log(`ID: ${j.id} | Type: ${j.jobType} | Status: ${j.status} | Items: ${j.processedItems}/${j.totalItems} | Created: ${j.createdAt.toISOString()} | Error: ${j.error || 'None'}`);
        });

        const histories = await prisma.priceHistory.findMany({
            orderBy: { pushedAt: 'desc' },
            take: 10
        });
        console.log('\nRECENT PRICE HISTORIES:');
        histories.forEach(h => {
            console.log(`Status: ${h.status} | Old: ${h.oldPrice} | New: ${h.newPrice} | Triggered: ${h.triggeredBy} | Error: ${h.errorMessage || 'None'}`);
        });

        const productsCount = await prisma.product.count();
        console.log(`\nTotal products in DB: ${productsCount}`);

        const shops = await prisma.shop.findMany();
        console.log('\nSHOPS:');
        shops.forEach(s => {
            console.log(`Domain: ${s.domain} | Active: ${s.isActive}`);
        });

    } catch (err) {
        console.error('Error querying DB:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
