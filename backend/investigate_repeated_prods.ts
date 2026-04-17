
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRepeatedTitles() {
    console.log('--- INVESTIGATION START ---\n');

    try {
        const title = "STUDDED RING 18K";
        console.log(`Searching for products with title: "${title}"...`);

        const products = await prisma.product.findMany({
            where: {
                title: { contains: title }
            },
            select: {
                id: true,
                shopifyProductId: true,
                shopifyVariantId: true,
                title: true,
                sku: true,
                status: true
            }
        });

        console.log(`Found ${products.length} records.`);

        if (products.length === 0) {
            console.log('No products found. Checking logic...');
            return;
        }


        const fs = require('fs');
        let output = '';

        products.forEach(p => {
            output += `ID: ${p.id} | ShopifyID: ${p.shopifyProductId} | VariantID: ${p.shopifyVariantId} | SKU: ${p.sku}\n`;
        });

        // Analyze IDs
        const uniqueProductIds = new Set(products.map(p => p.shopifyProductId));
        output += `\nAnalysis:\n`;
        output += `- Total Records: ${products.length}\n`;
        output += `- Unique Shopify Product IDs: ${uniqueProductIds.size}\n`;

        if (uniqueProductIds.size === products.length) {
            output += 'CONCLUSION: These are ALL SEPARATE products in Shopify.\n';
            output += 'They share the same title, but Shopify treats them as distinct entities (different IDs).\n';
        } else if (uniqueProductIds.size === 1) {
            output += 'CONCLUSION: These share the SAME Shopify Product ID.\n';
            output += 'The issue is definitely in the backend grouping logic.\n';
        } else {
            output += 'CONCLUSION: Mixed bag. Some share IDs, some do not.\n';
        }

        fs.writeFileSync('investigation_result.txt', output);
        console.log('Results written to investigation_result.txt');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRepeatedTitles();
