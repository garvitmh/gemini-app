const axios = require('axios');

async function checkMetafield() {
    const VARIANT_ID = '42376034353242'; // Yellow Sapphire

    try {
        const response = await axios.get(
            `https://daginawala11.myshopify.com/admin/api/2024-01/variants/${VARIANT_ID}/metafields.json`,
            {
                headers: { 'X-Shopify-Access-Token': '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' }
            }
        );

        console.log('\n📋 All metafields for Yellow Sapphire:');
        response.data.metafields.forEach(m => {
            console.log(`\n  ${m.namespace}.${m.key}`);
            if (m.namespace === 'gemini' || m.namespace === 'custom') {
                const data = JSON.parse(m.value);
                console.log(`    metal_value: ${data.metal_value} (₹${data.metal_value / 100})`);
                console.log(`    total: ${data.total} (₹${data.total / 100})`);
            }
        });

        const gemini = response.data.metafields.find(m => m.namespace === 'gemini' && m.key === 'price_breakdown');
        const custom = response.data.metafields.find(m => m.namespace === 'custom' && m.key === 'code_form');

        console.log('\n✅ Status:');
        console.log(`  gemini.price_breakdown: ${gemini ? 'EXISTS' : 'MISSING'}`);
        console.log(`  custom.code_form: ${custom ? 'EXISTS' : 'MISSING'}`);

        if (!gemini && !custom) {
            console.log('\n❌ PROBLEM: No price breakdown metafields found!');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkMetafield();
