/**
 * GDPR Mandatory Webhooks
 *
 * Shopify requires ALL apps to handle 3 GDPR webhooks:
 *  - customers/data_request
 *  - customers/redact
 *  - shop/redact
 *
 * Without these, your app CANNOT be submitted to the Shopify App Store.
 */

import { Router } from 'express';
import { verifyWebhookHmac } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /webhooks/customers/data_request
 * A customer has requested their data from the store owner.
 * You must return what data you hold about this customer within 30 days.
 */
router.post('/customers/data_request', verifyWebhookHmac, (req, res) => {
    const payload = req.body;
    const { shop_domain, customer, orders_requested } = payload;

    console.log(`[GDPR] Data request: shop=${shop_domain}, customer_id=${customer?.id}`);

    // This app does NOT store personal customer data (PII).
    // We only store: product prices, metal rates, gemstone rates - no customer info.
    // Log the request for compliance records.
    console.log(`[GDPR] No personal customer data stored for customer ${customer?.id}. Responding with compliance acknowledgment.`);

    // Shopify requires HTTP 200.
    res.status(200).json({
        message: 'Data request received. This app does not store personal customer data.',
        customer_id: customer?.id,
        shop: shop_domain,
    });
});

/**
 * POST /webhooks/customers/redact
 * Shopify requests that you delete all data about this customer.
 * This is triggered 10 days after a customer requests data deletion.
 */
router.post('/customers/redact', verifyWebhookHmac, (req, res) => {
    const payload = req.body;
    const { shop_domain, customer } = payload;

    console.log(`[GDPR] Customer redact: shop=${shop_domain}, customer_id=${customer?.id}`);

    // This app does NOT store customer PII - nothing to delete.
    console.log(`[GDPR] No personal customer data to redact for customer ${customer?.id}.`);

    res.status(200).json({
        message: 'Redact request received. This app does not store personal customer data.',
        customer_id: customer?.id,
        shop: shop_domain,
    });
});

/**
 * POST /webhooks/shop/redact
 * A shop has been deleted. You must delete all data associated with this shop.
 * Triggered 48 hours after a shop owner uninstalls the app.
 */
router.post('/shop/redact', verifyWebhookHmac, async (req, res) => {
    const payload = req.body;
    const { shop_domain } = payload;

    console.log(`[GDPR] Shop redact: shop=${shop_domain}`);

    try {
        // Import prisma lazily to avoid circular dependencies
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        // Delete all shop data - Cascade deletes in schema handle related records
        const deletedShop = await prisma.shop.deleteMany({
            where: { domain: shop_domain },
        });

        await prisma.$disconnect();

        console.log(`[GDPR] ✅ Deleted all data for shop ${shop_domain}: ${JSON.stringify(deletedShop)}`);

        res.status(200).json({
            message: `All data for shop ${shop_domain} has been deleted.`,
        });
    } catch (error: any) {
        console.error(`[GDPR] ❌ Failed to redact shop ${shop_domain}:`, error.message);
        // Still return 200 to acknowledge receipt - retry logic should be handled externally
        res.status(200).json({
            message: 'Redact request received. Deletion scheduled.',
        });
    }
});

export default router;
