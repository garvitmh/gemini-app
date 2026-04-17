"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCronJobs = setupCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const pricing_service_1 = require("../services/pricing.service");
const shopify_service_1 = require("../services/shopify.service");
const prisma = new client_1.PrismaClient();
function setupCronJobs() {
    // Check automation rules every 5 minutes
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        console.log('Checking automation rules...');
        try {
            const rules = await prisma.automationRule.findMany({
                where: {
                    enabled: true,
                    triggerType: 'rate_change',
                },
                include: { shop: true },
            });
            for (const rule of rules) {
                // Check if rate has changed by threshold
                const recentRates = await prisma.metalRate.findMany({
                    where: { shopId: rule.shopId },
                    orderBy: { updatedAt: 'desc' },
                    take: 2,
                });
                if (recentRates.length >= 2) {
                    const [current, previous] = recentRates;
                    const changePercent = Math.abs(((current.ratePerGram - previous.ratePerGram) / previous.ratePerGram) * 100);
                    if (changePercent >= (rule.thresholdPercent || 0)) {
                        console.log(`Rate change threshold met for shop ${rule.shop.domain}`);
                        if (rule.autoRecalculate && rule.autoPush) {
                            // Trigger automatic price update
                            const products = await prisma.product.findMany({
                                where: { shopId: rule.shopId },
                                select: { id: true },
                            });
                            const productIds = products.map((p) => p.id);
                            // Calculate new prices
                            const preview = await pricing_service_1.PricingService.calculateBulkPrices(rule.shopId, productIds);
                            // Push to Shopify
                            const shopifyService = await shopify_service_1.ShopifyService.forShop(rule.shop.domain);
                            const updates = products.map((product, index) => ({
                                variantId: product.id,
                                price: preview[index]?.newPrice || 0,
                            }));
                            await shopifyService.updateVariantPricesBatch(updates);
                            // Update rule last run
                            await prisma.automationRule.update({
                                where: { id: rule.id },
                                data: {
                                    lastRun: new Date(),
                                    lastRunStatus: 'success',
                                },
                            });
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error in automation cron job:', error);
        }
    });
    console.log('✅ Cron jobs scheduled');
}
//# sourceMappingURL=cron.js.map