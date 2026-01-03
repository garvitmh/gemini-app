import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'daginawala11.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

async function fixToken() {
    console.log(`Updating token for: ${SHOPIFY_STORE}`);
    console.log(`Token prefix: ${SHOPIFY_ACCESS_TOKEN.substring(0, 10)}...`);

    const shop = await prisma.shop.update({
        where: { domain: SHOPIFY_STORE },
        data: {
            accessToken: SHOPIFY_ACCESS_TOKEN,
            isActive: true
        }
    });

    console.log('✅ Database updated!');
    console.log(`Shop ID: ${shop.id}`);

    // Verify
    const verify = await prisma.shop.findUnique({
        where: { domain: SHOPIFY_STORE }
    });

    if (verify && verify.accessToken === SHOPIFY_ACCESS_TOKEN) {
        console.log('✅ Verification successful - token matches!');
    } else {
        console.error('❌ Verification failed - token mismatch!');
    }

    await prisma.$disconnect();
}

fixToken().catch(console.error);
