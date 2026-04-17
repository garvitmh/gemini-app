import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DB STATE DUMP ---');

    const jobs = await prisma.job.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log('\nRECENT JOBS:');
    console.table(jobs.map(j => ({
        type: j.jobType,
        status: j.status,
        items: `${j.processedItems || 0}/${j.totalItems || 0}`,
        error: j.error ? (j.error.length > 50 ? j.error.substring(0, 50) + '...' : j.error) : 'None'
    })));

    const priceHistory = await prisma.priceHistory.findMany({
        orderBy: { pushedAt: 'desc' },
        take: 10,
        include: { product: true }
    });
    console.log('\nRECENT PRICE HISTORY:');
    console.table(priceHistory.map(h => ({
        sku: h.product?.sku,
        status: h.status,
        old: h.oldPrice,
        new: h.newPrice,
        error: h.errorMessage ? (h.errorMessage.length > 50 ? h.errorMessage.substring(0, 50) + '...' : h.errorMessage) : 'None'
    })));

    const products = await prisma.product.count();
    console.log(`\nTotal Products in DB: ${products}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
