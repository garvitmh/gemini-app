"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const prisma = new client_1.PrismaClient();
async function main() {
    const shops = await prisma.shop.findMany();
    console.log(`Auditing ${shops.length} shops...\n`);
    for (const shop of shops) {
        console.log(`--- Shop: ${shop.domain} ---`);
        try {
            const response = await axios_1.default.get(`https://${shop.domain}/admin/api/2024-01/shop.json`, {
                headers: {
                    'X-Shopify-Access-Token': shop.accessToken,
                }
            });
            console.log(`✅ Success! Shop Name: ${response.data.shop.name}`);
            console.log(`   Currency: ${response.data.shop.currency}`);
            // Check scopes (via access_scopes.json)
            try {
                const scopeRes = await axios_1.default.get(`https://${shop.domain}/admin/oauth/access_scopes.json`, {
                    headers: {
                        'X-Shopify-Access-Token': shop.accessToken,
                    }
                });
                const scopes = scopeRes.data.access_scopes.map((s) => s.handle);
                console.log(`✅ Scopes found: ${scopes.join(', ')}`);
                const required = ['write_products', 'read_products'];
                const missing = required.filter(r => !scopes.includes(r));
                if (missing.length > 0) {
                    console.log(`❌ ALARM: Missing required scopes: ${missing.join(', ')}`);
                }
                else {
                    console.log(`✅ All required product scopes are present.`);
                }
            }
            catch (e) {
                console.log(`❌ Failed to fetch scopes: ${e.message}`);
            }
        }
        catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Data: ${JSON.stringify(error.response.data)}`);
            }
        }
        console.log('\n');
    }
    await prisma.$disconnect();
}
main().catch(console.error);
//# sourceMappingURL=audit_shopify_conn.js.map