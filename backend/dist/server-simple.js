"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const multer_1 = __importDefault(require("multer"));
const xlsx = __importStar(require("xlsx"));
const fs_1 = __importDefault(require("fs"));
const bulkPriceUpdate_service_1 = require("./services/bulkPriceUpdate.service");
const shopify_service_1 = require("./services/shopify.service");
const gemstoneDisplay_1 = require("./utils/gemstoneDisplay");
const pricing_service_1 = require("./services/pricing.service");
const context_middleware_1 = require("./middleware/context.middleware");
const products_routes_1 = __importDefault(require("./routes/products.routes"));
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
// FIX BUG-24: Warn loudly if JWT_SECRET is not set in production
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_super_secret_gemini_2026_xyz';
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  WARNING: JWT_SECRET is not set in environment. Using fallback — this is INSECURE in production!');
}
const PORT = process.env.PORT || 3000;
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'daginawala11.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const HOST = process.env.HOST || `http://localhost:${process.env.PORT || 3000}`;
const IS_DESKTOP_MODE = process.env.NODE_ENV === 'development' && !process.env.SHOPIFY_ACCESS_TOKEN;
if (!SHOPIFY_ACCESS_TOKEN) {
    console.warn('⚠️  WARNING: SHOPIFY_ACCESS_TOKEN not set in environment variables');
    console.warn('⚠️  Running in DESKTOP MODE - Shopify sync features will be limited');
    console.warn('⚠️  Set SHOPIFY_ACCESS_TOKEN in backend/.env to enable full functionality');
}
const crypto_1 = require("crypto");
const app = (0, express_1.default)();
app.use((0, compression_1.default)());
app.use((0, cors_1.default)());
// Capture raw body ONLY for webhook routes (for HMAC verification)
// Applying this globally causes express.json() to fail on all other routes (stream already consumed)
app.use('/webhooks', (req, res, next) => {
    let data = [];
    req.on('data', (chunk) => data.push(chunk));
    req.on('end', () => {
        req.rawBody = Buffer.concat(data);
        next();
    });
    req.on('error', next);
});
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
app.use(context_middleware_1.contextMiddleware); // Register context middleware globally

// ==================== SHOPIFY OAUTH ROUTES ====================
// Validates HMAC on incoming OAuth requests
function validateHmac(query, secret) {
    const { hmac, signature, ...rest } = query;
    const message = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('&');
    const generatedHmac = crypto_1.createHmac('sha256', secret).update(message).digest('hex');
    try {
        return crypto_1.timingSafeEqual(Buffer.from(generatedHmac), Buffer.from(hmac || ''));
    } catch (e) { return false; }
}

// GET /auth/install - Start OAuth flow (merchant clicks install)
app.get('/auth/install', (req, res) => {
    const shop = req.query.shop;
    if (!shop) return res.status(400).json({ error: 'Missing shop parameter' });
    const scopes = process.env.SCOPES || 'read_products,write_products,read_inventory,write_inventory';
    const redirectUri = `${HOST}/auth/callback`;
    const state = crypto_1.randomBytes(16).toString('hex');
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    // Set frame-ancestors CSP header
    res.setHeader('Content-Security-Policy', `frame-ancestors https://${shop} https://admin.shopify.com;`);
    console.log(`🔐 OAuth install initiated for: ${shop}`);
    res.redirect(installUrl);
});

// GET /auth/callback - OAuth callback, exchanges code for access token
app.get('/auth/callback', async (req, res) => {
    const { shop, code, hmac } = req.query;
    if (!shop || !code || !hmac) return res.status(400).json({ error: 'Missing required OAuth params' });
    if (SHOPIFY_API_SECRET && !validateHmac(req.query, SHOPIFY_API_SECRET)) {
        return res.status(403).json({ error: 'Invalid HMAC signature' });
    }
    try {
        const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: SHOPIFY_API_KEY, client_secret: SHOPIFY_API_SECRET, code }),
        });
        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error('Shopify token exchange failed:', errText);
            return res.status(500).json({ error: 'Token exchange failed' });
        }
        const { access_token, scope } = await tokenRes.json();
        await prisma.shop.upsert({
            where: { domain: shop },
            update: { accessToken: access_token, scope, isActive: true, uninstalledAt: null },
            create: { domain: shop, accessToken: access_token, scope, isActive: true },
        });
        // Ensure settings exist for newly installed shop
        const shopRecord = await prisma.shop.findUnique({ where: { domain: shop } });
        if (shopRecord) {
            await prisma.shopSettings.upsert({
                where: { shopId: shopRecord.id },
                update: {},
                create: {
                    shopId: shopRecord.id,
                    rateSource: 'manual',
                    defaultMakingChargeType: 'per_gram',
                    defaultMakingChargeValue: 1500,
                    defaultWastagePct: 2,
                    defaultGstPct: 3,
                    defaultDiscount: 0
                }
            });
        }
        console.log(`✅ OAuth complete for ${shop}. Scopes: ${scope}`);
        res.redirect(`https://${shop}/admin/apps/${SHOPIFY_API_KEY}`);
    } catch (err) {
        console.error('OAuth callback error:', err);
        res.status(500).json({ error: 'OAuth failed', details: err.message });
    }
});

// Helper to verify Shopify webhook HMAC
function verifyWebhookHmac(req, res, next) {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    if (!hmacHeader || !SHOPIFY_API_SECRET) { return next(); } // Skip in dev mode
    const body = req.rawBody || Buffer.alloc(0);
    const generatedHmac = crypto_1.createHmac('sha256', SHOPIFY_API_SECRET).update(body).digest('base64');
    if (generatedHmac !== hmacHeader) {
        return res.status(401).json({ error: 'Invalid webhook HMAC' });
    }
    next();
}

// ==================== GDPR MANDATORY WEBHOOKS ====================
// Shopify REQUIRES these 3 endpoints for App Store submission

// POST /webhooks/customers/data_request - Customer requested their data
app.post('/webhooks/customers/data_request', verifyWebhookHmac, (req, res) => {
    const { shop_domain, customer } = req.body || {};
    console.log(`[GDPR] Data request: shop=${shop_domain}, customer_id=${customer?.id}`);
    // This app only stores: product prices, metal/gemstone rates. No customer PII is stored.
    res.status(200).json({ message: 'No personal customer data stored by this app.' });
});

// POST /webhooks/customers/redact - Delete all customer data
app.post('/webhooks/customers/redact', verifyWebhookHmac, (req, res) => {
    const { shop_domain, customer } = req.body || {};
    console.log(`[GDPR] Customer redact: shop=${shop_domain}, customer_id=${customer?.id}`);
    // No customer PII stored - nothing to delete.
    res.status(200).json({ message: 'No personal customer data to redact.' });
});

// POST /webhooks/shop/redact - Delete all shop data (48 hrs after uninstall)
app.post('/webhooks/shop/redact', verifyWebhookHmac, async (req, res) => {
    const { shop_domain } = req.body || {};
    console.log(`[GDPR] Shop redact requested: shop=${shop_domain}`);
    try {
        // Cascade deletes in Prisma schema handle all related records automatically
        await prisma.shop.deleteMany({ where: { domain: shop_domain } });
        console.log(`[GDPR] ✅ All data deleted for shop ${shop_domain}`);
        res.status(200).json({ message: `All data for shop ${shop_domain} deleted.` });
    } catch (err) {
        console.error(`[GDPR] Shop redact failed for ${shop_domain}:`, err.message);
        res.status(200).json({ message: 'Redact request acknowledged.' }); // Always 200
    }
});

