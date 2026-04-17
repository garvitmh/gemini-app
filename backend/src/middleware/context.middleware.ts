import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Context middleware - attaches the Shop record to all API requests.
 *
 * Multi-tenant logic:
 *  1. Tries to resolve shop from the 'x-shopify-shop-domain' request header.
 *  2. Falls back to SHOPIFY_STORE env var (for single-tenant / desktop mode).
 */
export const contextMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Prefer header set by Shopify session token / App Bridge, then fall back to env var
        const shopDomain =
            (req.headers['x-shopify-shop-domain'] as string) ||
            process.env.SHOPIFY_STORE ||
            null;

        let shop = null;

        if (shopDomain) {
            shop = await prisma.shop.findFirst({
                where: { domain: shopDomain, isActive: true },
                include: { settings: true },
            });
        } else {
            // Desktop / dev fallback: grab first active shop
            shop = await prisma.shop.findFirst({
                where: { isActive: true },
                include: { settings: true },
            });
        }

        if (!shop) {
            // Don't block—some public routes don't need a shop
            req.context = { shop: null };
        } else {
            req.context = { shop };
        }

        next();
    } catch (error) {
        console.error('Context Middleware Error:', error);
        res.status(500).json({ error: 'Failed to initialize request context' });
    }
};
