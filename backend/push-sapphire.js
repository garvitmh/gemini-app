const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const SHOPIFY_STORE = 'daginawala11.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';

async function pushYellowSapphire() {
    try {
        const shop = await prisma.shop.findFirst();
        const product = await prisma.product.findFirst({
            where: {
                shopId: shop.id,
                title: { contains: 'Yellow Sapphire' }
            }
        });

        if (!product) {
            console.log('❌ Yellow Sapphire product not found');
            return;
        }

        console.log(`\n✅ Found: ${product.title}`);

        const variantId = product.shopifyVariantId?.replace('gid://shopify/ProductVariant/', '');

        if (!variantId) {
            console.log('❌ No variant ID found');
            return;
        }

        console.log(`   Variant ID: ${variantId}`);
        console.log(`\n🚀 Pushing price breakdown...\n`);

        // Complete breakdown for Yellow Sapphire
        const breakdown = {
            metal: 'gold',
            karat: 18,
            weight: 5,
            metal_name: 'Gold 18K',
            metal_rate: 180000, // ₹1800/g
            metal_value: 900000, // ₹9,000
            metal_value_original: 900000,

            wastage_pct: 2,
            wastage_amount: 18000, // ₹180

            making_charge_type: 'per_gram',
            making_charge_rate: 1200,
            making_charges: 600000, // ₹6,000
            making_charges_original: 600000,

            gemstone_price: 300000, // ₹3,000 for 3ct Yellow Sapphire
            gemstone_name: 'Yellow Sapphire',
            gemstone_details: {
                type: 'per_carat',
                weight: 3,
                rate: 100000,
                cost: 300000
            },

            subtotal: 1818000, // ₹18,180

            gst_pct: 3,
            gst_amount: 54540, // ₹545.40

            total: 1872540, // ₹18,725.40

            has_metal_discount: false,
            has_making_discount: false,
            has_gemstone_discount: false,
            has_enamel_discount: false
        };

        const response = await axios.put(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}.json`,
            {
                variant: {
                    id: parseInt(variantId),
                    price: '18725.40',
                    metafields: [
                        {
                            namespace: 'gemini',
                            key: 'price_breakdown',
                            value: JSON.stringify(breakdown),
                            type: 'json'
                        },
                        {
                            namespace: 'custom',
                            key: 'code_form',
                            value: JSON.stringify(breakdown),
                            type: 'json'
                        }
                    ]
                }
            },
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                    'Content-Type': 'application/json',
                }
            }
        );

        console.log('✅ SUCCESS! Price breakdown pushed');
        console.log('   Price: ₹18,725.40');
        console.log('   Metal (Gold 18K, 5g): ₹9,000');
        console.log('   Wastage (2%): ₹180');
        console.log('   Making (₹1200/g): ₹6,000');
        console.log('   Gemstone (3ct): ₹3,000');
        console.log('   GST (3%): ₹545.40');
        console.log('\n🎯 Refresh the Yellow Sapphire product page on Shopify!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        await prisma.$disconnect();
    }
}

pushYellowSapphire();
