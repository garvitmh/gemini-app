const axios = require('axios');
async function main() {
    console.log("Fetching all collections...");
    const query = `
    query {
        collections(first: 10) {
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
        const response = await axios.post(
            'https://daginawala11.myshopify.com/admin/api/2024-01/graphql.json',
            { query },
            {
                headers: {
                    'X-Shopify-Access-Token': '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',
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log("SUCCESS:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("ERROR:");
        console.error(e.response ? e.response.data : e.message);
    }
}
main();
