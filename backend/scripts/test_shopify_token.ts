import 'dotenv/config';
import { GraphQLClient } from 'graphql-request';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'daginawala11.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

async function testToken() {
    console.log(`Testing token for: ${SHOPIFY_STORE}`);

    const client = new GraphQLClient(
        `https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`,
        {
            headers: {
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                'Content-Type': 'application/json',
            },
        }
    );

    const query = `{
        shop {
            name
            email
            myshopifyDomain
        }
    }`;

    try {
        const result = await client.request(query);
        console.log('✅ Token is VALID!');
        console.log('Shop Info:', result);
    } catch (error: any) {
        console.error('❌ Token is INVALID or has insufficient permissions');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response, null, 2));
        }
    }
}

testToken();
