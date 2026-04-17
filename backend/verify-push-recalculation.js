
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

const SHOP_DOMAIN = 'daginawala11.myshopify.com'; // Adjust if needed
const API_URL = 'http://localhost:3001/api';

async function verifyPushRecalculation() {
    console.log('🚀 Starting Push Recalculation Verification...');

    try {
        // 1. Find a test product with enough data
        // 1. Find a test product with enough data
        // Removing filter to bypass Prisma error
        const products = await prisma.product.findMany({
            take: 50
        });

        // Find one with variant ID and weight
        const product = products.find(p => p.shopifyVariantId && p.weightGrams > 0);



        if (!product) {
            console.error('❌ No valid test product found (need metal + weight + variantID)');
            return;
        }

        console.log(`\n📋 Test Product Selected:`);
        console.log(`   ID: ${product.id}`);
        console.log(`   SKU: ${product.sku}`);
        console.log(`   Current DB Price: ${product.currentPrice}`);

        // 2. Simulate "Stale" Data
        // We set the DB price to an obviously wrong number (e.g., 123.45)
        // If the push endpoint just pushes what's in the DB, the result will be 123.45.
        // If it correctly RECALCULATES, the result will be the real calculated price.
        const STALE_PRICE = 123.45;
        await prisma.product.update({
            where: { id: product.id },
            data: { currentPrice: STALE_PRICE }
        });
        console.log(`\n📉 Set "Stale" Price in DB to: ₹${STALE_PRICE}`);

        // 3. Call the Push Breakdown Endpoint
        console.log(`\n🔄 Calling /push-breakdown endpoint...`);
        // We need to mock the context middleware typically provided by the server app
        // Since we are calling via HTTP, we rely on the server running on port 3000

        try {
            const response = await axios.post(`${API_URL}/products/push-breakdown`, {
                productIds: [product.id]
            });

            const result = response.data;
            console.log('\n✅ API Response Received:', JSON.stringify(result, null, 2));

            const pushedResult = result.results.find(r => r.productId === product.id);

            if (!pushedResult) {
                console.error('❌ Result not found in response');
                return;
            }

            if (pushedResult.price && pushedResult.price !== STALE_PRICE) {
                console.log(`\n✨ VERIFICATION PASS!`);
                console.log(`   Stale Price: ₹${STALE_PRICE}`);
                console.log(`   Recalculated & Pushed Price: ₹${pushedResult.price}`);
                console.log(`   The system successfully recalculated the price before pushing.`);
            } else if (pushedResult.price === STALE_PRICE) {
                console.error(`\n❌ VERIFICATION FAILED!`);
                console.error(`   The system pushed the STALE price (₹${STALE_PRICE}) without recalculating.`);
            } else {
                console.warn(`\n⚠️ cannot verify price (price field missing in result). Result success: ${pushedResult.success}`);
            }

        } catch (apiError) {
            console.error('❌ API Verification Failed:', apiError.message);
            if (apiError.response) {
                console.error('   Server Response:', apiError.response.data);
            }
        }

        // 4. Cleanup (Valid, but optional - leave it fresh)
        // We intentionally don't revert to stale price, we want the fresh price there.

    } catch (e) {
        console.error('❌ Verification Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

verifyPushRecalculation();
