// @ts-nocheck
import { ShopifyApp } from '@shopify/shopify-app-express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function setupWebhooks(shopify: ShopifyApp) {
    // App uninstalled webhook
    shopify.webhooks.addHandlers({
        APP_UNINSTALLED: {
            deliveryMethod: 'http',
            callbackUrl: '/api/webhooks',
            callback: async (topic, shop, body, webhookId) => {
                console.log(`App uninstalled from ${shop}`);

                // Mark shop as inactive
                await prisma.shop.update({
                    where: { domain: shop },
                    data: {
                        isActive: false,
                        uninstalledAt: new Date(),
                    },
                });
            },
        },
        PRODUCTS_UPDATE: {
            deliveryMethod: 'http',
            callbackUrl: '/api/webhooks',
            callback: async (topic, shop, body, webhookId) => {
                console.log(`Product updated in ${shop}`);
                // Handle product updates if needed
            },
        },
    });
}
