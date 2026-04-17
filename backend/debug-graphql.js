require('dotenv').config();
const axios = require('axios');

async function test() {
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const shop = process.env.SHOPIFY_STORE;
    
    console.log(`Listing Collections for Shop: ${shop}`);

    const query = `
        {
            collections(first: 25) {
                edges {
                    node {
                        id
                        title
                    }
                }
            }
        }
    `;

    try {
        const response = await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, 
            { query }, 
            { 
                headers: { 
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json'
                } 
            }
        );

        console.log('--- Response Data ---');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
