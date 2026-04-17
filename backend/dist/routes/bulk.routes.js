"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const bulkPriceUpdate_service_1 = require("../services/bulkPriceUpdate.service");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Trigger bulk price update for products
router.post('/trigger-price-update', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { metal, karat } = req.body;
        // Trigger async update
        const jobId = await bulkPriceUpdate_service_1.BulkPriceUpdateService.triggerUpdate({
            shopId: shop.id,
            metal,
            karat,
            triggeredBy: 'manual',
        });
        res.json({
            success: true,
            jobId,
            message: 'Price update started. Check job status for progress.',
        });
    }
    catch (error) {
        console.error('Error triggering bulk update:', error);
        res.status(500).json({ error: 'Failed to trigger bulk update' });
    }
});
// Get job status
router.get('/job-status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await bulkPriceUpdate_service_1.BulkPriceUpdateService.getJobStatus(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json(job);
    }
    catch (error) {
        console.error('Error fetching job status:', error);
        res.status(500).json({ error: 'Failed to fetch job status' });
    }
});
// Get active jobs for shop
router.get('/active-jobs', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const jobs = await bulkPriceUpdate_service_1.BulkPriceUpdateService.getActiveJobs(shop.id);
        res.json({ jobs });
    }
    catch (error) {
        console.error('Error fetching active jobs:', error);
        res.status(500).json({ error: 'Failed to fetch active jobs' });
    }
});
// Get recent jobs for shop
router.get('/recent-jobs', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const limit = parseInt(req.query.limit) || 10;
        const jobs = await bulkPriceUpdate_service_1.BulkPriceUpdateService.getRecentJobs(shop.id, limit);
        res.json({ jobs });
    }
    catch (error) {
        console.error('Error fetching recent jobs:', error);
        res.status(500).json({ error: 'Failed to fetch recent jobs' });
    }
});
exports.default = router;
//# sourceMappingURL=bulk.routes.js.map