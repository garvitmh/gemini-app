"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextMiddleware = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const contextMiddleware = async (req, res, next) => {
    try {
        // Prefer header sent by Shopify (multi-tenant), then fall back to env var (single-tenant / desktop)
        const shopDomain =
            req.headers['x-shopify-shop-domain'] ||
            process.env.SHOPIFY_STORE ||
            null;
        let shop = null;
        if (shopDomain) {
            shop = await prisma.shop.findFirst({
                where: { domain: shopDomain, isActive: true },
                include: { settings: true },
            });
        }
        if (!shop) {
            // Fallback: grab first active shop (works for single-store / desktop mode)
            shop = await prisma.shop.findFirst({
                where: { isActive: true },
                include: { settings: true },
            });
        }
        // Attach to request — routes that need a shop will check req.context.shop themselves
        req.context = { shop };
        next();
    }
    catch (error) {
        console.error('Context Middleware Error:', error);
        res.status(500).json({ error: 'Failed to initialize request context' });
    }
};
exports.contextMiddleware = contextMiddleware;
//# sourceMappingURL=context.middleware.js.map