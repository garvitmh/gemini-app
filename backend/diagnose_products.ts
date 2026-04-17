
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
    console.log('--- DIAGNOSTIC START ---\n');

    try {
        // 1. Database Direct Check
        console.log('1. Database Counts (Direct Prisma Access):');
        const totalVariants = await prisma.product.count({ where: { shopId: { not: undefined } } }); // simplified check
        const distinctProducts = await prisma.product.groupBy({
            by: ['shopifyProductId'],
            _count: { shopifyProductId: true }
        });
        const activeVariants = await prisma.product.count({ where: { status: 'active' } });

        console.log(`- Total Variant Rows: ${totalVariants}`);
        console.log(`- Distinct shopifyProductId Groups: ${distinctProducts.length}`);
        console.log(`- Active Variant Rows: ${activeVariants}`);

        console.log('\n----------------------------------------');

        // 2. API Response Check
        console.log('2. API Response Check (GET /api/products?status=active&limit=50):');
        const res = await axios.get('http://localhost:3000/api/products?status=active&limit=50');

        const { products, pagination } = res.data;

        console.log('- HTTP Status:', res.status);
        console.log('- Pagination Object:', JSON.stringify(pagination, null, 2));
        console.log(`- Products Array Length (Variants returned): ${products.length}`);

        if (products.length > 0) {
            // Group by shopifyProductId to simulate frontend/backend grouping
            const ids = new Set(products.map((p: any) => p.shopifyProductId));
            console.log(`- Unique shopifyProductIds in response: ${ids.size}`);
            console.log('- Sample Product 1:', {
                id: products[0].id,
                shopifyProductId: products[0].shopifyProductId,
                shopifyVariantId: products[0].shopifyVariantId,
                status: products[0].status
            });
        }

        console.log('\n----------------------------------------');

        // 3. Compare
        if (pagination.total === 1 && distinctProducts.length > 1) {
            console.log('❌ MISMATCH DETECTED: DB has multiple products, but API reports Total: 1');
            console.log('Possible Causes:');
            console.log('  - Status filter mismatch (Are actually all other products not active?)');
            console.log('  - ShopID mismatch');
            console.log('  - Backend counting logic error');
        } else {
            console.log('✅ Counts seem aligned between DB and API response');
        }

    } catch (error: any) {
        console.error('Diagnostic Error:', error.message);
        if (error.response) console.error('Response:', error.response.data);
    } finally {
        await prisma.$disconnect();
    }
}

diagnose();