// POST /webhooks/app/uninstalled - Mark shop as inactive
app.post('/webhooks/app/uninstalled', verifyWebhookHmac, async (req, res) => {
    const shopDomain = req.headers['x-shopify-shop-domain'];
    if (shopDomain) {
        await prisma.shop.updateMany({
            where: { domain: shopDomain },
            data: { isActive: false, uninstalledAt: new Date() },
        }).catch(console.error);
        console.log(`📦 App uninstalled from: ${shopDomain}`);
    }
    res.status(200).json({ ok: true });
});
// Register routes
// Mock Shopify session for local dev before routes
app.use(async (req, res, next) => {
    // Only intercept paths that start with /api/
    if (!req.path.startsWith('/api/')) return next();

    // Whitelist login, health, and status
    if (['/api/login', '/api/health', '/api/db-status'].includes(req.path)) {
        return next();
    }

    // ALLOW CORS PREFLIGHT REQUESTS TO PASS THROUGH!
    if (req.method === 'OPTIONS') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach the decoded token payload
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
    }

    res.locals.shopify = {
        session: {
            shop: SHOPIFY_STORE,
        },
    };
    next();
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await prisma.adminUser.findUnique({ where: { username } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.use('/api/products', products_routes_1.default);
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Helper to log audit events
// Helper to log audit events
const logAudit = async (shopId, action, entity, entityId, details, reason) => {
    try {
        await prisma.auditLog.create({
            data: {
                shopId,
                action,
                entity,
                entityId,
                oldValue: details.oldValue ? JSON.stringify(details.oldValue) : null,
                newValue: details.newValue ? JSON.stringify(details.newValue) : null,
                reason,
            }
        });
    }
    catch (e) {
        console.error('Failed to log audit:', e);
    }
};
// Helper to generate HTML table for breakdown (Centralized in ShopifyService)
const generateBreakdownHtml = (breakdown) => shopify_service_1.ShopifyService.generateBreakdownHtml(breakdown);
// Helper to push to Shopify & Log History
const path_1 = require("path");
const LOG_FILE = path_1.join(__dirname, '..', 'forensic_diagnostic.log');
const forensicLog = (msg) => {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] ${msg}\n`;
    console.log(msg);
    try {
        fs_1.default.appendFileSync(LOG_FILE, formattedMsg);
    }
    catch (e) {
        console.error('Failed to write to forensic log:', e);
    }
};
// Helper to push to Shopify & Log History
// Refactored to remove internal DB logging and accept oldPrice explicitly
const pushToShopify = async (shopDomain, accessToken, product, price, breakdown) => {
    forensicLog(`\n🔄 [CENTRALIZED SYNC] Pushing ${product.sku || 'Product'} to Shopify...`);
    const shopifyService = new shopify_service_1.ShopifyService(shopDomain, accessToken);
    return shopifyService.updateVariantWithBreakdown(product.shopifyVariantId, price, breakdown);
};
// === End of GDPR / Auth sections ===
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Sync job status - polled by SyncStatusIndicator in the frontend
app.get('/api/sync/status', async (req, res) => {
    try {
        const shop = req.context?.shop;
        if (!shop) {
            return res.json({ job: null });
        }
        // Try to get the latest sync job for this shop
        const latestJob = await prisma.syncJob?.findFirst?.({
            where: { shopId: shop.id },
            orderBy: { createdAt: 'desc' }
        }).catch(() => null);
        res.json({ job: latestJob || null });
    } catch (error) {
        // Gracefully return null if SyncJob model doesn't exist yet
        res.json({ job: null });
    }
});
// Database status check
app.get('/api/db-status', async (req, res) => {
    try {
        // FIX BUG-13: Safely access shop — this endpoint is whitelisted from JWT auth
        const shop = req.context?.shop;
        const productsCount = shop ? await prisma.product.count({ where: { shopId: shop.id } }) : 0;
        const ratesCount = shop ? await prisma.metalRate.count({ where: { shopId: shop.id } }) : 0;
        res.json({
            database: 'connected',
            shopConfigured: !!shop,
            shopDomain: shop?.domain || null,
            productsCount,
            metalRatesCount: ratesCount,
            isDesktopMode: IS_DESKTOP_MODE,
            hasShopifyCredentials: !!SHOPIFY_ACCESS_TOKEN
        });
    }
    catch (error) {
        res.status(500).json({
            database: 'error',
            error: error.message
        });
    }
});
// Get rates
app.get('/api/rates', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Get all metal rates
        const allMetalRates = await prisma.metalRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
        });
        // Group by metal and karat, keeping only the latest
        const latestRatesMap = new Map();
        for (const rate of allMetalRates) {
            const key = `${rate.metal}-${rate.karat || 'null'}`;
            if (!latestRatesMap.has(key)) {
                latestRatesMap.set(key, rate);
            }
        }
        const metalRates = Array.from(latestRatesMap.values());
        const stoneRates = await prisma.stoneRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
        });
        const enamelRates = await prisma.enamelRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
        });
        const metalRatesWithChange = metalRates.map((rate) => ({
            ...rate,
            ratePer10g: rate.ratePerGram * 10,
            change24h: 0,
        }));
        res.json({ metalRates: metalRatesWithChange, stoneRates, enamelRates });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch rates' });
    }
});
// Update rate
app.post('/api/rates/update', async (req, res) => {
    try {
        // FIX BUG-14: Use req.context.shop instead of findFirst (multi-shop safety)
        const shop = req.context?.shop
            ? await prisma.shop.findUnique({ where: { id: req.context.shop.id }, include: { settings: true } })
            : await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { metal, karat, ratePerGram, reason } = req.body;
        
        // Find ALL existing rates for this metal/karat
        const oldRates = await prisma.metalRate.findMany({
            where: { shopId: shop.id, metal, karat: karat || null },
            orderBy: { updatedAt: 'desc' }
        });
        
        let newRate;
        if (oldRates.length > 0) {
            // Update the newest one
            newRate = await prisma.metalRate.update({
                where: { id: oldRates[0].id },
                data: {
                    ratePerGram: parseFloat(ratePerGram),
                    rateSource: 'manual',
                    reason,
                    updatedBy: shop.domain || 'system'
                }
            });
            
            // Self-Heal: Delete any ghost duplicates
            if (oldRates.length > 1) {
                const idsToDelete = oldRates.slice(1).map(r => r.id);
                await prisma.metalRate.deleteMany({
                    where: { id: { in: idsToDelete } }
                });
                console.log(`🧹 Cleaned up ${idsToDelete.length} ghost rates for ${metal} ${karat || ''}`);
            }
        } else {
            // Create a completely new rate
            newRate = await prisma.metalRate.create({
                data: {
                    shopId: shop.id,
                    metal,
                    karat: karat || null,
                    ratePerGram: parseFloat(ratePerGram),
                    rateSource: 'manual',
                    reason,
                    updatedBy: shop.domain || 'system'
                },
            });
        }
        console.log(`✅ Updated ${metal} ${karat ? karat + 'K' : ''} rate to ₹${ratePerGram}/g`);
        // Log audit
        await logAudit(shop.id, 'rate_update', 'metal_rate', newRate.id, { newValue: newRate }, reason);
        // Note: Product prices are NOT automatically updated
        // Users must manually trigger price updates via the "Update All Prices" button
        console.log(`ℹ️  Rate updated. Use "Update All Prices" to recalculate product prices.`);
        res.json({
            success: true,
            rate: newRate,
            message: 'Rate updated successfully. Click "Update All Prices" to recalculate product prices.'
        });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update rate' });
    }
});
// Update gemstone/stone rate
app.post('/api/stone-rates/update', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { id, stoneType, naturalOrLabgrown, quality, shape, cut, color, clarity, caratRange, ratePerCarat, ratePerPiece, reason } = req.body;
        // If id is provided, update existing rate; otherwise create new
        if (id) {
            // Update existing rate
            const updatedRate = await prisma.stoneRate.update({
                where: { id },
                data: {
                    stoneType,
                    naturalOrLabgrown: naturalOrLabgrown || null,
                    quality: quality || null,
                    shape: shape || null,
                    cut: cut || null,
                    color: color || null,
                    clarity: clarity || null,
                    caratRange: caratRange || null,
                    ratePerCarat: ratePerCarat ? parseFloat(ratePerCarat) : null,
                    ratePerPiece: ratePerPiece ? parseFloat(ratePerPiece) : null,
                    updatedBy: 'manual',
                    reason,
                },
            });
            console.log(`✅ Updated ${stoneType} rate: ${ratePerCarat ? `₹${ratePerCarat}/carat` : `₹${ratePerPiece}/piece`}`);
            res.json({ success: true, rate: updatedRate });
        }
        else {
            // Create new rate
            const newRate = await prisma.stoneRate.create({
                data: {
                    shopId: shop.id,
                    stoneType,
                    naturalOrLabgrown: naturalOrLabgrown || null,
                    quality: quality || null,
                    shape: shape || null,
                    cut: cut || null,
                    color: color || null,
                    clarity: clarity || null,
                    caratRange: caratRange || null,
                    ratePerCarat: ratePerCarat ? parseFloat(ratePerCarat) : null,
                    ratePerPiece: ratePerPiece ? parseFloat(ratePerPiece) : null,
                    updatedBy: 'manual',
                    reason,
                },
            });
            console.log(`✅ Created ${stoneType} rate: ${ratePerCarat ? `₹${ratePerCarat}/carat` : `₹${ratePerPiece}/piece`}`);
            res.json({ success: true, rate: newRate });
        }
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update stone rate' });
    }
});
// Update enamel rate
app.post('/api/enamel-rates/update', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { enamelColor, ratePerGram, reason } = req.body;
        const newRate = await prisma.enamelRate.create({
            data: {
                shopId: shop.id,
                enamelColor,
                ratePerGram: parseFloat(ratePerGram),
                updatedBy: 'manual',
                reason,
            },
        });
        console.log(`✅ Updated ${enamelColor} enamel rate: ₹${ratePerGram}/g`);
        res.json({ success: true, rate: newRate });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update enamel rate' });
    }
});
// Delete metal rate
app.delete('/api/rates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify rate belongs to shop before deleting
        const rate = await prisma.metalRate.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!rate) {
            return res.status(404).json({ error: 'Metal rate not found' });
        }
        await prisma.metalRate.delete({ where: { id } });
        console.log(`✅ Deleted ${rate.metal} ${rate.karat ? rate.karat + 'K' : ''} rate`);
        // Log audit
        await logAudit(shop.id, 'rate_delete', 'metal_rate', id, { oldValue: rate }, 'Manual deletion');
        res.json({ success: true, message: 'Rate deleted successfully' });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to delete metal rate' });
    }
});
// Delete stone rate
app.delete('/api/stone-rates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify rate belongs to shop before deleting
        const rate = await prisma.stoneRate.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!rate) {
            return res.status(404).json({ error: 'Stone rate not found' });
        }
        await prisma.stoneRate.delete({ where: { id } });
        console.log(`✅ Deleted ${rate.stoneType} rate`);
        // Log audit
        await logAudit(shop.id, 'rate_delete', 'stone_rate', id, { oldValue: rate }, 'Manual deletion');
        res.json({ success: true, message: 'Stone rate deleted successfully' });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to delete stone rate' });
    }
});
// Delete enamel rate
app.delete('/api/enamel-rates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify rate belongs to shop before deleting
        const rate = await prisma.enamelRate.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!rate) {
            return res.status(404).json({ error: 'Enamel rate not found' });
        }
        await prisma.enamelRate.delete({ where: { id } });
        console.log(`✅ Deleted ${rate.enamelColor} enamel rate`);
        // Log audit
        await logAudit(shop.id, 'rate_delete', 'enamel_rate', id, { oldValue: rate }, 'Manual deletion');
        res.json({ success: true, message: 'Enamel rate deleted successfully' });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to delete enamel rate' });
    }
});
// ==================== MAKING GROUPS API ====================
// Get all making groups
app.get('/api/making-groups', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const makingGroups = await prisma.makingGroup.findMany({
            where: { shopId: shop.id },
            include: {
                _count: {
                    select: { products: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ makingGroups });
    }
    catch (error) {
        console.error('Error fetching making groups:', error);
        res.status(500).json({ error: 'Failed to fetch making groups' });
    }
});
// Create making group
app.post('/api/making-groups', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { name, type, value } = req.body;
        // Validation
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }
        if (!type || !['per_gram', 'flat', 'percent'].includes(type)) {
            return res.status(400).json({ error: 'Type must be per_gram, flat, or percent' });
        }
        if (value === undefined || value === null || parseFloat(value) <= 0) {
            return res.status(400).json({ error: 'Value must be greater than 0' });
        }
        // Check for duplicate name
        const existing = await prisma.makingGroup.findFirst({
            where: {
                shopId: shop.id,
                name: name.trim()
            }
        });
        if (existing) {
            return res.status(400).json({ error: 'A making group with this name already exists' });
        }
        const makingGroup = await prisma.makingGroup.create({
            data: {
                shopId: shop.id,
                name: name.trim(),
                type,
                value: parseFloat(value),
            },
        });
        console.log(`✅ Created making group: ${name} (${type}, ₹${value})`);
        res.json({ success: true, makingGroup });
    }
    catch (error) {
        console.error('Error creating making group:', error);
        res.status(500).json({ error: 'Failed to create making group' });
    }
});
//Update making group
app.put('/api/making-groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify making group belongs to shop
        const existing = await prisma.makingGroup.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Making group not found' });
        }
        const { name, type, value } = req.body;
        // Validation
        if (name !== undefined && (!name || !name.trim())) {
            return res.status(400).json({ error: 'Name cannot be empty' });
        }
        if (type !== undefined && !['per_gram', 'flat', 'percent'].includes(type)) {
            return res.status(400).json({ error: 'Type must be per_gram, flat, or percent' });
        }
        if (value !== undefined && (value === null || parseFloat(value) <= 0)) {
            return res.status(400).json({ error: 'Value must be greater than 0' });
        }
        // Check for duplicate name if name is being changed
        if (name && name.trim() !== existing.name) {
            const duplicate = await prisma.makingGroup.findFirst({
                where: {
                    shopId: shop.id,
                    name: name.trim(),
                    id: { not: id }
                }
            });
            if (duplicate) {
                return res.status(400).json({ error: 'A making group with this name already exists' });
            }
        }
        const makingGroup = await prisma.makingGroup.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(type !== undefined && { type }),
                ...(value !== undefined && { value: parseFloat(value) }),
            },
        });
        console.log(`✅ Updated making group: ${makingGroup.name}`);
        res.json({ success: true, makingGroup });
    }
    catch (error) {
        console.error('Error updating making group:', error);
        res.status(500).json({ error: 'Failed to update making group' });
    }
});
// Delete making group
app.delete('/api/making-groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify making group belongs to shop
        const makingGroup = await prisma.makingGroup.findFirst({
            where: { id, shopId: shop.id },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });
        if (!makingGroup) {
            return res.status(404).json({ error: 'Making group not found' });
        }
        // Check if any products are using this group
        if (makingGroup._count.products > 0) {
            return res.status(400).json({
                error: `Cannot delete: ${makingGroup._count.products} product(s) are using this making group. Please reassign them first.`
            });
        }
        await prisma.makingGroup.delete({ where: { id } });
        console.log(`✅ Deleted making group: ${makingGroup.name}`);
        res.json({ success: true, message: 'Making group deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting making group:', error);
        res.status(500).json({ error: 'Failed to delete making group' });
    }
});
// Get products for assignment modal (with group status)
app.get('/api/products/for-assignment', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { page = 1, limit = 20, search, excludeGroupId, collectionId } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = { shopId: shop.id };
        if (search) {
            where.OR = [
                { sku: { contains: search } },
                { title: { contains: search } },
            ];
        }
        // Apply Collection Filter
        if (collectionId && SHOPIFY_ACCESS_TOKEN) {
            const productIds = await shopify_service_1.ShopifyService.getCollectionProductIds(SHOPIFY_ACCESS_TOKEN, collectionId);
            if (productIds.length > 0) {
                where.shopifyProductId = { in: productIds };
            }
            else {
                where.shopifyProductId = { in: [] };
            }
        }
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { title: 'asc' },
                select: {
                    id: true,
                    sku: true,
                    title: true,
                    imageUrl: true,
                    makingGroupId: true,
                    makingGroup: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                },
            }),
            prisma.product.count({ where }),
        ]);
        // Transform products to include assignment status
        const productsWithStatus = products.map(product => ({
            ...product,
            isAssigned: !!product.makingGroupId,
            assignedToCurrentGroup: excludeGroupId ? product.makingGroupId === excludeGroupId : false,
            assignedToOtherGroup: product.makingGroupId && product.makingGroupId !== excludeGroupId,
            assignedGroupName: product.makingGroup?.name || null,
        }));
        res.json({
            products: productsWithStatus,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error('Error fetching products for assignment:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});
// Get products assigned to a specific making group
app.get('/api/making-groups/:id/products', async (req, res) => {
    try {
        const { id } = req.params;
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify making group belongs to shop
        const makingGroup = await prisma.makingGroup.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!makingGroup) {
            return res.status(404).json({ error: 'Making group not found' });
        }
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where: { makingGroupId: id },
                skip,
                take: parseInt(limit),
                orderBy: { title: 'asc' },
                select: {
                    id: true,
                    sku: true,
                    title: true,
                    imageUrl: true,
                },
            }),
            prisma.product.count({ where: { makingGroupId: id } }),
        ]);
        res.json({
            products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error('Error fetching group products:', error);
        res.status(500).json({ error: 'Failed to fetch group products' });
    }
});
// Assign products to a making group (with exclusive membership validation)
app.post('/api/making-groups/:id/assign-products', async (req, res) => {
    try {
        const { id } = req.params;
        const { productIds } = req.body;
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: 'Product IDs array is required' });
        }
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify making group belongs to shop
        const makingGroup = await prisma.makingGroup.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!makingGroup) {
            return res.status(404).json({ error: 'Making group not found' });
        }
        // CRITICAL: Server-side validation for exclusive membership
        // Check if any products are already assigned to a DIFFERENT group
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                shopId: shop.id,
            },
            include: {
                makingGroup: {
                    select: { id: true, name: true }
                }
            }
        });
        // Find conflicting products (assigned to different group)
        const conflictingProducts = products.filter(p => p.makingGroupId && p.makingGroupId !== id);
        if (conflictingProducts.length > 0) {
            // REJECT ENTIRE REQUEST - do not silently reassign
            return res.status(400).json({
                error: 'Some products are already assigned to another Making Group',
                conflictingProducts: conflictingProducts.map(p => ({
                    id: p.id,
                    title: p.title,
                    sku: p.sku,
                    currentGroupName: p.makingGroup?.name,
                })),
            });
        }
        // All products are safe to assign (either NULL or already in this group)
        // Only update products that are not already in this group
        const productsToUpdate = products.filter(p => p.makingGroupId !== id);
        if (productsToUpdate.length > 0) {
            await prisma.product.updateMany({
                where: {
                    id: { in: productsToUpdate.map(p => p.id) },
                },
                data: {
                    makingGroupId: id,
                    makingChargeType: 'master', // Automatically set to master
                },
            });

            // Recalculate price in background so we don't block the UI
            setImmediate(async () => {
                try {
                    console.log(`[ASSIGN] Triggering bulk price recalculation for ${productsToUpdate.length} products...`);
                    const priceResults = await pricing_service_1.PricingService.calculateBulkPrices(shop.id, productsToUpdate.map(p => p.id));
                    
                    if (priceResults.length > 0) {
                        const shopifyUpdates = priceResults.map(p => {
                           const prod = productsToUpdate.find(x => x.id === p.productId);
                           return {
                               variantId: prod.shopifyVariantId,
                               price: p.newPrice,
                               breakdown: p.breakdown
                           };
                        });
                        
                        // update local database
                        for (const result of priceResults) {
                           await prisma.product.update({
                              where: { id: result.productId },
                              data: {
                                  currentPrice: result.newPrice,
                                  lastCalculatedPrice: result.newPrice,
                                  lastPushedPrice: result.newPrice,
                                  lastPushedAt: new Date()
                              }
                           });
                        }

                        // push updates to Shopify
                        console.log(`[ASSIGN] Pushing updated prices to Shopify...`);
                        const shopifyService = await shopify_service_1.ShopifyService.forShop(shop.domain);
                        await shopifyService.updateVariantPricesBatch(shopifyUpdates);
                        console.log(`[ASSIGN] ✅ Finished updating prices for assigned products.`);
                    }
                } catch (e) {
                   console.error("[ASSIGN] Failed to recalculate prices after assign-products", e);
                }
            });
        }
        console.log(`✅ Assigned ${productsToUpdate.length} products to making group: ${makingGroup.name}`);
        res.json({
            success: true,
            assignedCount: productsToUpdate.length,
            alreadyAssignedCount: products.length - productsToUpdate.length,
            message: `Successfully assigned ${productsToUpdate.length} product(s) to "${makingGroup.name}"`,
        });
    }
    catch (error) {
        console.error('Error assigning products to making group:', error);
        res.status(500).json({ error: 'Failed to assign products' });
    }
});
// Remove products from a making group
app.post('/api/making-groups/:id/remove-products', async (req, res) => {
    try {
        const { id } = req.params;
        const { productIds } = req.body;
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: 'Product IDs array is required' });
        }
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify making group belongs to shop
        const makingGroup = await prisma.makingGroup.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!makingGroup) {
            return res.status(404).json({ error: 'Making group not found' });
        }
        // Only remove products that actually belong to this group
        const result = await prisma.product.updateMany({
            where: {
                id: { in: productIds },
                makingGroupId: id, // Only update if currently assigned to this group
            },
            data: {
                makingGroupId: null,
                // DO NOT update any other fields
            },
        });
        console.log(`✅ Removed ${result.count} products from making group: ${makingGroup.name}`);
        res.json({
            success: true,
            removedCount: result.count,
            message: `Successfully removed ${result.count} product(s) from "${makingGroup.name}"`,
        });
    }
    catch (error) {
        console.error('Error removing products from making group:', error);
        res.status(500).json({ error: 'Failed to remove products' });
    }
});
// ==================== END MAKING GROUPS API ====================
// Get audit logs
app.get('/api/audit', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop)
            return res.status(404).json({ error: 'Shop not found' });
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: { shopId: shop.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.auditLog.count({ where: { shopId: shop.id } }),
        ]);
        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});
// Get price history
app.get('/api/audit/history', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        // FIX BUG-18: Filter price history by shop to prevent cross-shop data leakage
        const shop = req.context?.shop;
        const shopFilter = shop ? { product: { shopId: shop.id } } : {};
        const [history, total] = await Promise.all([
            prisma.priceHistory.findMany({
                where: shopFilter,
                include: { product: { select: { sku: true, title: true } } },
                orderBy: { pushedAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.priceHistory.count({ where: shopFilter }),
        ]);
        res.json({
            history,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});
// ==================== SHOPIFY COLLECTIONS ====================
app.get('/api/shopify/collections', async (req, res) => {
    try {
        // Since this is a simple local dev layout, we use the env variable.
        // In a real app with multiple shops, we would look up the accessToken for the current shop.
        if (!SHOPIFY_ACCESS_TOKEN) {
            return res.json([]); // Fail softly as requested
        }
        const collections = await shopify_service_1.ShopifyService.getAllCollections(SHOPIFY_ACCESS_TOKEN);
        res.json(collections);
    }
    catch (error) {
        console.error('Error fetching collections:', error);
        res.json([]);
    }
});
// FIX BUG-03: Duplicate GET /api/products removed — handled by products.routes.js router (mounted at line 284)
// Manual bulk price update endpoint
app.post('/api/products/update-all-prices', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        console.log('🔄 Manual bulk price update triggered');
        // Trigger bulk update for all products
        const jobId = await bulkPriceUpdate_service_1.BulkPriceUpdateService.triggerUpdate({
            shopId: shop.id,
            triggeredBy: 'manual_update',
        });
        res.json({
            success: true,
            message: 'Bulk price update started. This may take a few minutes.',
            jobId,
        });
    }
    catch (error) {
        console.error('Error triggering bulk price update:', error);
        res.status(500).json({ error: 'Failed to trigger bulk price update' });
    }
});
// Sync products from Shopify
app.post('/api/products/sync', async (req, res) => {
    try {
        // Check if we have valid Shopify credentials
        if (!SHOPIFY_ACCESS_TOKEN) {
            return res.status(400).json({
                error: 'Shopify credentials not configured',
                message: 'Please set SHOPIFY_ACCESS_TOKEN in backend/.env to sync products'
            });
        }
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        console.log(`Syncing products from ${SHOPIFY_STORE}...`);
        // FIX BUG-15: Paginate through ALL products (Shopify limit is 250 per page)
        console.log('Making Shopify API requests (paginated)...');
        let shopifyProducts = [];
        let nextPageUrl = `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250`;

        while (nextPageUrl) {
            const response = await axios_1.default.get(nextPageUrl, {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                },
                timeout: 60000,
            });
            const pageProducts = response.data.products || [];
            shopifyProducts = shopifyProducts.concat(pageProducts);
            console.log(`Fetched ${pageProducts.length} products (total so far: ${shopifyProducts.length})`);

            // Check for next page via Link header
            const linkHeader = response.headers['link'] || response.headers['Link'] || '';
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            nextPageUrl = nextMatch ? nextMatch[1] : null;
        }

        console.log(`Total products fetched from Shopify: ${shopifyProducts.length}`);
        let syncedCount = 0;
        // Process products sequentially (reverted from batch processing)
        for (const product of shopifyProducts) {
            const imageUrl = product.image?.src || product.images?.[0]?.src || null;
            const status = product.status;
            console.log(`Processing product: ${product.title}`);
            for (const variant of product.variants) {
                try {
                    await prisma.product.upsert({
                        where: { shopifyVariantId: `gid://shopify/ProductVariant/${variant.id}` },
                        create: {
                            shopId: shop.id,
                            shopifyProductId: `gid://shopify/Product/${product.id}`,
                            shopifyVariantId: `gid://shopify/ProductVariant/${variant.id}`,
                            sku: variant.sku || null,
                            title: product.title,
                            variantTitle: variant.title,
                            imageUrl,
                            status,
                            currentPrice: parseFloat(variant.price),
                        },
                        update: {
                            title: product.title,
                            variantTitle: variant.title,
                            imageUrl,
                            status,
                            currentPrice: parseFloat(variant.price),
                            sku: variant.sku || null,
                        },
                    });
                    syncedCount++;
                    if (syncedCount % 10 === 0) {
                        console.log(`Processed ${syncedCount} variants so far...`);
                    }
                }
                catch (dbError) {
                    console.error(`Error upserting variant ${variant.id}:`, dbError.message);
                    throw dbError; // Re-throw to be caught by outer catch
                }
            }
        }
        console.log(`✅ Synced ${syncedCount} products from Shopify`);
        res.json({ success: true, syncedCount });
    }
    catch (error) {
        console.error('❌ Error syncing products:');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        if (error.response) {
            console.error('Shopify Response Status:', error.response.status);
            console.error('Shopify Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        res.status(500).json({
            error: 'Failed to sync products',
            message: error.message,
            details: error.response?.data || error.message
        });
    }
});
// Get sync status
app.get('/api/products/sync/status', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Get the most recent product_sync job
        const job = await prisma.job.findFirst({
            where: {
                shopId: shop.id,
                jobType: 'product_sync'
            },
            orderBy: { createdAt: 'desc' }
        });
        if (!job) {
            return res.json({ job: null });
        }
        res.json({ job });
    }
    catch (error) {
        console.error('Error fetching sync status:', error);
        res.status(500).json({ error: 'Failed to fetch sync status' });
    }
});

