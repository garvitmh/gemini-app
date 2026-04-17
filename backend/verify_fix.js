const { PricingService } = require('./dist/services/pricing.service');

async function testPricingFix() {
    console.log("--- Verification of Pricing Math Fix ---");
    
    // Test Case 1: Auto Gross weight with Stones (10g gold + 5ct stones)
    // Expected Gross Weight: 10 + (5 * 0.2) = 11g
    const mockProduct1 = {
        weightGrams: 10,
        gemstones: [
            { 
                gemstoneWeight: 5, 
                isCustom: true, 
                pricePerCarat: 0, 
                gemstoneType: "Diamond" 
            } 
        ],
        enamelWeightGrams: 0,
        autoGrossGoldWeight: true,
        makingChargeType: 'flat',
        makingChargeValue: 0, 
        wastagePct: 0,
        gstPct: 0,
        metalDiscountType: 'none',
        metalDiscountValue: 0,
        makingDiscountType: 'none',
        makingDiscountValue: 0,
        metal: "Gold",
        karat: "22"
    };

    const ratePerGram = 1000;
    const settings = {
        defaultWastagePct: 0,
        defaultGstPct: 0,
        defaultDiscountRate: 0,
        defaultMakingChargeType: 'flat',
        defaultMakingChargeValue: 0,
        defaultMetalDiscountType: 'none',
        defaultMetalDiscountValue: 0,
        defaultMakingDiscountType: 'none',
        defaultMakingDiscountValue: 0,
        defaultGemstoneDiscountType: 'none',
        defaultGemstoneDiscountValue: 0
    };

    try {
        console.log("\n--- Test 1: Auto Gross Weight (1ct=0.2g) ---");
        const result1 = await PricingService.calculateProductPrice(mockProduct1, ratePerGram, null, settings);
        
        console.log(`Input: 10g Gold, 5ct Stones`);
        console.log(`Calculated Weight: ${result1.breakdown.weight}g`);
        console.log(`Calculated Price: ₹${result1.price}`);
        
        if (result1.breakdown.weight === 11 && result1.price === 11000) {
            console.log("✅ SUCCESS: 1ct = 0.2g conversion confirmed.");
        } else {
            console.log(`❌ FAILURE: Expected 11g and ₹11000, got ${result1.breakdown.weight}g and ₹${result1.price}`);
        }

        // Test Case 2: Manual Gross weight (should ignore stones in gross weight calc)
        console.log("\n--- Test 2: Manual Gross Weight (Ignore Stones in gross) ---");
        const mockProduct2 = {
            ...mockProduct1,
            autoGrossGoldWeight: false,
            grossGoldWeight: 15,
            gemstones: [
                { 
                    gemstoneWeight: 10, 
                    isCustom: true, 
                    pricePerCarat: 100, // 100 * 10 = 1000
                    gemstoneType: "Emerald" 
                } 
            ]
        };

        const result2 = await PricingService.calculateProductPrice(mockProduct2, ratePerGram, null, settings);
        // Weight should be 15g. 
        // Price = (15 * 1000) + (10 * 100) = 15000 + 1000 = 16000
        console.log(`Input: 15g manual gross weight, 10ct stones at ₹100/ct`);
        console.log(`Calculated Weight: ${result2.breakdown.weight}g`);
        console.log(`Calculated Price: ₹${result2.price}`);

        if (result2.breakdown.weight === 15 && result2.price === 16000) {
            console.log("✅ SUCCESS: Manual gross weight and custom gemstone cost confirmed.");
        } else {
            console.log(`❌ FAILURE: Expected 15g and ₹16000, got ${result2.breakdown.weight}g and ₹${result2.price}`);
        }

    } catch (error) {
        console.error("Test failed with error:", error.message);
        console.error(error.stack);
    }
}

testPricingFix();
