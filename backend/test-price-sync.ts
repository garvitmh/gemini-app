import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function testPriceSync() {
    console.log('🔍 Starting Price Sync Diagnostic Test\n');

    try {
        // Step 1: Check Environment Variables
        console.log('Step 1: Checking Environment Variables');
        console.log('  SHOPIFY_STORE:', process.env.SHOPIFY_STORE || '❌ NOT SET');
        console.log('  SHOPIFY_ACCESS_TOKEN:', process.env.SHOPIFY_ACCESS_TOKEN ? '✅ SET' : '❌ NOT SET');
        console.log('  DATABASE_URL:', process.env.DATABASE_URL || '❌ NOT SET');
        console.log('');

        // Step 2: Check Database Connection
        console.log('Step 2: Checking Database Connection');
        const shop = await prisma.shop.findFirst({
            include: { settings: true }
        });

        if (!shop) {
            console.log('  ❌ No shop found in database');
            return;
        }

        console.log('  ✅ Shop found:', shop.domain);
        console.log('  Access Token in DB:', shop.accessToken ? '✅ SET' : '❌ NOT SET');
        console.log('');

        // Step 3: Get a Test Product
        console.log('Step 3: Getting Test Product');
        const product = await prisma.product.findFirst({
            where: {
                shopId: shop.id,
                weightGrams: { gt: 0 },
                metal: { not: '' },
                shopifyProductId: { not: '' },
                shopifyVariantId: { not: '' }
            },
            include: { gemstones: true }
        });

        if (!product) {
            console.log('  ❌ No suitable product found for testing');
            return;
        }

        console.log('  ✅ Product found:', product.sku || product.title);
        console.log('  Product ID:', product.id);
        console.log('  Shopify Product ID:', product.shopifyProductId);
        console.log('  Shopify Variant ID:', product.shopifyVariantId);
        console.log('  Current Price:', product.currentPrice);
        console.log('  Weight:', product.weightGrams, 'g');
        console.log('  Metal:', product.metal, product.karat ? `${product.karat}K` : '');
        console.log('');

        // Step 4: Test Shopify API Connection
        console.log('Step 4: Testing Shopify API Connection');
        const shopDomain = shop.domain;
        const accessToken = shop.accessToken || process.env.SHOPIFY_ACCESS_TOKEN || '';

        if (!accessToken) {
            console.log('  ❌ No access token available');
            return;
        }

        if (!product.shopifyVariantId || !product.shopifyProductId) {
            console.log('  ❌ Product missing Shopify IDs');
            return;
        }

        const variantId = product.shopifyVariantId.replace('gid://shopify/ProductVariant/', '');
        const productId = product.shopifyProductId.replace('gid://shopify/Product/', '');

        const variantGetUrl = `https://${shopDomain}/admin/api/2024-01/variants/${variantId}.json`;

        try {
            const response = await axios.get(variantGetUrl, {
                headers: { 'X-Shopify-Access-Token': accessToken }
            });

            console.log('  ✅ Shopify API Connection Successful');
            console.log('  Current Shopify Price:', response.data.variant.price);
            console.log('  Variant Title:', response.data.variant.title);
            console.log('');
        } catch (error: any) {
            console.log('  ❌ Shopify API Connection Failed');
            if (error.response) {
                console.log('  HTTP Status:', error.response.status);
                console.log('  Error:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('  Error:', error.message);
            }
            console.log('');
            return;
        }

        // Step 5: Test Price Update
        console.log('Step 5: Testing Price Update');
        const testPrice = product.currentPrice || 1000;
        const variantPutUrl = `https://${shopDomain}/admin/api/2024-01/variants/${variantId}.json`;

        console.log('  Attempting to update price to:', testPrice);
        console.log('  URL:', variantPutUrl);

        try {
            const updateResponse = await axios.put(
                variantPutUrl,
                {
                    variant: {
                        id: parseInt(variantId),
                        price: testPrice.toFixed(2)
                    }
                },
                {
                    headers: {
                        'X-Shopify-Access-Token': accessToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('  ✅ Price Update Successful');
            console.log('  Updated Price:', updateResponse.data.variant.price);
            console.log('');
        } catch (error: any) {
            console.log('  ❌ Price Update Failed');
            if (error.response) {
                console.log('  HTTP Status:', error.response.status);
                console.log('  Error:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('  Error:', error.message);
            }
            console.log('');
            return;
        }

        // Step 6: Test Metafield Update
        console.log('Step 6: Testing Metafield Update');
        const testBreakdown = {
            metal: product.metal,
            karat: product.karat,
            weight: product.weightGrams,
            total: Math.round(testPrice * 100)
        };

        try {
            const metafieldResponse = await axios.put(
                variantPutUrl,
                {
                    variant: {
                        id: parseInt(variantId),
                        metafields: [
                            {
                                namespace: 'gemini',
                                key: 'price_breakdown',
                                value: JSON.stringify(testBreakdown),
                                type: 'json'
                            }
                        ]
                    }
                },
                {
                    headers: {
                        'X-Shopify-Access-Token': accessToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('  ✅ Metafield Update Successful');
            console.log('');
        } catch (error: any) {
            console.log('  ❌ Metafield Update Failed');
            if (error.response) {
                console.log('  HTTP Status:', error.response.status);
                console.log('  Error:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('  Error:', error.message);
            }
            console.log('');
        }

        console.log('✅ Diagnostic Test Complete\n');
        console.log('Summary:');
        console.log('  - Environment variables: OK');
        console.log('  - Database connection: OK');
        console.log('  - Shopify API connection: OK');
        console.log('  - Price update: Check above for status');
        console.log('  - Metafield update: Check above for status');

    } catch (error: any) {
        console.error('❌ Diagnostic test failed:', error.message);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

testPriceSync();