// --- SINGLE SOURCE OF TRUTH FOR TEMPLATE STRUCTURE ---
const PRODUCT_TEMPLATE_COLUMNS = [
    // Identity
    'SKU',
    'Title',
    'Status',
    'Collection',
    // Metal
    'Metal Type',
    'Metal Purity',
    'Metal Weight (g)',
    'Gross Weight (g)',
    'Wastage %',
    // Gemstone 1
    'Stone 1: Used', 'Stone 1: Type', 'Stone 1: Shape', 'Stone 1: Quality',
    'Stone 1: Color', 'Stone 1: Clarity', 'Stone 1: Cut',
    'Stone 1: Weight (ct)', 'Stone 1: Pieces',
    'Stone 1: Rate Type', 'Stone 1: Rate Value', 'Stone 1: Custom',
    // Gemstone 2
    'Stone 2: Used', 'Stone 2: Type', 'Stone 2: Shape', 'Stone 2: Quality',
    'Stone 2: Color', 'Stone 2: Clarity', 'Stone 2: Cut',
    'Stone 2: Weight (ct)', 'Stone 2: Pieces',
    'Stone 2: Rate Type', 'Stone 2: Rate Value', 'Stone 2: Custom',
    // Gemstone 3
    'Stone 3: Used', 'Stone 3: Type', 'Stone 3: Shape', 'Stone 3: Quality',
    'Stone 3: Color', 'Stone 3: Clarity', 'Stone 3: Cut',
    'Stone 3: Weight (ct)', 'Stone 3: Pieces',
    'Stone 3: Rate Type', 'Stone 3: Rate Value', 'Stone 3: Custom',
    // Enamel
    'Enamel Color',
    'Enamel Weight (g)',
    'Enamel Discount Type',
    'Enamel Discount Value',
    // Discounts & Tax
    'Discount Type',
    'Discount Value',
    'GST %',
    // Making Charges
    'Labour Type',
    'Labour Value',
    'Labour From',
    'Wastage From',
    'Wastage Value',
    // System / Read-only
    'Current Price',
    'Last Synced'
];
// Download sample template for import
app.get('/api/products/template', async (req, res) => {
    try {
        const format = req.query.format || 'xlsx';
        // Headers object for CSV generation (Key = Value)
        const headers = {};
        PRODUCT_TEMPLATE_COLUMNS.forEach(col => headers[col] = col);
        const note = {
            SKU: 'NOTE: Do not modify identifying columns. Making Charges are EXCLUDED.',
            'Metal Type': 'gold, silver, platinum',
            'Wastage %': '0-100',
            'Stone 1: Used': 'Natural, Lab Grown',
            'Stone 1: Custom': 'TRUE/FALSE',
            'Enamel Discount Type': 'flat, percent, none',
            'Discount Type': 'flat, percent'
        };
        const sampleGold = {
            SKU: 'GOLD-RING-001',
            Title: 'Gold Ring',
            Status: 'active',
            Collection: 'Rings',
            'Metal Type': 'gold',
            'Metal Purity': '22',
            'Metal Weight (g)': 5.5,
            'Gross Weight (g)': 6.1,
            'Wastage %': 2.0,
            'Stone 1: Used': 'Natural',
            'Stone 1: Type': 'diamond',
            'Stone 1: Shape': 'Round',
            'Stone 1: Quality': 'Precious',
            'Stone 1: Color': 'D',
            'Stone 1: Clarity': 'VS1',
            'Stone 1: Cut': 'Excellent',
            'Stone 1: Weight (ct)': 0.5,
            'Stone 1: Pieces': 1,
            'Stone 1: Rate Type': 'carat',
            'Stone 1: Rate Value': '',
            'Stone 1: Custom': 'FALSE',
            'Enamel Color': 'Red',
            'Enamel Weight (g)': 0.1,
            'Enamel Discount Type': 'none',
            'Enamel Discount Value': 0,
            'Discount Type': 'flat',
            'Discount Value': 0,
            'GST %': 3.0,
            'Current Price': '(Read-only)',
            'Last Synced': '2023-01-01'
        };
        const combinedData = [headers, note, sampleGold];
        // Use strict header order from constant
        const worksheet = xlsx.utils.json_to_sheet(combinedData, { header: PRODUCT_TEMPLATE_COLUMNS, skipHeader: true });
        // UX Improvement: Freeze panes (Header + 2 instructional rows = 3 rows total)
        worksheet['!freeze'] = { xSplit: 0, ySplit: 3 };
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Products Template');
        if (format === 'csv') {
            const csv = xlsx.utils.sheet_to_csv(worksheet);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="products-template.csv"');
            res.send(csv);
        }
        else {
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="products-template.xlsx"');
            res.send(buffer);
        }
    }
    catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});
