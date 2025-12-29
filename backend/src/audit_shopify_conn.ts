
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function main() {
    const shops = await prisma.shop.findMany();
    console.log(`Auditing ${shops.length} shops...\n`);

    for (const shop of shops) {
        console.log(`--- Shop: ${shop.domain} ---`);
        try {
            const response = await axios.get(`https://${shop.domain}/admin/api/2024-01/shop.json`, {
                headers: {
                    'X-Shopify-Access-Token': shop.accessToken,
                }
            });
            console.log(`✅ Success! Shop Name: ${response.data.shop.name}`);
            console.log(`   Currency: ${response.data.shop.currency}`);

            // Check scopes (via access_scopes.json)
            try {
                const scopeRes = await axios.get(`https://${shop.domain}/admin/oauth/access_scopes.json`, {
                    headers: {
                        'X-Shopify-Access-Token': shop.accessToken,
                    }
                });
                const scopes = scopeRes.data.access_scopes.map((s: any) => s.handle);
                console.log(`✅ Scopes found: ${scopes.join(', ')}`);

                const required = ['write_products', 'read_products'];
                const missing = required.filter(r => !scopes.includes(r));
                if (missing.length > 0) {
                    console.log(`❌ ALARM: Missing required scopes: ${missing.join(', ')}`);
                } else {
                    console.log(`✅ All required product scopes are present.`);
                }
            } catch (e: any) {
                console.log(`❌ Failed to fetch scopes: ${e.message}`);
            }

        } catch (error: any) {
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
