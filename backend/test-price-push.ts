import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

/**
 * Test script to push a single product price to Shopify
 * This will help us see the detailed error logs
 */

async function testPricePush() {
    console.log('\n🧪 Testing Price Push to Shopify...\n');

    try {
        // Get the first product from database
        const product = await prisma.product.findFirst({
            where: {
                shopifyVariantId: { not: null },
                shopifyProductId: { not: null },
                weightGrams: { not: null, gt: 0 },
                metal: { not: null }
            },
            include: { gemstones: true }
        });

        if (!product) {
            console.error('❌ No suitable product found in database');
            console.log('   Please sync products from Shopify first');
            process.exit(1);
        }

        console.log(`Found product: ${product.title} (${product.sku})`);
        console.log(`   Weight: ${product.weightGrams}g`);
        console.log(`   Metal: ${product.metal} ${product.karat ? product.karat + 'K' : ''}`);

        // Get shop and metal rate
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) {
            console.error('❌ Shop not found');
            process.exit(1);
        }

        const metalRate = await prisma.metalRate.findFirst({
            where: {
                shopId: shop.id,
                metal: product.metal!,
                karat: product.karat
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (!metalRate) {
            console.error(`❌ No metal rate found for ${product.metal} ${product.karat ? product.karat + 'K' : ''}`);
            process.exit(1);
        }

        console.log(`   Metal Rate: ₹${metalRate.ratePerGram}/g\n`);

        // Calculate price (simplified version)
        const weight = product.weightGrams || 0;
        const metalValue = metalRate.ratePerGram * weight;
        const wastage = metalValue * 0.02; // 2% wastage
        const makingCharges = 1500 * weight; // ₹1500/g
        const subtotal = metalValue + wastage + makingCharges;
        const gst = subtotal * 0.03; // 3% GST
        const finalPrice = subtotal + gst;

        console.log('Calculated Price Breakdown:');
        console.log(`   Metal Value: ₹${metalValue.toFixed(2)}`);
        console.log(`   Wastage (2%): ₹${wastage.toFixed(2)}`);
        console.log(`   Making Charges: ₹${makingCharges.toFixed(2)}`);
        console.log(`   Subtotal: ₹${subtotal.toFixed(2)}`);
        console.log(`   GST (3%): ₹${gst.toFixed(2)}`);
        console.log(`   Final Price: ₹${finalPrice.toFixed(2)}\n`);

        const breakdown = {
            metal: product.metal,
            karat: product.karat,
            weight: weight,
            metal_name: `${product.metal} ${product.karat ? product.karat + 'K' : ''}`,
            metal_rate: Math.round(metalRate.ratePerGram * 100),
            metal_value: Math.round(metalValue * 100),
            wastage_amount: Math.round(wastage * 100),
            wastage_pct: 2,
            making_charges: Math.round(makingCharges * 100),
            making_charge_type: 'per_gram',
            making_charge_rate: 1500,
            subtotal: Math.round(subtotal * 100),
            gst_amount: Math.round(gst * 100),
            gst_pct: 3,
            total: Math.round(finalPrice * 100)
        };

        // Now push to Shopify
        const variantId = product.shopifyVariantId.replace('gid://shopify/ProductVariant/', '');
        const productId = product.shopifyProductId.replace('gid://shopify/Product/', '');

        console.log('Pushing to Shopify...');
        console.log(`   Variant ID: ${variantId}`);
        console.log(`   Product ID: ${productId}\n`);

        // Update variant price and metafield
        const response = await axios.put(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}.json`,
            {
                variant: {
                    id: parseInt(variantId),
                    price: finalPrice.toFixed(2),
                    metafields: [
                        {
                            namespace: 'gemini',
                            key: 'price_breakdown',
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

        console.log('✅ Successfully updated variant price!');
        console.log(`   New price: ₹${finalPrice.toFixed(2)}`);

        // Verify metafield
        console.log('\nVerifying metafield...');
        const metafieldResponse = await axios.get(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}/metafields.json`,
            {
                headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
            }
        );

        const priceBreakdownMetafield = metafieldResponse.data.metafields.find(
            (m: any) => m.namespace === 'gemini' && m.key === 'price_breakdown'
        );

        if (priceBreakdownMetafield) {
            console.log('✅ Metafield successfully created!');
            console.log(`   Metafield ID: ${priceBreakdownMetafield.id}`);
            console.log(`   Value length: ${priceBreakdownMetafield.value.length} characters`);
        } else {
            console.log('⚠️  Metafield not found after update');
        }

        console.log('\n✅ Test completed successfully!\n');
        console.log('Next steps:');
        console.log('1. Check the product page on your Shopify store');
        console.log('2. Verify the price has been updated');
        console.log('3. If you have the Liquid template installed, check if the breakdown appears\n');

    } catch (error: any) {
        console.error('\n❌ Test failed!');
        console.error(`   Error: ${error.message}`);

        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
        }

        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testPricePush();
