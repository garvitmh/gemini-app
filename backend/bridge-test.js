require('dotenv').config();
const { ShopifyService } = require('./dist/services/shopify.service');

async function test() {
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopDomain = process.env.SHOPIFY_STORE;
    const collectionId = 'gid://shopify/Collection/3003075754074'; // Gold Lite

    console.log(`Bridge Test: Token=${accessToken?.substring(0, 10)}... Domain=${shopDomain}`);
    
    try {
        const productIds = await ShopifyService.getCollectionProductIds(accessToken, collectionId, shopDomain);
        console.log(`Bridge Test Result: Found ${productIds.length} products.`);
        if (productIds.length > 0) {
            console.log(`Sample ID: ${productIds[0]}`);
        }
    } catch (e) {
        console.error('Bridge Test Error:', e);
    }
}

test();
