
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStatus() {
    try {
        console.log('Checking Product Status Distribution...');

        const distribution = await prisma.product.groupBy({
            by: ['status'],
            _count: {
                shopifyProductId: true // count variants
            }
        });

        console.log('Status Distribution (Variant Level):');
        console.table(distribution);

        // Also check distinct products per status
        console.log('\nDistinct Products per Status:');
        for (const group of distribution) {
            const status = group.status;
            const distinct = await prisma.product.groupBy({
                by: ['shopifyProductId'],
                where: { status: status },
                _count: { shopifyProductId: true }
            });
            console.log(`- ${status}: ${distinct.length} products`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkStatus();
