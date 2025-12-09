import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get shop settings
router.get('/', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({
            where: { domain: shopDomain },
            include: { settings: true },
        });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        res.json({ shop, settings: shop.settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update shop settings
router.put('/', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const updates = req.body;

        const settings = await prisma.shopSettings.upsert({
            where: { shopId: shop.id },
            create: { shopId: shop.id, ...updates },
            update: updates,
        });

        // Update shop-level settings
        if (updates.timezone || updates.currency) {
            await prisma.shop.update({
                where: { id: shop.id },
                data: {
                    timezone: updates.timezone,
                    currency: updates.currency,
                },
            });
        }

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

export default router;
