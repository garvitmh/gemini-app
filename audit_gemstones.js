
const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        if (data) {
            const payload = JSON.stringify(data);
            options.headers = options.headers || {};
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(payload);

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body || '{}'));
                    } catch (e) {
                        resolve({});
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
            return;
        }
        // GET fallback (omitted for brevity)
    });
}

async function runAudit() {
    console.log("Starting Gemstone Pricing Audit...");

    const basePayload = {
        weightGrams: 1, // Must be > 0
        metal: 'gold',
        karat: 24,
        makingChargeValue: 0
    };

    const calcOptions = {
        hostname: '127.0.0.1',
        port: 3005,
        path: `/api/products/calculate-price`,
        method: 'POST'
    };

    // 1. Ruby 1ct
    console.log("Testing Standard Ruby (1ct)...");
    const rubyPayload = { ...basePayload, gemstoneType: 'ruby', stoneWeightCarat: 1, stonePieces: 1 };
    const rubyRes = await request(calcOptions, rubyPayload);
    if (rubyRes.breakdown) console.log("Ruby Breakdown:", JSON.stringify(rubyRes.breakdown, null, 2));
    const rubyPrice = rubyRes.breakdown ? rubyRes.breakdown.gemstone_price : 0;
    console.log("Ruby Price:", rubyPrice);

    if (rubyPrice > 0) console.log("✅ Standard Ruby has price.");
    else console.error("❌ Standard Ruby price is 0.");

    // 2. Custom Gemstone (Manual Price)
    console.log("Testing Custom Gemstone (Manual Price 5000)...");
    const customPayload = {
        ...basePayload,
        gemstoneType: 'custom',
        isManualGemstonePrice: true,
        manualGemstonePrice: 5000,
        manualGemstoneWeight: 1
    };
    const customRes = await request(calcOptions, customPayload);
    const customPrice = customRes.breakdown ? customRes.breakdown.gemstone_price : 0;
    console.log("Custom Price:", customPrice);

    if (customPrice === 5000) console.log("✅ Custom Manually Priced Gemstone is correct.");
    else console.error(`❌ Custom Gemstone price mismatch. Expected 5000, got ${customPrice}`);

    // 3. Custom Gemstone (Weight Based Calculation - Recent Fix)
    // Needs a rate in the system or we provide it?
    // "Custom" type usually relies on manual inputs or specific rate.
    // The "Fix" was about "Rate not set" error.
    // Let's testing sending a valid Rate-based custom gem if possible.
    // Actually, "Custom" in payload usually means `isManualGemstonePrice: true`.
    // Validating the recently fixed "Rate Per Carat" logic requires a `productGemstone` entry with `pricePerCarat`.
    // sending `gemstones` array in payload supports this.

    console.log("Testing Gemstone Array with Custom Rate...");
    const complexPayload = {
        ...basePayload,
        gemstones: [
            {
                gemstoneType: 'Onyx',
                isCustom: true,
                gemstoneWeight: 2,
                gemstonePieces: 1,
                pricePerPiece: 1000 // Piece based
            }
        ]
    };
    const complexRes = await request(calcOptions, complexPayload);
    // Note: total gemstone price is sum of all gems.
    const complexPrice = complexRes.breakdown ? complexRes.breakdown.gemstone_price : 0;
    console.log("Complex Custom Gem Price (2ct * Piece Rate? No, Piece Rate 1000 * 1 pc):", complexPrice);

    // Note: If piece rate is 1000 and pieces 1, expected 1000.
    if (complexPrice === 1000) console.log("✅ Custom Gemstone Array (Piece Rate) correct.");
    else console.error(`❌ Custom Gemstone Array mismatch. Expected 1000, got ${complexPrice}`);

}

runAudit().catch(console.error);
