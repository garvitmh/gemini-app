import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get audit logs
router.get('/', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { page = 1, limit = 50, action, startDate, endDate } = req.query;

        const where: any = { shopId: shop.id };
        if (action) where.action = action;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip: (parseInt(page as string) - 1) * parseInt(limit as string),
                take: parseInt(limit as string),
                orderBy: { createdAt: 'desc' },
            }),
            prisma.auditLog.count({ where }),
        ]);

        res.json({
            logs,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Get price push history
router.get('/history', async (req: Request, res: Response) => {
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

        const where: any = { productId: { in: productIds } };
        if (status) where.status = status;
        if (startDate || endDate) {
            where.pushedAt = {};
            if (startDate) where.pushedAt.gte = new Date(startDate as string);
            if (endDate) where.pushedAt.lte = new Date(endDate as string);
        }

        const [history, total] = await Promise.all([
            prisma.priceHistory.findMany({
                where,
                include: { product: { select: { sku: true, title: true } } },
                skip: (parseInt(page as string) - 1) * parseInt(limit as string),
                take: parseInt(limit as string),
                orderBy: { pushedAt: 'desc' },
            }),
            prisma.priceHistory.count({ where }),
        ]);

        res.json({
            history,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        console.error('Error fetching price history:', error);
        res.status(500).json({ error: 'Failed to fetch price history' });
    }
});

// Export audit logs as CSV
router.get('/export', async (req: Request, res: Response) => {
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
    } catch (error) {
        console.error('Error exporting audit logs:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

export default router;
