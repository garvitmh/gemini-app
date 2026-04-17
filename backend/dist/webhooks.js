"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebhooks = setupWebhooks;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function setupWebhooks(shopify) {
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
//# sourceMappingURL=webhooks.js.map