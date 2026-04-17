"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Get audit logs
router.get('/', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { page = 1, limit = 50, action, startDate, endDate } = req.query;
        const where = { shopId: shop.id };
        if (action)
            where.action = action;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
            }),
            prisma.auditLog.count({ where }),
        ]);
        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});
// Get price push history
router.get('/history', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { page = 1, limit = 50, status, startDate, endDate } = req.query;
        // Get products for this shop
        const products = await prisma.product.findMany({
            where: { shopId: shop.id },
            select: { id: true },
        });
        const productIds = products.map((p) => p.id);
        const where = { productId: { in: productIds } };
        if (status)
            where.status = status;
        if (startDate || endDate) {
            where.pushedAt = {};
            if (startDate)
                where.pushedAt.gte = new Date(startDate);
            if (endDate)
                where.pushedAt.lte = new Date(endDate);
        }
        const [history, total] = await Promise.all([
            prisma.priceHistory.findMany({
                where,
                include: { product: { select: { sku: true, title: true } } },
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit),
                orderBy: { pushedAt: 'desc' },
            }),
            prisma.priceHistory.count({ where }),
        ]);
        res.json({
            history,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error('Error fetching price history:', error);
        res.status(500).json({ error: 'Failed to fetch price history' });
    }
});
// Export audit logs as CSV
router.get('/export', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const logs = await prisma.auditLog.findMany({
            where: { shopId: shop.id },
            orderBy: { createdAt: 'desc' },
            take: 10000, // Limit to last 10k logs
        });
        // Convert to CSV
        const headers = ['Timestamp', 'User', 'Action', 'Entity', 'Old Value', 'New Value', 'Reason'];
        const rows = logs.map((log) => [
            log.createdAt.toISOString(),
            log.userId || '',
            log.action,
            log.entity,
            log.oldValue || '',
            log.newValue || '',
            log.reason || '',
        ]);
        const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
        res.send(csv);
    }
    catch (error) {
        console.error('Error exporting audit logs:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});
exports.default = router;
//# sourceMappingURL=audit.routes.js.map