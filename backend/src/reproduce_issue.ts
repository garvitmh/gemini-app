import axios from 'axios';

const run = async () => {
    // Try likely ports based on observation
    const ports = [3000, 3005, 8080, 5000, 5001];

    for (const port of ports) {
        console.log(`\nTesting connection to http://127.0.0.1:${port}...`);
        try {
            const payload = {
                weightGrams: 5,
                metal: 'gold',
                karat: 22,
                makingChargeType: 'per_gram',
                makingChargeValue: 1500,

                // Explicit Discounts
                makingDiscountType: 'percent',
                makingDiscountValue: 15,

                gemstoneDiscountType: 'percent',
                gemstoneDiscountValue: 20,

                gemstones: [
                    {
                        gemstoneType: 'Mother_of_pearl',
                        gemstoneWeight: 2,
                        gemstonePieces: 1,
                    },
                    {
                        gemstoneType: 'Aquamarine',
                        gemstoneWeight: 2,
                        gemstonePieces: 1,
                    }
                ]
            };

            const response = await axios.post(`http://127.0.0.1:${port}/api/products/calculate-price`, payload, { timeout: 2000 });

            console.log(`✅ SUCCESS on Port ${port}`);
            console.log('--- RESPONSE BREAKDOWN ---');
            console.log('Making Charges Original:', response.data.breakdown.making_charges_original);
            console.log('Making Charges Final:', response.data.breakdown.making_charges);
            console.log('Has Making Discount:', response.data.breakdown.has_making_discount);

            console.log('Gemstone Price Original:', response.data.breakdown.gemstone_price_original);
            console.log('Gemstone Price Final:', response.data.breakdown.gemstone_price);
            console.log('Has Gemstone Discount:', response.data.breakdown.has_gemstone_discount);

            if (response.data.breakdown.gemstone_details?.gemstones) {
                response.data.breakdown.gemstone_details.gemstones.forEach((g: any, i: number) => {
                    console.log(`Gem ${i} (${g.type}): Cost=${g.cost}, Final=${g.finalCost}, HasDiscount=${g.hasDiscount}`);
                });
            }
            return; // Exit on success

        } catch (error: any) {
            // console.log(`❌ Failed on Port ${port}: ${error.code || error.message}`);
        }
    }
    console.error('All connection attempts failed. The server might not be running or is on an unexpected port.');
};

run();
