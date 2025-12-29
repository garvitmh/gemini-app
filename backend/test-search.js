const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProducts() {
    try {
        const products = await prisma.product.findMany({
            take: 5,
            select: {
                id: true,
                sku: true,
                title: true,
            }
        });

        console.log('\n=== PRODUCTS IN DATABASE ===');
        products.forEach(p => {
            console.log(`SKU: ${p.sku || 'null'}`);
            console.log(`Title: ${p.title}`);
            console.log(`Title (lowercase): ${p.title.toLowerCase()}`);
            console.log('---');
        });

        // Test search
        console.log('\n=== TESTING SEARCH ===');

        // Test 1: Exact match
        const exact = await prisma.product.findMany({
            where: {
                title: { contains: 'Yellow Sapphire' }
            }
        });
        console.log(`Exact "Yellow Sapphire": ${exact.length} results`);

        // Test 2: Lowercase
        const lower = await prisma.product.findMany({
            where: {
                title: { contains: 'yellow' }
            }
        });
        console.log(`Lowercase "yellow": ${lower.length} results`);

        // Test 3: Uppercase
        const upper = await prisma.product.findMany({
            where: {
                title: { contains: 'YELLOW' }
            }
        });
        console.log(`Uppercase "YELLOW": ${upper.length} results`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkProducts();