// Export products
app.get('/api/products/export', async (req, res) => {
    try {
        const format = req.query.format;
        const shop = req.context.shop;
        if (!shop)
            return res.status(404).json({ error: 'Shop not found' });
        const products = await prisma.product.findMany({
            where: { shopId: shop.id },
            include: { gemstones: true },
            orderBy: { title: 'asc' },
        });
        const data = products.map(p => {
            const row = {};
            // Helper to safely set string value
            const set = (col, val) => row[col] = (val !== undefined && val !== null) ? val : '';
            // Identity
            set('SKU', p.sku);
            set('Title', p.title);
            set('Status', p.status);
            set('Collection', ''); // Read-only
            // Metal
            set('Metal Type', p.metal);
            set('Metal Purity', p.karat);
            set('Metal Weight (g)', p.weightGrams);
            set('Gross Weight (g)', p.grossGoldWeight);
            set('Wastage %', p.wastagePct);
            // Gemstones (Fixed slots 1-3)
            for (let i = 0; i < 3; i++) {
                const gem = p.gemstones && p.gemstones[i];
                const prefix = `Stone ${i + 1}`;
                set(`${prefix}: Used`, gem?.naturalOrLabgrown);
                set(`${prefix}: Type`, gem?.gemstoneType);
                set(`${prefix}: Shape`, gem?.shape);
                set(`${prefix}: Quality`, gem?.quality);
                set(`${prefix}: Color`, gem?.gemstoneColor);
                set(`${prefix}: Clarity`, gem?.gemstoneClarity);
                set(`${prefix}: Cut`, gem?.gemstoneCut);
                set(`${prefix}: Weight (ct)`, gem?.gemstoneWeight);
                set(`${prefix}: Pieces`, gem?.gemstonePieces);
                set(`${prefix}: Rate Type`, gem?.unitType);
                set(`${prefix}: Rate Value`, gem?.pricePerPiece);
                set(`${prefix}: Custom`, gem?.isCustom ? 'TRUE' : 'FALSE');
            }
            // Enamel
            set('Enamel Color', p.enamelColor);
            set('Enamel Weight (g)', p.enamelWeightGrams);
            set('Enamel Discount Type', p.enamelDiscountType);
            set('Enamel Discount Value', p.enamelDiscountValue);
            // Discounts & Tax
            set('Discount Type', p.discountType);
            set('Discount Value', p.discount);
            set('GST %', p.gstPct);
            // Making Charges
            set('Labour Type', p.makingChargeType);
            set('Labour Value', p.makingChargeValue);
            set('Labour From', p.labourFromWeight);
            set('Wastage From', p.wastageType);
            set('Wastage Value', p.wastageValue);
            // System
            set('Current Price', p.currentPrice);
            set('Last Synced', p.lastPushedAt ? new Date(p.lastPushedAt).toISOString().split('T')[0] : '');
            return row;
        });
        // Generate sheet using the CANONICAL schema for order
        const worksheet = xlsx.utils.json_to_sheet(data, { header: PRODUCT_TEMPLATE_COLUMNS });
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Products');
        if (format === 'csv') {
            const csv = xlsx.utils.sheet_to_csv(worksheet);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="products-export.csv"');
            res.send(csv);
        }
        else {
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="products-export.xlsx"');
            res.send(buffer);
        }
    }
    catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export products' });
    }
});
// Import products from CSV/Excel
app.post('/api/products/import', upload.single('file'), async (req, res) => {
    let rowIndex = 0;
    let currentRow = null;
    let normalizedRow = null;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Parse file
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // FLEXIBLE HEADER VALIDATION: Support both old and new column names
        // No longer enforce strict header matching - just check for SKU which is mandatory
        const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const actualHeaders = (rawRows[0] || []).map(h => String(h).trim());
        // STRICT CHECK: Duplicate columns (common issue with broken templates)
        const headerCounts = {};
        actualHeaders.forEach(h => {
            if (h)
                headerCounts[h] = (headerCounts[h] || 0) + 1;
        });
        const duplicates = Object.keys(headerCounts).filter(h => headerCounts[h] > 1);
        if (duplicates.length > 0) {
            throw new Error(`Import failed: Duplicate columns detected (${duplicates.join(', ')}). Please download a clean template and try again.`);
        }
        // Only check for SKU as mandatory - all other columns are optional for flexibility
        const hasSKU = actualHeaders.some(h => h === 'SKU' || h === 'sku' || h === 'Sku');
        if (!hasSKU) {
            throw new Error(`Header validation failed: SKU column is required. Received headers: ${JSON.stringify(actualHeaders)}`);
        }
        console.log(`✅ Import file validated. Found ${actualHeaders.length} columns.`);
        const rows = xlsx.utils.sheet_to_json(sheet);
        let updatedCount = 0;
        let errors = [];
        let firstDataRowProcessed = false;
        // Get metal rates once for lookup
        const metalRates = await prisma.metalRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
        });
        const settings = shop.settings || {
            defaultMakingPerGram: 1500,
            defaultWastagePct: 2,
            defaultGstPct: 3,
            defaultDiscount: 0,
        };
        // Helper for safe numeric conversion
        const toNum = (val) => {
            if (val === undefined || val === null || String(val).trim() === '')
                return null;
            const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
            return isNaN(n) ? null : n;
        };
        const toInt = (val) => {
            if (val === undefined || val === null || String(val).trim() === '')
                return null;
            const n = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
            return isNaN(n) ? null : n;
        };
        // Helper to get value from multiple possible column names (priority: first found)
        const getColumnValue = (row, ...keys) => {
            for (const key of keys) {
                if (row[key] !== undefined)
                    return row[key];
            }
            return undefined;
        };
        for (const row of rows) {
            rowIndex++;
            currentRow = row;
            const sku = row.sku || row.SKU || row.Sku;
            if (!sku)
                continue;
            // SAFETY CHECK: Skip instructional rows
            const skuStr = String(sku).trim();
            if (skuStr.startsWith('Example:') ||
                skuStr.startsWith('NOTE:') ||
                skuStr === 'SKU' ||
                skuStr.includes('(Read-only)') ||
                skuStr === '') {
                continue;
            }
            // PHASE 3: Required Field Assertions (First Data Row) - Support both old and new column names
            if (!firstDataRowProcessed) {
                const metal = getColumnValue(row, 'Metal Type', 'metal', 'Metal');
                const karat = getColumnValue(row, 'Metal Purity', 'karat', 'Karat');
                const weightGrams = getColumnValue(row, 'Metal Weight (g)', 'weightGrams', 'Weight (g)');
                if (!metal)
                    throw new Error(`PHASE 3: Missing required field "Metal Type" (or "Metal") in row ${rowIndex}`);
                if (karat === undefined || karat === null)
                    throw new Error(`PHASE 3: Missing required field "Metal Purity" (or "Karat") in row ${rowIndex}`);
                if (weightGrams === undefined || weightGrams === null)
                    throw new Error(`PHASE 3: Missing required field "Metal Weight (g)" (or "Weight (g)") in row ${rowIndex}`);
                const kVal = toInt(karat);
                if (kVal === null)
                    throw new Error(`PHASE 3: Invalid \"karat\" value \"${karat}\" in row ${rowIndex} (expected valid number)`);
                const wVal = toNum(weightGrams);
                if (wVal === null)
                    throw new Error(`PHASE 3: Invalid \"weightGrams\" value \"${weightGrams}\" in row ${rowIndex} (expected valid number)`);
                firstDataRowProcessed = true;
            }
            try {
                // Find product by SKU
                const product = await prisma.product.findFirst({ where: { shopId: shop.id, sku: skuStr } });
                if (!product) {
                    errors.push({ sku, error: 'Product not found' });
                    continue;
                }
                // Prepare update data
                const updateData = {};
                normalizedRow = updateData;
                // Numeric Normalization - Support unified template map (and legacy)
                const weightGrams = getColumnValue(row, 'Metal Weight (g)', 'weightGrams', 'Weight (g)');
                const grossWeight = getColumnValue(row, 'Gross Weight (g)', 'grossGoldWeight', 'Gross Weight');
                const metal = getColumnValue(row, 'Metal Type', 'metal', 'Metal');
                const karat = getColumnValue(row, 'Metal Purity', 'karat', 'Karat');
                const title = getColumnValue(row, 'Title', 'title');
                const wastagePct = getColumnValue(row, 'Wastage %', 'wastagePct', 'Wastage');
                const gstPct = getColumnValue(row, 'GST %', 'gstPct', 'GST');
                
                // Enamel
                const enamelColor = getColumnValue(row, 'Enamel Color', 'enamelColor');
                const enamelWeight = getColumnValue(row, 'Enamel Weight (g)', 'enamelWeightGrams');
                const enamelDiscType = getColumnValue(row, 'Enamel Discount Type', 'enamelDiscountType');
                const enamelDiscVal = getColumnValue(row, 'Enamel Discount Value', 'enamelDiscountValue');
                
                // Discount
                const discType = getColumnValue(row, 'Discount Type', 'discountType');
                const discVal = getColumnValue(row, 'Discount Value', 'discount');

                // Making Charges
                const labourType = getColumnValue(row, 'Labour Type', 'makingChargeType');
                const labourValue = getColumnValue(row, 'Labour Value', 'makingChargeValue');
                const labourFrom = getColumnValue(row, 'Labour From', 'labourFromWeight');
                const wastageFrom = getColumnValue(row, 'Wastage From', 'wastageType');
                const wastageValue = getColumnValue(row, 'Wastage Value', 'wastageValue');

                if (weightGrams !== undefined)
                    updateData.weightGrams = toNum(weightGrams);
                if (grossWeight !== undefined)
                    updateData.grossGoldWeight = toNum(grossWeight);
                if (metal !== undefined)
                    updateData.metal = String(metal).trim().toLowerCase();
                if (karat !== undefined)
                    updateData.karat = toInt(karat);
                if (title)
                    updateData.title = String(title).trim();
                if (wastagePct !== undefined)
                    updateData.wastagePct = toNum(wastagePct);
                if (gstPct !== undefined)
                    updateData.gstPct = toNum(gstPct);

                // Enamel Update
                if (enamelColor !== undefined)
                    updateData.enamelColor = String(enamelColor).trim();
                if (enamelWeight !== undefined)
                    updateData.enamelWeightGrams = toNum(enamelWeight);
                if (enamelDiscType !== undefined)
                    updateData.enamelDiscountType = String(enamelDiscType).trim();
                if (enamelDiscVal !== undefined)
                    updateData.enamelDiscountValue = toNum(enamelDiscVal);
                
                // Discount Update
                if (discType !== undefined)
                    updateData.discountType = String(discType).trim();
                if (discVal !== undefined)
                    updateData.discount = toNum(discVal);

                // Making charge handling
                if (labourType !== undefined)
                    updateData.makingChargeType = String(labourType).trim().toLowerCase();
                if (labourValue !== undefined)
                    updateData.makingChargeValue = toNum(labourValue);
                if (labourFrom !== undefined)
                    updateData.labourFromWeight = String(labourFrom).trim().toLowerCase();
                if (wastageFrom !== undefined)
                    updateData.wastageType = String(wastageFrom).trim().toLowerCase();
                if (wastageValue !== undefined)
                    updateData.wastageValue = toNum(wastageValue);
                // Gemstone fields (legacy support)
                if (row.gemstoneType !== undefined)
                    updateData.gemstoneType = row.gemstoneType;
                if (row.gemstoneCut !== undefined)
                    updateData.gemstoneCut = row.gemstoneCut;
                if (row.gemstoneColor !== undefined)
                    updateData.gemstoneColor = row.gemstoneColor;
                if (row.gemstoneClarity !== undefined)
                    updateData.gemstoneClarity = row.gemstoneClarity;
                if (row.gemstoneCaratRange !== undefined)
                    updateData.gemstoneCaratRange = row.gemstoneCaratRange;
                // Manual overrides
                if (row.manualGemstonePrice !== undefined) {
                    const price = toNum(row.manualGemstonePrice);
                    if (price !== null) {
                        updateData.manualGemstonePrice = price;
                        updateData.isManualGemstonePrice = true;
                    }
                }
                // Update product in DB
                const updatedProduct = await prisma.product.update({
                    where: { id: product.id },
                    data: updateData,
                    include: { shop: true }
                });
                // Handle gemstones (Expanded Columns + JSON Fallback)
                // Support both old (gemstone_1_type) and new (Stone 1: Type) column formats
                const hasOldColumns = Object.keys(row).some(k => k.startsWith('gemstone_') && k.endsWith('_type'));
                const hasNewColumns = Object.keys(row).some(k => k.includes('Stone ') && k.includes(': Type'));
                const hasJsonColumn = row.gemstones_json !== undefined;
                const reconstructedGemstones = [];
                // Try new column format first
                if (hasNewColumns) {
                    for (let i = 1; i <= 3; i++) {
                        const type = row[`Stone ${i}: Type`];
                        if (type && String(type).trim() !== '' && !String(type).startsWith('Example:')) {
                            reconstructedGemstones.push({
                                gemstoneType: String(type).trim(),
                                naturalOrLabgrown: row[`Stone ${i}: Used`] ? String(row[`Stone ${i}: Used`]).trim() : null,
                                quality: row[`Stone ${i}: Quality`] ? String(row[`Stone ${i}: Quality`]).trim() : null,
                                shape: row[`Stone ${i}: Shape`] ? String(row[`Stone ${i}: Shape`]).trim() : null,
                                gemstoneCut: row[`Stone ${i}: Cut`] ? String(row[`Stone ${i}: Cut`]).trim() : null,
                                gemstoneColor: row[`Stone ${i}: Color`] ? String(row[`Stone ${i}: Color`]).trim() : null,
                                gemstoneClarity: row[`Stone ${i}: Clarity`] ? String(row[`Stone ${i}: Clarity`]).trim() : null,
                                gemstoneWeight: toNum(row[`Stone ${i}: Weight (ct)`]),
                                gemstonePieces: toInt(row[`Stone ${i}: Pieces`]),
                                isCustom: row[`Stone ${i}: Custom`] === 'TRUE' || row[`Stone ${i}: Custom`] === true,
                                unitType: row[`Stone ${i}: Rate Type`] ? String(row[`Stone ${i}: Rate Type`]).trim() : 'carat',
                                pricePerPiece: toNum(row[`Stone ${i}: Rate Value`] || row[`Stone ${i}: Price/Piece`])
                            });
                        }
                    }
                }
                // Fallback to old column format
                else if (hasOldColumns) {
                    for (let i = 1; i <= 3; i++) {
                        const type = row[`gemstone_${i}_type`];
                        if (type && String(type).trim() !== '' && !String(type).startsWith('Example:')) {
                            reconstructedGemstones.push({
                                gemstoneType: String(type).trim(),
                                naturalOrLabgrown: row[`gemstone_${i}_naturalOrLabgrown`] ? String(row[`gemstone_${i}_naturalOrLabgrown`]).trim() : null,
                                quality: row[`gemstone_${i}_quality`] ? String(row[`gemstone_${i}_quality`]).trim() : null,
                                shape: row[`gemstone_${i}_shape`] ? String(row[`gemstone_${i}_shape`]).trim() : null,
                                gemstoneCut: row[`gemstone_${i}_cut`] ? String(row[`gemstone_${i}_cut`]).trim() : null,
                                gemstoneColor: row[`gemstone_${i}_color`] ? String(row[`gemstone_${i}_color`]).trim() : null,
                                gemstoneClarity: row[`gemstone_${i}_clarity`] ? String(row[`gemstone_${i}_clarity`]).trim() : null,
                                gemstoneWeight: toNum(row[`gemstone_${i}_weight`]),
                                gemstonePieces: toInt(row[`gemstone_${i}_pieces`]),
                                isCustom: row[`gemstone_${i}_isCustom`] === 'TRUE' || row[`gemstone_${i}_isCustom`] === true,
                                pricePerPiece: toNum(row[`gemstone_${i}_pricePerPiece`])
                            });
                        }
                    }
                }
                // Resolve final gemstones array
                let finalGemstones = reconstructedGemstones;
                // If NOT using expanded columns OR expanded were empty, check gemstones_json (backward compatibility)
                if (!hasNewColumns && !hasOldColumns || reconstructedGemstones.length === 0) {
                    if (row.gemstones_json && String(row.gemstones_json).trim() !== '' && !String(row.gemstones_json).startsWith('(Optional')) {
                        try {
                            const parsed = JSON.parse(row.gemstones_json);
                            if (Array.isArray(parsed)) {
                                finalGemstones = parsed;
                            }
                        }
                        catch (e) {
                            // Silently ignore JSON parse errors for backward compatibility
                        }
                    }
                }
                // Gating: Only update gemstones if at least one gemstone column was present
                const shouldUpdateGemstones = hasNewColumns || hasOldColumns || hasJsonColumn;
                if (shouldUpdateGemstones && !Array.isArray(finalGemstones)) {
                    throw new Error(`PHASE 4: finalGemstones is not an array for SKU ${skuStr}`);
                }
                // 3. Process the resolved gemstones
                if (shouldUpdateGemstones && finalGemstones && Array.isArray(finalGemstones)) {
                    // Delete existing gemstones
                    await prisma.productGemstone.deleteMany({ where: { productId: product.id } });
                    // Clear legacy gemstone fields on the product itself
                    await prisma.product.update({
                        where: { id: product.id },
                        data: {
                            gemstoneType: null,
                            gemstoneCut: null,
                            gemstoneColor: null,
                            gemstoneClarity: null,
                            gemstoneCaratRange: null,
                            stoneWeightCarat: null,
                            stonePieces: null,
                            isManualGemstonePrice: false,
                            manualGemstonePrice: null,
                            manualGemstoneWeight: null,
                        },
                    });
                    // Create new gemstones
                    for (const gem of finalGemstones) {
                        if (!gem.gemstoneType)
                            continue; // Skip if no type
                        await prisma.productGemstone.create({
                            data: {
                                productId: product.id,
                                gemstoneType: gem.gemstoneType,
                                gemstoneCut: gem.gemstoneCut || null,
                                gemstoneColor: gem.gemstoneColor || null,
                                gemstoneClarity: gem.gemstoneClarity || null,
                                gemstoneCaratRange: gem.gemstoneCaratRange || null,
                                gemstoneWeight: toNum(gem.gemstoneWeight),
                                gemstonePieces: toInt(gem.gemstonePieces),
                                discountType: gem.discountType || null,
                                discountValue: toNum(gem.discountValue),
                            }
                        });
                    }
                }
                // Re-fetch product with gemstones for price calculation
                const productWithGemstones = await prisma.product.findUnique({
                    where: { id: product.id },
                    include: { gemstones: true, shop: true },
                });
                if (productWithGemstones && productWithGemstones.weightGrams && productWithGemstones.metal) {
                    const rate = metalRates.find(r => r.metal === productWithGemstones.metal &&
                        (productWithGemstones.karat ? r.karat === productWithGemstones.karat : true));
                    if (rate) {
                        // Get stone rate ONLY for legacy single gemstone support
                        let stoneRate = null;
                        if (!(productWithGemstones.gemstones && productWithGemstones.gemstones.length > 0) && productWithGemstones.gemstoneType && !productWithGemstones.isManualGemstonePrice) {
                            stoneRate = await prisma.stoneRate.findFirst({
                                where: {
                                    shopId: shop.id,
                                    stoneType: productWithGemstones.gemstoneType,
                                    cut: productWithGemstones.gemstoneCut || null,
                                    color: productWithGemstones.gemstoneColor || null,
                                    clarity: productWithGemstones.gemstoneClarity || null,
                                    caratRange: productWithGemstones.gemstoneCaratRange || null
                                },
                                orderBy: { updatedAt: 'desc' }
                            });
                        }
                        const oldPrice = productWithGemstones.currentPrice || 0;
                        // FIX BUG-09: Lookup enamel rate before price calculation
                        let enamelRate = null;
                        if (productWithGemstones.enamelColor) {
                            enamelRate = await prisma.enamelRate.findFirst({
                                where: {
                                    shopId: shop.id,
                                    enamelColor: productWithGemstones.enamelColor
                                }
                            });
                        }
                        const { price: newPrice, breakdown } = await pricing_service_1.PricingService.calculateProductPrice(productWithGemstones, rate.ratePerGram, stoneRate, settings, enamelRate);
                        const breakdownHtml = generateBreakdownHtml(breakdown);
                        // Update DB Price and breakdown along with History in a transaction
                        await prisma.$transaction(async (tx) => {
                            await tx.product.update({
                                where: { id: product.id },
                                data: {
                                    currentPrice: newPrice,
                                    priceBreakdownHtml: breakdownHtml
                                }
                            });
                            await tx.priceHistory.create({
                                data: {
                                    productId: product.id,
                                    oldPrice: oldPrice,
                                    newPrice: newPrice,
                                    status: 'success',
                                    triggeredBy: 'bulk_import'
                                }
                            });
                        });
                        // Push to Shopify (async sync)
                        const shopifyResult = await pushToShopify(shop.domain, shop.accessToken || SHOPIFY_ACCESS_TOKEN, productWithGemstones, newPrice, breakdown);
                        // FIX BUG-11: Update existing history record status instead of creating duplicate
                        if (!shopifyResult.success) {
                            // Find the success record we just created in the transaction above and update it
                            const latestHistory = await prisma.priceHistory.findFirst({
                                where: { productId: product.id, triggeredBy: 'bulk_import', status: 'success' },
                                orderBy: { pushedAt: 'desc' }
                            });
                            if (latestHistory) {
                                await prisma.priceHistory.update({
                                    where: { id: latestHistory.id },
                                    data: {
                                        status: 'failed',
                                        errorMessage: `Shopify sync failed: ${shopifyResult.error}`
                                    }
                                });
                            }
                        }
                    }
                }
                // Log Audit
                await logAudit(shop.id, 'bulk_import', 'product', product.id, { oldValue: {}, newValue: updateData }, 'Bulk Import via File');
                updatedCount++;
            }
            catch (rowError) {
                console.error(`❌ [DIAGNOSTIC] Row ${rowIndex} individual error for SKU ${skuStr}:`, rowError);
                errors.push({ sku: skuStr, error: rowError.message });
                // FIX BUG-16: Removed 'throw rowError' — one bad row should NOT abort the entire import.
                // Errors are collected and returned in the response.
            }
        }
        res.json({ success: true, updatedCount, errors });
    }
    catch (masterError) {
        // PHASE 1: HARD FAIL WITH EXPLICIT ERROR
        console.error('🛑 [FORENSIC HARD FAIL] Master Error Stack:', masterError.stack);
        console.error('🛑 [FORENSIC HARD FAIL] At Row Index:', rowIndex);
        console.error('🛑 [FORENSIC HARD FAIL] Raw Row:', JSON.stringify(currentRow, null, 2));
        console.error('🛑 [FORENSIC HARD FAIL] Normalized Row:', JSON.stringify(normalizedRow, null, 2));
        res.status(500).json({
            success: false,
            error: {
                message: masterError.message,
                row: rowIndex,
                stack: masterError.stack
            }
        });
    }
});
// Update product
// Update product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { weightGrams, metal, karat, gemstoneType, gemstoneCut, gemstoneColor, gemstoneClarity, gemstoneCaratRange, stonePieces, stoneWeightCarat, gemstoneOverridePricePerPiece, gemstoneOverridePieces, gemstoneOverrideColor, grossGoldWeight, autoGrossGoldWeight } = req.body;
        forensicLog(`\n--- [FORENSIC ENDPOINT TRACE] Update attempt for product ${id} ---`);
        const existingProduct = await prisma.product.findUnique({
            where: { id },
            include: { gemstones: true }
        });
        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const shop = await prisma.shop.findUnique({
            where: { id: existingProduct.shopId },
            include: { settings: true }
        });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const oldPrice = existingProduct.currentPrice;
        // 2. Update product metadata (non-price fields) first
        // This is necessary because some fields affect the calculation
        const product = await prisma.product.update({
            where: { id },
            data: {
                weightGrams: weightGrams ? parseFloat(weightGrams) : null,
                metal: metal || null,
                karat: karat ? parseInt(karat) : null,
                gemstoneType: gemstoneType || null,
                gemstoneCut: gemstoneCut || null,
                gemstoneColor: gemstoneColor || null,
                gemstoneClarity: gemstoneClarity || null,
                gemstoneCaratRange: gemstoneCaratRange || null,
                stonePieces: stonePieces ? parseInt(stonePieces) : null,
                stoneWeightCarat: stoneWeightCarat ? parseFloat(stoneWeightCarat) : null,
                isManualGemstonePrice: req.body.isManualGemstonePrice || false,
                manualGemstoneWeight: req.body.manualGemstoneWeight ? parseFloat(req.body.manualGemstoneWeight) : null,
                manualGemstonePrice: req.body.manualGemstonePrice ? parseFloat(req.body.manualGemstonePrice) : null,
                makingChargeType: req.body.makingChargeType || null,
                makingChargeValue: req.body.makingChargeValue !== undefined ? parseFloat(req.body.makingChargeValue) : null,
                labourFromWeight: req.body.labourFromWeight || 'net',
                wastageType: req.body.wastageType || null,
                wastageValue: req.body.wastageValue !== undefined ? parseFloat(req.body.wastageValue) : null,
                metalDiscountType: req.body.metalDiscountType || null,
                metalDiscountValue: req.body.metalDiscountValue !== undefined ? parseFloat(req.body.metalDiscountValue) : null,
                makingDiscountType: req.body.makingDiscountType || null,
                makingDiscountValue: req.body.makingDiscountValue !== undefined ? parseFloat(req.body.makingDiscountValue) : null,
                gemstoneDiscountValue: req.body.gemstoneDiscountValue !== undefined ? parseFloat(req.body.gemstoneDiscountValue) : null,
                gemstoneOverridePricePerPiece: req.body.gemstoneOverridePricePerPiece !== undefined ? parseFloat(req.body.gemstoneOverridePricePerPiece) : null,
                gemstoneOverridePieces: req.body.gemstoneOverridePieces !== undefined ? parseInt(req.body.gemstoneOverridePieces) : null,
                gemstoneOverrideColor: req.body.gemstoneOverrideColor || null,
                grossGoldWeight: req.body.grossGoldWeight !== undefined ? parseFloat(req.body.grossGoldWeight) : null,
                autoGrossGoldWeight: req.body.autoGrossGoldWeight === true || req.body.autoGrossGoldWeight === 'true',
                discount: req.body.discount !== undefined ? parseFloat(req.body.discount) : undefined,
                discountType: req.body.discountType || undefined,
                makingGroupId: req.body.makingGroupId || null,
            },
            include: {
                shop: { include: { settings: true } },
                makingGroup: true,
            }
        });
        // 3. Handle gemstones separately if provided
        if (req.body.gemstones !== undefined) {
            await prisma.productGemstone.deleteMany({ where: { productId: id } });
            await prisma.product.update({
                where: { id },
                data: {
                    gemstoneType: null, gemstoneCut: null, gemstoneColor: null, gemstoneClarity: null,
                    gemstoneCaratRange: null, stoneWeightCarat: null, stonePieces: null,
                    isManualGemstonePrice: false, manualGemstonePrice: null, manualGemstoneWeight: null,
                },
            });
            if (Array.isArray(req.body.gemstones) && req.body.gemstones.length > 0) {
                await prisma.productGemstone.createMany({
                    data: req.body.gemstones.map((gem) => ({
                        productId: id,
                        gemstoneType: gem.gemstoneType,
                        gemstoneCut: gem.gemstoneCut || null,
                        gemstoneColor: gem.gemstoneColor || null,
                        gemstoneClarity: gem.gemstoneClarity || null,
                        gemstoneCaratRange: gem.gemstoneCaratRange || null,
                        gemstoneWeight: gem.gemstoneWeight || null,
                        gemstonePieces: gem.gemstonePieces || null,
                        isCustom: gem.isCustom === true || gem.isCustom === 'true',
                        pricePerPiece: gem.pricePerPiece !== undefined ? parseFloat(gem.pricePerPiece) : null,
                        discountType: gem.discountType || null,
                        discountValue: gem.discountValue || null,
                    })),
                });
            }
        }
        // 4. Re-calculate price based on new parameters
        const productWithGemstones = await prisma.product.findUnique({
            where: { id },
            include: { gemstones: true, makingGroup: true },
        });
        forensicLog(`   Step 1: WeightGrams=${productWithGemstones?.weightGrams}, Metal=${productWithGemstones?.metal}`);
        let newPrice = oldPrice;
        let breakdown = null;
        if (productWithGemstones && productWithGemstones.weightGrams && productWithGemstones.metal) {
            const metalRate = await prisma.metalRate.findFirst({
                where: { shopId: shop.id, metal: productWithGemstones.metal, karat: productWithGemstones.karat || null },
                orderBy: { updatedAt: 'desc' },
            });
            if (metalRate) {
                forensicLog(`   Step 2: MetalRate found! Rate=${metalRate.ratePerGram}`);
                const settings = shop.settings || {
                    defaultMakingChargeType: 'per_gram', defaultMakingChargeValue: 1500,
                    defaultWastagePct: 2, defaultGstPct: 3, defaultDiscount: 0
                };
                let stoneRate = null;
                if (!(productWithGemstones.gemstones?.length > 0) && productWithGemstones.gemstoneType && !req.body.isManualGemstonePrice) {
                    stoneRate = await prisma.stoneRate.findFirst({
                        where: {
                            shopId: shop.id,
                            stoneType: productWithGemstones.gemstoneType,
                            cut: productWithGemstones.gemstoneCut || null,
                            color: productWithGemstones.gemstoneColor || null,
                            clarity: productWithGemstones.gemstoneClarity || null,
                            caratRange: productWithGemstones.gemstoneCaratRange || null
                        },
                        orderBy: { updatedAt: 'desc' }
                    });
                }
                // FIX BUG-09: Lookup enamel rate before price calculation
                let enamelRate = null;
                if (productWithGemstones.enamelColor) {
                    enamelRate = await prisma.enamelRate.findFirst({
                        where: {
                            shopId: shop.id,
                            enamelColor: productWithGemstones.enamelColor
                        }
                    });
                }
                const result = await pricing_service_1.PricingService.calculateProductPrice(productWithGemstones, metalRate.ratePerGram, stoneRate, settings, enamelRate);
                newPrice = result.price;
                breakdown = result.breakdown;
                // 5. Atomic Update and History Creation
                // We use a transaction to ensure either BOTH succeed or BOTH fail.
                await prisma.$transaction(async (tx) => {
                    await tx.product.update({
                        where: { id },
                        data: {
                            currentPrice: newPrice,
                            priceBreakdownHtml: generateBreakdownHtml(breakdown)
                        },
                    });
                    // Only create history if we have valid old and new prices
                    if (oldPrice !== undefined && newPrice !== undefined) {
                        await tx.priceHistory.create({
                            data: {
                                productId: id,
                                oldPrice: oldPrice,
                                newPrice: newPrice,
                                status: 'success',
                                triggeredBy: 'manual_update'
                            }
                        });
                    }
                });
                console.log(`✅ Calculated and logged price for ${product.sku}: ₹${newPrice.toFixed(2)}`);
                // 6. Push to Shopify (Async Sync)
                // Objective 1: Resolve shop domain dynamically
                const shopDomain = res.locals.shopify?.session?.shop || shop.domain;
                const dbShop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
                const accessToken = dbShop?.accessToken || SHOPIFY_ACCESS_TOKEN;
                // FIX BUG-12: Removed extra 'oldPrice' arg — pushToShopify only accepts 5 params
                const shopifyResult = await pushToShopify(shopDomain, accessToken, product, newPrice, breakdown);
                if (!shopifyResult.success) {
                    await prisma.priceHistory.create({
                        data: {
                            productId: id,
                            oldPrice: oldPrice,
                            newPrice: newPrice,
                            status: 'failed',
                            errorMessage: `Shopify sync failed: ${shopifyResult.error}`,
                            triggeredBy: 'manual_update'
                        }
                    });
                    // Objective 3: Surface Shopify sync errors to UI
                    return res.status(500).json({
                        success: false,
                        error: shopifyResult.error,
                        message: `Shopify sync failed: ${shopifyResult.error}`
                    });
                }
                res.json({
                    success: true,
                    product: { ...product, currentPrice: newPrice },
                    syncStatus: 'synced'
                });
            }
            else {
                res.json({ success: true, product, message: 'Metal rate missing, price not updated' });
            }
        }
        else {
            res.json({ success: true, product });
        }
    }
    catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});
