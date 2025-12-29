import 'dotenv/config';
import axios from 'axios';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

/**
 * This script tests the Shopify API connection and credentials
 */

async function testConnection() {
    console.log('\n🔍 Testing Shopify API Connection...\n');

    // Check environment variables
    console.log('1. Checking environment variables:');
    if (!SHOPIFY_STORE) {
        console.error('   ❌ SHOPIFY_STORE is not set');
        process.exit(1);
    }
    console.log(`   ✅ SHOPIFY_STORE: ${SHOPIFY_STORE}`);

    if (!SHOPIFY_ACCESS_TOKEN) {
        console.error('   ❌ SHOPIFY_ACCESS_TOKEN is not set');
        process.exit(1);
    }
    console.log(`   ✅ SHOPIFY_ACCESS_TOKEN: ${SHOPIFY_ACCESS_TOKEN.substring(0, 10)}...`);

    // Test API connection
    console.log('\n2. Testing API connection:');
    try {
        const response = await axios.get(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/shop.json`,
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                }
            }
        );

        console.log('   ✅ Successfully connected to Shopify!');
        console.log(`   Shop Name: ${response.data.shop.name}`);
        console.log(`   Shop Domain: ${response.data.shop.domain}`);
        console.log(`   Shop Email: ${response.data.shop.email}`);

    } catch (error: any) {
        console.error('   ❌ Failed to connect to Shopify');
        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Error: ${error.response.data.errors || error.response.data}`);

            if (error.response.status === 401) {
                console.error('\n   💡 This looks like an authentication error.');
                console.error('   Please check that your SHOPIFY_ACCESS_TOKEN is correct.');
            }
        } else {
            console.error(`   Error: ${error.message}`);
        }
        process.exit(1);
    }

    // Test fetching products
    console.log('\n3. Testing product access:');
    try {
        const response = await axios.get(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=1`,
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                }
            }
        );

        const productCount = response.data.products.length;
        console.log(`   ✅ Successfully fetched products (${productCount} product(s) returned)`);

        if (productCount > 0) {
            const product = response.data.products[0];
            console.log(`   Sample Product: ${product.title}`);
            console.log(`   Product ID: ${product.id}`);
            if (product.variants && product.variants.length > 0) {
                console.log(`   Variant ID: ${product.variants[0].id}`);
                console.log(`   Current Price: ${product.variants[0].price}`);
            }
        }

    } catch (error: any) {
        console.error('   ❌ Failed to fetch products');
        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Error: ${error.response.data.errors || error.response.data}`);
        } else {
            console.error(`   Error: ${error.message}`);
        }
        process.exit(1);
    }

    // Test metafield access
    console.log('\n4. Testing metafield access:');
    try {
        const response = await axios.get(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/metafield_definitions.json`,
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                }
            }
        );

        console.log(`   ✅ Successfully accessed metafield definitions`);

        const geminiMetafield = response.data.metafield_definitions?.find(
            (m: any) => m.namespace === 'gemini' && m.key === 'price_breakdown'
        );

        if (geminiMetafield) {
            console.log(`   ✅ Found gemini.price_breakdown metafield definition!`);
            console.log(`      ID: ${geminiMetafield.id}`);
            console.log(`      Type: ${geminiMetafield.type}`);
        } else {
            console.log(`   ⚠️  gemini.price_breakdown metafield definition NOT found`);
            console.log(`   💡 Run 'npx ts-node create-metafield-definition.ts' to create it`);
        }

    } catch (error: any) {
        console.error('   ⚠️  Could not access metafield definitions (may not have permission)');
        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
        }
    }

    console.log('\n✅ All tests completed!\n');
}

testConnection();
