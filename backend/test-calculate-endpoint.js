// Test the calculate-price endpoint directly
const axios = require('axios');

async function testCalculatePrice() {
    try {
        // This will fail without auth, but we can see the structure
        const response = await axios.post('http://localhost:3000/api/products/calculate-price', {
            weightGrams: 3.29,
            grossGoldWeight: 3.4,
            autoGrossGoldWeight: false,
            metal: 'gold',
            karat: 18,
            gemstones: [],
            makingChargeType: 'per_gram',
            makingChargeValue: 1500,
            wastagePct: 0,
            gstPct: 3,
            discount: 0,
            discountType: 'flat'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Response:', response.data);
        console.log('Price:', response.data.price);

    } catch (error) {
        if (error.response) {
            console.log('❌ Error Response:', error.response.status);
            console.log('Error Data:', error.response.data);
        } else {
            console.log('❌ Error:', error.message);
        }
    }
}

testCalculatePrice();
