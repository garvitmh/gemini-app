
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shop = await prisma.shop.findFirst();
    if (!shop) {
        console.log('No shop found');
        return;
    }

    console.log(`Checking jobs for shop: ${shop.domain} (${shop.id})`);

    // List ANY job
    const allJobs = await prisma.job.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });
    console.log('All recent jobs in DB:', allJobs.map(j => ({ id: j.id, type: j.jobType, status: j.status, shopId: j.shopId })));

    const job = await prisma.job.findFirst({
        where: { shopId: shop.id, jobType: 'product_sync' },
        orderBy: { createdAt: 'desc' },
    });

    if (job) {
        console.log('Latest Sync Job:');
        console.log(`ID: ${job.id}`);
        console.log(`Status: ${job.status}`);
        console.log(`Started: ${job.startedAt}`);
        console.log(`Completed: ${job.completedAt}`);
        console.log(`Error: ${job.error}`);
        console.log(`Result: ${job.result}`);

        // Check if it looks stuck (processing for > 2 mins)
        if (job.status === 'processing' && job.startedAt) {
            const started = job.startedAt instanceof Date ? job.startedAt : new Date(job.startedAt);
            const diff = new Date().getTime() - started.getTime();
            console.log(`Running duration: ${diff / 1000} seconds`);
        }
    } else {
        console.log('No sync jobs found.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