// Calculate price (preview) without saving
app.post('/api/products/calculate-price', async (req, res) => {
    try {
        const { weightGrams, metal, karat, gemstoneType, gemstoneCut, gemstoneColor, gemstoneClarity, gemstoneCaratRange, stonePieces, stoneWeightCarat, isManualGemstonePrice, manualGemstoneWeight, manualGemstonePrice, makingChargeType, makingChargeValue, metalDiscountType, metalDiscountValue, makingDiscountType, makingDiscountValue, gemstoneDiscountType, gemstoneDiscountValue, discount, // NEW: Extract discount for per-product discount support
            discountType, // NEW: Phase B
            enamelColor, enamelWeightGrams, enamelDiscountType, enamelDiscountValue, gemstones, makingGroupId } = req.body;
        const shop = req.context.shop;
        // Build temporary product object for calculation
        const tempProduct = {
            shopId: shop.id,
            weightGrams: weightGrams ? parseFloat(weightGrams) : 0,
            metal: metal || null,
            karat: karat ? parseInt(karat) : null,
            gemstoneType: gemstoneType || null,
            gemstoneCut: gemstoneCut || null,
            gemstoneColor: gemstoneColor || null,
            gemstoneClarity: gemstoneClarity || null,
            gemstoneCaratRange: gemstoneCaratRange || null,
            stonePieces: stonePieces ? parseInt(stonePieces) : null,
            stoneWeightCarat: stoneWeightCarat ? parseFloat(stoneWeightCarat) : null,
            isManualGemstonePrice: isManualGemstonePrice || false,
            manualGemstoneWeight: manualGemstoneWeight ? parseFloat(manualGemstoneWeight) : 0,
            manualGemstonePrice: manualGemstonePrice ? parseFloat(manualGemstonePrice) : 0,
            makingChargeType: makingChargeType || null,
            makingChargeValue: (makingChargeValue !== undefined && makingChargeValue !== null && makingChargeValue !== '')
                ? parseFloat(makingChargeValue)
                : null,
            metalDiscountType: metalDiscountType || null,
            metalDiscountValue: metalDiscountValue ? parseFloat(metalDiscountValue) : null,
            makingDiscountType: makingDiscountType || null,
            makingDiscountValue: makingDiscountValue ? parseFloat(makingDiscountValue) : null,
            gemstoneDiscountType: gemstoneDiscountType || null,
            gemstoneDiscountValue: gemstoneDiscountValue ? parseFloat(gemstoneDiscountValue) : null,
            discount: discount ? parseFloat(discount) : 0, // NEW: Include per-product discount
            discountType: discountType || 'flat', // NEW: Phase B
            enamelColor: enamelColor || null,
            enamelWeightGrams: enamelWeightGrams ? parseFloat(enamelWeightGrams) : null,
            enamelDiscountType: enamelDiscountType || null,
            enamelDiscountValue: enamelDiscountValue ? parseFloat(enamelDiscountValue) : null,
            gemstones: gemstones || [],
            gemstoneOverrideColor: req.body.gemstoneOverrideColor || null,
            grossGoldWeight: req.body.grossGoldWeight !== undefined ? parseFloat(req.body.grossGoldWeight) : null,
            autoGrossGoldWeight: req.body.autoGrossGoldWeight === true || req.body.autoGrossGoldWeight === 'true',
        };
        // Fetch Making Group if provided
        if (makingGroupId) {
            const makingGroup = await prisma.makingGroup.findUnique({
                where: { id: makingGroupId }
            });
            if (makingGroup) {
                tempProduct.makingGroup = makingGroup;
                // Don't need to manually set type/value here, calculateProductPrice handles product.makingGroup priority
            }
        }
        if (!tempProduct.weightGrams || !tempProduct.metal) {
            return res.json({ breakdown: null });
        }
        const metalRate = await prisma.metalRate.findFirst({
            where: {
                shopId: shop.id,
                metal: tempProduct.metal,
                karat: tempProduct.karat || null,
            },
            orderBy: { updatedAt: 'desc' },
        });
        if (!metalRate) {
            return res.json({ breakdown: null, error: 'Rate not found' });
        }
        const settings = shop.settings || {
            defaultMakingChargeType: 'per_gram',
            defaultMakingChargeValue: 1500,
            defaultWastagePct: 2,
            defaultGstPct: 3,
            defaultDiscount: 0,
        };
        let stoneRate = null;
        if (tempProduct.gemstoneType && !tempProduct.isManualGemstonePrice) {
            stoneRate = await prisma.stoneRate.findFirst({
                where: {
                    shopId: shop.id,
                    stoneType: tempProduct.gemstoneType,
                    cut: tempProduct.gemstoneCut || null,
                    color: tempProduct.gemstoneColor || null,
                    clarity: tempProduct.gemstoneClarity || null,
                    caratRange: tempProduct.gemstoneCaratRange || null
                },
                orderBy: { updatedAt: 'desc' }
            });
        }
        const { breakdown } = await pricing_service_1.PricingService.calculateProductPrice(tempProduct, metalRate.ratePerGram, stoneRate, settings);
        res.json({ breakdown });
    }
    catch (error) {
        console.error('Calculation error:', error);
        res.status(500).json({ error: 'Failed to calculate price' });
    }
});
app.get('/api/products/:id/price-breakdown', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product || !product.weightGrams || !product.metal) {
            return res.status(400).json({ error: 'Product must have weight and metal set' });
        }
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const metalRate = await prisma.metalRate.findFirst({
            where: { shopId: shop.id, metal: product.metal, karat: product.karat || null },
            orderBy: { updatedAt: 'desc' },
        });
        if (!metalRate) {
            return res.status(404).json({ error: 'Metal rate not found' });
        }
        const settings = shop.settings || {
            defaultMakingChargeType: 'per_gram',
            defaultMakingChargeValue: 1500,
            defaultWastagePct: 2,
            defaultGstPct: 3,
            defaultDiscount: 0,
        };
        let stoneRate = null;
        if (product.gemstoneType && !product.isManualGemstonePrice) {
            stoneRate = await prisma.stoneRate.findFirst({
                where: {
                    shopId: shop.id,
                    stoneType: product.gemstoneType,
                    cut: product.gemstoneCut || null,
                    color: product.gemstoneColor || null,
                    clarity: product.gemstoneClarity || null,
                    caratRange: product.gemstoneCaratRange || null
                },
                orderBy: { updatedAt: 'desc' }
            });
        }
        const { breakdown } = await pricing_service_1.PricingService.calculateProductPrice(product, metalRate.ratePerGram, stoneRate, settings);
        res.json({ breakdown });
    }
    catch (error) {
        console.error('Error calculating price breakdown:', error);
        res.status(500).json({ error: 'Failed to calculate price breakdown' });
    }
});
// Get settings
app.get('/api/settings', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        res.json({ shop, settings: shop.settings });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
// Update settings
app.put('/api/settings', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // FIX BUG-19: Whitelist allowed fields to prevent mass assignment vulnerability
        const allowedFields = [
            'defaultMakingChargeType', 'defaultMakingChargeValue',
            'defaultWastagePct', 'defaultGstPct', 'defaultDiscount',
            'defaultDiscountType', 'defaultMetalDiscountType', 'defaultMetalDiscountValue',
            'defaultMakingDiscountType', 'defaultMakingDiscountValue',
            'defaultGemstoneDiscountType', 'defaultGemstoneDiscountValue',
            'autoSyncEnabled', 'syncIntervalMinutes'
        ];
        const sanitizedData = {};
        for (const key of allowedFields) {
            if (req.body[key] !== undefined) {
                sanitizedData[key] = req.body[key];
            }
        }
        const settings = await prisma.shopSettings.upsert({
            where: { shopId: shop.id },
            update: sanitizedData,
            create: { ...sanitizedData, shopId: shop.id }
        });
        res.json({ success: true, settings });
    }
    catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});
