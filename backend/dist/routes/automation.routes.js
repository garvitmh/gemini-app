"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Get automation rules
router.get('/rules', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const rules = await prisma.automationRule.findMany({
            where: { shopId: shop.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ rules });
    }
    catch (error) {
        console.error('Error fetching automation rules:', error);
        res.status(500).json({ error: 'Failed to fetch automation rules' });
    }
});
// Create or update automation rule
router.post('/rules', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { id, enabled, triggerType, thresholdPercent, schedule, autoRecalculate, autoPush } = req.body;
        let rule;
        if (id) {
            rule = await prisma.automationRule.update({
                where: { id, shopId: shop.id },
                data: { enabled, triggerType, thresholdPercent, schedule, autoRecalculate, autoPush },
            });
        }
        else {
            rule = await prisma.automationRule.create({
                data: {
                    shopId: shop.id,
                    enabled,
                    triggerType,
                    thresholdPercent,
                    schedule,
                    autoRecalculate,
                    autoPush,
                },
            });
        }
        res.json({ success: true, rule });
    }
    catch (error) {
        console.error('Error saving automation rule:', error);
        res.status(500).json({ error: 'Failed to save automation rule' });
    }
});
// Manually trigger automation
router.post('/trigger', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // This would trigger the automation job
        // For now, just return success
        res.json({ success: true, message: 'Automation triggered' });
    }
    catch (error) {
        console.error('Error triggering automation:', error);
        res.status(500).json({ error: 'Failed to trigger automation' });
    }
});
exports.default = router;
//# sourceMappingURL=automation.routes.js.map