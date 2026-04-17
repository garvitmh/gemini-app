"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkPriceUpdateService = void 0;
const client_1 = require("@prisma/client");
const pricing_service_1 = require("./pricing.service");
const shopify_service_1 = require("./shopify.service");
const prisma = new client_1.PrismaClient();
class BulkPriceUpdateService {
    /**
     * Trigger bulk price update for products matching criteria
     * Returns immediately with job ID, processes asynchronously
     */
    static async triggerUpdate(options) {
        const { shopId, metal, karat, triggeredBy = 'manual' } = options;
        // Create job record
        const job = await prisma.job.create({
            data: {
                shopId,
                jobType: 'bulk_price_update',
                status: 'pending',
                result: JSON.stringify({ metal, karat, triggeredBy }),
            },
        });
        // Process asynchronously (fire and forget)
        setImmediate(() => {
            this.processUpdate(job.id, options).catch((error) => {
                console.error(`Bulk update job ${job.id} failed:`, error);
            });
        });
        return job.id;
    }
    /**
     * Process the bulk update (runs asynchronously)
     */
    static async processUpdate(jobId, options) {
        const { shopId, metal, karat } = options;
        try {
            // Update job status to processing
            await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: 'processing',
                    startedAt: new Date(),
                },
            });
            // Get shop details
            const shop = await prisma.shop.findUnique({
                where: { id: shopId },
            });
            if (!shop) {
                throw new Error('Shop not found');
            }
            // Build product filter
            const where = { shopId };
            if (metal)
                where.metal = metal;
            if (karat !== undefined)
                where.karat = karat;
            // Get all affected products
            const products = await prisma.product.findMany({
                where,
                select: {
                    id: true,
                    shopifyVariantId: true,
                    currentPrice: true,
                    metal: true,
                    karat: true,
                },
            });
            // Update total items
            await prisma.job.update({
                where: { id: jobId },
                data: { totalItems: products.length },
            });
            console.log(`Processing ${products.length} products for job ${jobId}`);
            let processedCount = 0;
            let failedCount = 0;
            const failedProducts = [];
            // Process in batches
            for (let i = 0; i < products.length; i += this.BATCH_SIZE) {
                const batch = products.slice(i, i + this.BATCH_SIZE);
                const productIds = batch.map((p) => p.id);
                try {
                    // Calculate new prices
                    const prices = await pricing_service_1.PricingService.calculateBulkPrices(shopId, productIds);

                    // Prepare Shopify updates
                    const shopifyUpdates = batch.map((product) => {
                        const priceData = prices.find((p) => p.productId === product.id);
                        return {
                            variantId: product.shopifyVariantId,
                            price: priceData?.newPrice || product.currentPrice || 0,
                            breakdown: priceData?.breakdown
                        };
                    });

                    // Push to Shopify with breakdown
                    const shopifyService = await shopify_service_1.ShopifyService.forShop(shop.domain);
                    await shopifyService.updateVariantPricesBatch(shopifyUpdates);

                    // Update local database
                    for (const product of batch) {
                        const priceData = prices.find((p) => p.productId === product.id);
                        if (priceData) {
                            try {
                                // Update local database and create history in a transaction
                                await prisma.$transaction(async (tx) => {
                                    await tx.product.update({
                                        where: { id: product.id },
                                        data: {
                                            lastCalculatedPrice: priceData.newPrice,
                                            lastPushedPrice: priceData.newPrice,
                                            lastPushedAt: new Date(),
                                            currentPrice: priceData.newPrice,
                                            priceBreakdownHtml: JSON.stringify(priceData.breakdown)
                                        },
                                    });
                                    await tx.priceHistory.create({
                                        data: {
                                            productId: product.id,
                                            oldPrice: priceData.oldPrice,
                                            newPrice: priceData.newPrice,
                                            status: 'success',
                                            triggeredBy: 'bulk_update',
                                        },
                                    });
                                });
                                processedCount++;
                            }
                            catch (error) {
                                console.error(`Failed to update product ${product.id}:`, error);
                                failedCount++;
                                failedProducts.push(product.id);
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Batch starting at ${i} failed:`, error);
                    failedCount += batch.length;
                    failedProducts.push(...batch.map((p) => p.id));
                }
                // Update progress
                await prisma.job.update({
                    where: { id: jobId },
                    data: {
                        processedItems: processedCount,
                        failedItems: failedCount,
                    },
                });
                // Rate limiting: Wait between batches
                await new Promise((resolve) => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS));
            }
            // Mark job as completed
            await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                    result: JSON.stringify({
                        processed: processedCount,
                        failed: failedCount,
                        failedProducts: failedProducts.slice(0, 100), // Limit to first 100
                    }),
                },
            });
            console.log(`Job ${jobId} completed: ${processedCount} processed, ${failedCount} failed`);
        }
        catch (error) {
            // Mark job as failed
            await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: 'failed',
                    error: error.message,
                    completedAt: new Date(),
                },
            });
            console.error(`Job ${jobId} failed:`, error);
            throw error;
        }
    }
    /**
     * Get job status
     */
    static async getJobStatus(jobId) {
        return prisma.job.findUnique({
            where: { id: jobId },
        });
    }
    /**
     * Get active jobs for a shop
     */
    static async getActiveJobs(shopId) {
        return prisma.job.findMany({
            where: {
                shopId,
                status: { in: ['pending', 'processing'] },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    /**
     * Get recent jobs for a shop
     */
    static async getRecentJobs(shopId, limit = 10) {
        return prisma.job.findMany({
            where: { shopId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}
exports.BulkPriceUpdateService = BulkPriceUpdateService;
BulkPriceUpdateService.BATCH_SIZE = 50;
BulkPriceUpdateService.RATE_LIMIT_DELAY_MS = 500; // 2 requests per second
//# sourceMappingURL=bulkPriceUpdate.service.js.map