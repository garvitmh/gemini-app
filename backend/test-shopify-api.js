const axios = require('axios');

async function testShopifyAPI() {
    const domain = 'daginawala11.myshopify.com';
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!accessToken) {
        console.log('❌ SHOPIFY_ACCESS_TOKEN not set in environment');
        return;
    }

    console.log('Testing Shopify GraphQL API...\n');
    console.log(`Domain: ${domain}`);
    console.log(`Token: ${accessToken.substring(0, 10)}...`);
    console.log('');

    // Simple test query
    const query = `
        {
            shop {
                name
                currencyCode
            }
        }
    `;

    try {
        const response = await axios.post(
            `https://${domain}/admin/api/2024-01/graphql.json`,
            { query },
            {
                headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✓ API Connection successful!');
        console.log('Shop:', response.data.data.shop.name);
        console.log('Currency:', response.data.data.shop.currencyCode);
    } catch (error) {
        console.error('❌ API Connection failed:');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testShopifyAPI();