// Apply settings to all products
app.post('/api/settings/apply-to-all', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop || !shop.settings) {
            return res.status(404).json({ error: 'Shop or settings not found' });
        }
        const settings = shop.settings;
        // Get all products with weight and metal
        const products = await prisma.product.findMany({
            where: {
                shopId: shop.id,
                weightGrams: { not: null },
                metal: { not: null }
            },
            include: { gemstones: true, makingGroup: true }
        });
        console.log(`\n🔄 Applying settings to ${products.length} products...`);
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        // Get all metal rates for lookup
        const metalRates = await prisma.metalRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' }
        });
        // ─── OPTIMISED: process 5 products concurrently instead of 1-by-1 ───
        const BATCH_SIZE = 5;
        const processSingleProduct = async (product) => {
            try {
                // Find appropriate metal rate
                const metalRate = metalRates.find(r => r.metal === product.metal &&
                    (product.karat ? r.karat === product.karat : true));
                if (!metalRate) {
                    errors.push({ sku: product.sku, error: 'No metal rate found' });
                    errorCount++;
                    return;
                }
                // Get stone rate if needed (legacy support)
                let stoneRate = null;
                if (product.gemstones && product.gemstones.length > 0) {
                    stoneRate = null;
                }
                else if (product.gemstoneType && !product.isManualGemstonePrice) {
                    stoneRate = await prisma.stoneRate.findFirst({
                        where: {
                            shopId: shop.id,
                            stoneType: product.gemstoneType,
                            cut: product.gemstoneCut || null,
                            color: product.gemstoneColor || null,
                            clarity: product.gemstoneClarity || null,
                            caratRange: product.gemstoneCaratRange || null
                        },
                        orderBy: { updatedAt: 'desc' }
                    });
                }
                // Calculate new price
                const oldPrice = product.currentPrice || 0;
                const { price: newPrice, breakdown } = await pricing_service_1.PricingService.calculateProductPrice(product, metalRate.ratePerGram, stoneRate, settings);
                // Generate breakdown HTML
                const breakdownHtml = generateBreakdownHtml(breakdown);
                // Update product and history in a transaction
                await prisma.$transaction(async (tx) => {
                    await tx.product.update({
                        where: { id: product.id },
                        data: {
                            currentPrice: newPrice,
                            priceBreakdownHtml: breakdownHtml
                        }
                    });
                    await tx.priceHistory.create({
                        data: {
                            productId: product.id,
                            oldPrice: oldPrice,
                            newPrice: newPrice,
                            status: 'success',
                            triggeredBy: 'settings_apply_all'
                        }
                    });
                });
                // Push to Shopify
                const shopifyResult = await pushToShopify(shop.domain, shop.accessToken || SHOPIFY_ACCESS_TOKEN, product, newPrice, breakdown);
                if (!shopifyResult.success) {
                    await prisma.priceHistory.create({
                        data: {
                            productId: product.id,
                            oldPrice: oldPrice,
                            newPrice: newPrice,
                            status: 'failed',
                            errorMessage: `Shopify sync failed: ${shopifyResult.error}`,
                            triggeredBy: 'settings_apply_all'
                        }
                    });
                }
                successCount++;
            }
            catch (error) {
                console.error(`   Error: ${product.sku}:`, error.message);
                errors.push({ sku: product.sku, error: error.message });
                errorCount++;
            }
        };

        // Process in batches of BATCH_SIZE concurrently
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const batch = products.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(processSingleProduct));
            console.log(`   ⚡ Progress: ${Math.min(i + BATCH_SIZE, products.length)}/${products.length}`);
        }

        console.log(`✅ Applied to ${successCount} products`);
        res.json({
            success: true,
            totalProducts: products.length,
            successCount,
            errorCount,
            errors: errors.slice(0, 10)
        });
    }
    catch (error) {
        console.error('Error applying settings:', error);
        res.status(500).json({ error: 'Failed to apply settings' });
    }
});
// Root
app.get('/', (req, res) => {
    res.json({
        message: 'Metal & Gem Price Editor API',
        status: 'running',
        shop: SHOPIFY_STORE,
    });
});
// FIX BUG-20: Duplicate health check removed — already defined at line 331
// ===== BULK OPERATIONS =====
// Trigger bulk price update
app.post('/api/bulk/trigger-price-update', async (req, res) => {
    try {
        const shop = req.context.shop;
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { metal, karat } = req.body;
        const jobId = await bulkPriceUpdate_service_1.BulkPriceUpdateService.triggerUpdate({
            shopId: shop.id,
            metal,
            karat,
            triggeredBy: 'manual',
        });
        res.json({
            success: true,
            jobId,
            message: 'Price update queued. Check job status for progress.',
        });
    }
    catch (error) {
        console.error('Error triggering bulk update:', error);
        res.status(500).json({ error: 'Failed to trigger bulk update' });
    }
});
// Get job status
app.get('/api/bulk/job-status/:jobId', async (req, res) => {
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
// Get active jobs
app.get('/api/bulk/active-jobs', async (req, res) => {
    try {
        const shop = req.context.shop;
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
// Get recent jobs
app.get('/api/bulk/recent-jobs', async (req, res) => {
    try {
        const shop = req.context.shop;
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
// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// Initialize Shop for Desktop Mode
const initializeShop = async () => {
    try {
        console.log('Initializing shop data...');
        const shop = await prisma.shop.upsert({
            where: { domain: SHOPIFY_STORE },
            update: {
                accessToken: SHOPIFY_ACCESS_TOKEN,
                isActive: true,
                scope: process.env.SCOPES || 'read_products,write_products'
            },
            create: {
                domain: SHOPIFY_STORE,
                accessToken: SHOPIFY_ACCESS_TOKEN,
                scope: process.env.SCOPES || 'read_products,write_products',
                isActive: true,
                installedAt: new Date()
            }
        });
        // Ensure Settings exist
        await prisma.shopSettings.upsert({
            where: { shopId: shop.id },
            update: {},
            create: {
                shopId: shop.id,
                rateSource: 'manual',
                defaultMakingChargeType: 'per_gram',
                defaultMakingChargeValue: 1500,
                defaultWastagePct: 2,
                defaultGstPct: 3,
                defaultDiscount: 0
            }
        });
        console.log('✅ Shop data initialized for:', SHOPIFY_STORE);
        if (IS_DESKTOP_MODE) {
            console.log('💡 TIP: Set metal rates in the Rates page to get started');
        }
    }
    catch (error) {
        console.error('Failed to initialize shop:', error);
        throw error; // Re-throw to prevent server from starting with bad DB
    }
};
// Start
app.listen(PORT, async () => {
    await initializeShop();
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Connected to: ${SHOPIFY_STORE}`);
    console.log(`✅ Ready for manual price entry!`);
});
//# sourceMappingURL=server-simple.js.map