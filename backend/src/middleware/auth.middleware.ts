import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Validates the HMAC signature from Shopify OAuth callback.
 */
function validateHmac(query: Record<string, string>, secret: string): boolean {
    const { hmac, ...rest } = query;
    const message = Object.keys(rest)
        .sort()
        .map((k) => `${k}=${rest[k]}`)
        .join('&');
    const generatedHmac = crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(generatedHmac), Buffer.from(hmac));
}

/**
 * Middleware to validate Shopify webhook HMAC.
 * Must be applied BEFORE express.json() to get raw body.
 */
export function verifyWebhookHmac(req: Request, res: Response, next: NextFunction) {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
    if (!hmacHeader) {
        return res.status(401).json({ error: 'Missing webhook HMAC header' });
    }

    const secret = process.env.SHOPIFY_API_SECRET || '';
    const body = (req as any).rawBody as Buffer;

    if (!body) {
        return res.status(400).json({ error: 'Missing request body' });
    }

    const generatedHmac = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64');

    if (generatedHmac !== hmacHeader) {
        return res.status(401).json({ error: 'Invalid webhook HMAC' });
    }

    next();
}

/**
 * Middleware for OAuth verification. Validates Shopify install/auth requests.
 * Also adds Content-Security-Policy headers required for Shopify embedded apps.
 */
export function shopifyAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    const shop = req.query.shop as string;

    // Add CSP headers so the app can be embedded in Shopify Admin
    if (shop) {
        res.setHeader(
            'Content-Security-Policy',
            `frame-ancestors https://${shop} https://admin.shopify.com;`
        );
    }

    next();
}

/**
 * Session loader middleware - resolves the Shop from token stored in DB.
 * For embedded app: token comes from the Authorization header or from the session cookie.
 */
export async function loadShopSession(req: Request, res: Response, next: NextFunction) {
    try {
        const shopDomain = (req.headers['x-shopify-shop-domain'] as string) ||
            process.env.SHOPIFY_STORE ||
            'daginawala11.myshopify.com';

        const shop = await prisma.shop.findFirst({
            where: { domain: shopDomain, isActive: true },
            include: { settings: true },
        });

        // Attach to request context
        (req as any).context = { shop };
        next();
    } catch (err) {
        console.error('Session load error:', err);
        (req as any).context = { shop: null };
        next();
    }
}

/**
 * OAuth callback handler - exchanges the code for an access token and saves it.
 */
export async function handleOAuthCallback(req: Request, res: Response) {
    const { shop, code, hmac, state } = req.query as Record<string, string>;
    const apiSecret = process.env.SHOPIFY_API_SECRET || '';
    const apiKey = process.env.SHOPIFY_API_KEY || '';

    if (!shop || !code || !hmac) {
        return res.status(400).json({ error: 'Missing required OAuth params' });
    }

    // Validate HMAC
    if (!validateHmac(req.query as Record<string, string>, apiSecret)) {
        return res.status(403).json({ error: 'Invalid HMAC signature' });
    }

    try {
        // Exchange code for access token
        const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: apiKey,
                client_secret: apiSecret,
                code,
            }),
        });

        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error('Shopify token exchange failed:', errText);
            return res.status(500).json({ error: 'Token exchange failed' });
        }

        const tokenData = await tokenRes.json() as { access_token: string; scope: string };
        const { access_token, scope } = tokenData;

        // Upsert shop in database
        await prisma.shop.upsert({
            where: { domain: shop },
            update: {
                accessToken: access_token,
                scope,
                isActive: true,
                uninstalledAt: null,
            },
            create: {
                domain: shop,
                accessToken: access_token,
                scope,
                isActive: true,
            },
        });

        console.log(`✅ OAuth complete for ${shop}. Scopes: ${scope}`);

        // Redirect back into Shopify Admin
        const redirectUrl = `https://${shop}/admin/apps/${apiKey}`;
        res.redirect(redirectUrl);
    } catch (err: any) {
        console.error('OAuth callback error:', err);
        res.status(500).json({ error: 'OAuth failed', details: err.message });
    }
}

/**
 * Generates the Shopify OAuth install URL and redirects the merchant.
 */
export function handleInstall(req: Request, res: Response) {
    const shop = req.query.shop as string;
    if (!shop) {
        return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const apiKey = process.env.SHOPIFY_API_KEY || '';
    const scopes = process.env.SCOPES || 'read_products,write_products';
    const host = process.env.HOST || '';
    const redirectUri = `${host}/auth/callback`;
    const state = crypto.randomBytes(16).toString('hex');

    const installUrl =
        `https://${shop}/admin/oauth/authorize?` +
        `client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    res.redirect(installUrl);
}
