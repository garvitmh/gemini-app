
import { PrismaClient } from '@prisma/client';
import { PricingService } from '../src/services/pricing.service';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Bulk Pricing Verification...');

    try {
        // 1. Get a shop with products
        const shop = await prisma.shop.findFirst({
            where: { products: { some: {} } }
        });

        if (!shop) {
            console.log('No shop with products found.');
            return;
        }

        console.log(`Testing with Shop ID: ${shop.id}`);

        // 2. Get random 50 products (or less if not enough)
        const products = await prisma.product.findMany({
            where: { shopId: shop.id },
            take: 50,
            select: { id: true, title: true }
        });

        if (products.length === 0) {
            console.log('No products found.');
            return;
        }

        console.log(`Fetched ${products.length} products for testing.`);
        const productIds = products.map(p => p.id);

        // 3. Measure Execution Time
        const start = Date.now();
        console.log('Calling PricingService.calculateBulkPrices...');

        const results = await PricingService.calculateBulkPrices(shop.id, productIds);

        const end = Date.now();
        const duration = end - start;

        console.log(`\nCalculation Complete!`);
        console.log(`Time taken: ${duration}ms`);
        console.log(`Average time per product: ${(duration / products.length).toFixed(2)}ms`);

        // 4. Verify Results
        console.log('\nSample Results:');
        results.slice(0, 3).forEach(r => {
            console.log(`[${r.sku || 'NO-SKU'}] ${r.title}: Old=${r.oldPrice}, New=${r.newPrice}`);
        });

        const errors = results.filter(r => (r as any).error);
        if (errors.length > 0) {
            console.error(`\nFound ${errors.length} errors:`);
            console.error(errors[0]);
        } else {
            console.log('\nNo errors reported in results.');
        }

    } catch (error) {
        console.error('Fatal Test Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
