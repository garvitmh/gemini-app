const axios = require('axios');

const SHOPIFY_STORE = 'daginawala11.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';
const VARIANT_ID = '42375841972314'; // 18K Diamond Bracelet

async function pushCompleteBreakdown() {
    console.log('\n🚀 Pushing complete price breakdown to Shopify...\n');

    // Complete breakdown with ALL fields
    const breakdown = {
        metal: 'gold',
        karat: 22,
        weight: 10,
        metal_name: 'Gold 22K',
        metal_rate: 200000, // ₹2000/g in paisa
        metal_value: 2000000, // ₹20,000
        metal_value_original: 2000000,

        wastage_pct: 2,
        wastage_amount: 40000, // ₹400

        making_charge_type: 'per_gram',
        making_charge_rate: 1500,
        making_charges: 1500000, // ₹15,000
        making_charges_original: 1500000,

        subtotal: 3540000, // ₹35,400

        gst_pct: 3,
        gst_amount: 106200, // ₹1,062

        total: 3646200, // ₹36,462

        has_metal_discount: false,
        has_making_discount: false,
        has_gemstone_discount: false,
        has_enamel_discount: false
    };

    try {
        // Push to Shopify with BOTH metafield names
        const response = await axios.put(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${VARIANT_ID}.json`,
            {
                variant: {
                    id: parseInt(VARIANT_ID),
                    price: '36462.00',
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

        console.log('✅ SUCCESS! Price breakdown pushed to Shopify');
        console.log('   Price: ₹36,462.00');
        console.log('   Metal: ₹20,000');
        console.log('   Wastage: ₹400');
        console.log('   Making: ₹15,000');
        console.log('   GST: ₹1,062');
        console.log('\n🎯 NOW REFRESH YOUR SHOPIFY PRODUCT PAGE!');
        console.log('   You should see the price breakdown with actual values!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

pushCompleteBreakdown();
