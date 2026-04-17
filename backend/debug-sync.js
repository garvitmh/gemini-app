const { ShopifyService } = require('./dist/services/shopify.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugSync() {
    console.log("--- Shopify Sync Debugging ---");
    try {
        // 1. Find a shop and product to test
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            console.error("❌ No shop found in database.");
            return;
        }
        console.log(`✅ Found shop: ${shop.domain} (ID: ${shop.id})`);

        const product = await prisma.product.findFirst({
            where: { shopId: shop.id }
        });
        if (!product) {
            console.error("❌ No product found for this shop.");
            return;
        }
        console.log(`✅ Found product: ${product.sku} (Variant ID: ${product.shopifyVariantId})`);

        if (!product.shopifyVariantId) {
            console.error("❌ Product missing shopifyVariantId.");
            return;
        }

        // 2. Test forShop initialization
        console.log("Testing ShopifyService.forShop...");
        // Ensure we are using the static method correctly
        const shopifyService = await ShopifyService.forShop(shop.domain);
        console.log("✅ ShopifyService instance created.");
        console.log(`- Service Domain: ${shopifyService.domain}`);

        // 3. Test updateVariantWithBreakdown
        const mockBreakdown = {
            total: 100000,
            metal_value: 50000,
            making_charges: 30000,
            gemstone_price: 20000,
            gst_amount: 3000,
            metal_name: "Gold 22K",
            weight: 10,
            subtotal: 100000,
            gst_pct: 3,
            total_original: 100000,
            has_any_discount: false
        };

        console.log(`Pushing update for variant ${product.shopifyVariantId} to Shopify...`);
        const result = await shopifyService.updateVariantWithBreakdown(
            product.shopifyVariantId,
            1234.56,
            mockBreakdown
        );

        if (result.success) {
            console.log("✅ SUCCESS: Price and breakdown pushed to Shopify.");
        } else {
            console.error(`❌ FAILURE: ${result.error}`);
        }

    } catch (error) {
        console.error("💥 CRITICAL ERROR during debug sync:");
        console.error(error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

debugSync();
