const { ShopifyService } = require('./dist/services/shopify.service');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testPush() {
    try {
        const product = await prisma.product.findFirst({
            where: { shopifyVariantId: { not: "" } },
            include: { shop: true, gemstones: true }
        });

        if (!product) {
            console.log("No product found with shopifyVariantId");
            return;
        }

        console.log(`Testing push for product: ${product.title} (Variant: ${product.shopifyVariantId})`);
        console.log(`Shop: ${product.shop.domain}`);

        const { PricingService } = require('./dist/services/pricing.service');
        const priceResult = await PricingService.calculateBulkPrices(product.shopId, [product.id]);
        
        if (!priceResult || priceResult.length === 0) {
            console.log("Failed to calculate price");
            return;
        }

        const { newPrice, breakdown } = priceResult[0];
        console.log(`Calculated Price: ₹${newPrice}`);

        const shopifyService = new ShopifyService(product.shop.domain, product.shop.accessToken);
        const result = await shopifyService.updateVariantWithBreakdown(product.shopifyVariantId, newPrice, breakdown);

        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testPush();
