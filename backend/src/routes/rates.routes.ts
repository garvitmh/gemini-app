import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PricingService } from '../services/pricing.service';

const router = Router();
const prisma = new PrismaClient();

// Get current rates for all metals and stones
router.get('/', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const [metalRates, stoneRates] = await Promise.all([
            prisma.metalRate.findMany({
                where: { shopId: shop.id },
                orderBy: { updatedAt: 'desc' },
                distinct: ['metal', 'karat'],
            }),
            prisma.stoneRate.findMany({
                where: { shopId: shop.id },
                orderBy: { updatedAt: 'desc' },
            }),
        ]);

        // Calculate 24h change for each metal
        const metalRatesWithChange = await Promise.all(
            metalRates.map(async (rate) => {
                const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const previousRate = await prisma.metalRate.findFirst({
                    where: {
                        shopId: shop.id,
                        metal: rate.metal,
                        karat: rate.karat,
                        updatedAt: { lte: yesterday },
                    },
                    orderBy: { updatedAt: 'desc' },
                });

                const change24h = previousRate
                    ? ((rate.ratePerGram - previousRate.ratePerGram) / previousRate.ratePerGram) * 100
                    : 0;

                return {
                    ...rate,
                    ratePer10g: rate.ratePerGram * 10,
                    change24h: Math.round(change24h * 100) / 100,
                };
            })
        );

        res.json({
            metalRates: metalRatesWithChange,
            stoneRates,
        });
    } catch (error) {
        console.error('Error fetching rates:', error);
        res.status(500).json({ error: 'Failed to fetch rates' });
    }
});

// Update metal rate
router.post('/update', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { metal, karat, purity, ratePerGram, reason, rateSource = 'manual' } = req.body;

        if (!metal || !ratePerGram) {
            return res.status(400).json({ error: 'Metal and rate are required' });
        }

        // Get old rate for audit
        const oldRate = await prisma.metalRate.findFirst({
            where: { shopId: shop.id, metal, karat: karat || null },
            orderBy: { updatedAt: 'desc' },
        });

        // Create new rate
        const newRate = await prisma.metalRate.create({
            data: {
                shopId: shop.id,
                metal,
                karat: karat || null,
                purity: purity || null,
                ratePerGram,
                rateSource,
                reason,
                updatedBy: shopDomain, // In a real app, this would be the user ID
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                shopId: shop.id,
                userId: shopDomain,
                action: 'rate_update',
                entity: 'metal_rate',
                entityId: newRate.id,
                oldValue: oldRate ? JSON.stringify({ ratePerGram: oldRate.ratePerGram }) : null,
                newValue: JSON.stringify({ ratePerGram }),
                reason,
            },
        });

        res.json({ success: true, rate: newRate });
    } catch (error) {
        console.error('Error updating rate:', error);
        res.status(500).json({ error: 'Failed to update rate' });
    }
});

// Update stone rate
router.post('/update-stone', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const {
            stoneType,
            cut,
            color,
            clarity,
            caratRange,
            ratePerCarat,
            ratePerPiece,
            reason,
        } = req.body;

        if (!stoneType || (!ratePerCarat && !ratePerPiece)) {
            return res.status(400).json({ error: 'Stone type and rate are required' });
        }

        const newRate = await prisma.stoneRate.create({
            data: {
                shopId: shop.id,
                stoneType,
                cut,
                color,
                clarity,
                caratRange,
                ratePerCarat,
                ratePerPiece,
                reason,
                updatedBy: shopDomain,
            },
        });

        await prisma.auditLog.create({
            data: {
                shopId: shop.id,
                userId: shopDomain,
                action: 'rate_update',
                entity: 'stone_rate',
                entityId: newRate.id,
                newValue: JSON.stringify({ ratePerCarat, ratePerPiece }),
                reason,
            },
        });

        res.json({ success: true, rate: newRate });
    } catch (error) {
        console.error('Error updating stone rate:', error);
        res.status(500).json({ error: 'Failed to update stone rate' });
    }
});

// Get rate history
router.get('/history', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { metal, karat, limit = 50 } = req.query;

        const where: any = { shopId: shop.id };
        if (metal) where.metal = metal;
        if (karat) where.karat = parseInt(karat as string);

        const history = await prisma.metalRate.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: parseInt(limit as string),
        });

        res.json({ history });
    } catch (error) {
        console.error('Error fetching rate history:', error);
        res.status(500).json({ error: 'Failed to fetch rate history' });
    }
});

export default router;
