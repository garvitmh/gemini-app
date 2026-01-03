
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
                        console.error("Failed to parse JSON for path " + options.path + ". Status: " + res.statusCode);
                        console.error("Body preview:", body.substring(0, 200));
                        resolve({});
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
            return;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body || '{}'));
                } catch (e) {
                    console.log("Response body:", body);
                    resolve({});
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function runAudit() {
    console.log("Starting Pricing Audit...");

    // 1. Get Rates
    const rates = await request({
        hostname: '127.0.0.1',
        port: 3005,
        path: '/api/rates',
        method: 'GET'
    });

    // console.log("Raw Rates Response:", JSON.stringify(rates, null, 2));
    // Handle wrapper
    const ratesList = rates.metalRates || [];
    console.log("Metal Rates found:", ratesList.length);

    const goldRate = ratesList.find(r => r.metal.toLowerCase() === 'gold' && r.karat === 24);
    if (!goldRate) { console.error("Could not find Gold 24K rate"); return; }
    const originalPrice = goldRate.ratePerGram;
    console.log(`Current Gold 24K Rate: ${originalPrice}`);

    // 3. Define dummy product payload
    const productPayload = {
        weightGrams: 10,
        metal: 'gold',
        karat: 24,
        makingChargeType: 'flat', // Simplify
        makingChargeValue: 0
    };

    const calcOptions = {
        hostname: '127.0.0.1',
        port: 3005,
        path: `/api/products/calculate-price`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    };

    console.log("Calculating price for 10g Gold 24K...");
    const price1Res = await request(calcOptions, productPayload);
    const price1 = price1Res.breakdown ? price1Res.breakdown.total : undefined;
    console.log(`Price at Rate ${originalPrice}: ${price1}`);

    // 4. Update Rate (+1000)
    const newRate = originalPrice + 1000;
    await request({
        hostname: '127.0.0.1',
        port: 3005,
        path: `/api/rates/update`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        metal: 'gold',
        karat: 24,
        ratePerGram: newRate,
        reason: 'Audit Test'
    });
    console.log(`Updated Rate to ${newRate} (via POST/create)`);

    // 5. Calculate New Price
    const price2Res = await request(calcOptions, productPayload);
    const price2 = price2Res.breakdown ? price2Res.breakdown.total : undefined;
    console.log(`Price at Rate ${newRate}: ${price2}`);

    if (price2 > price1) {
        console.log("✅ SUCCESS: Price increased as expected.");
    } else {
        console.error("❌ FAILURE: Price did not increase.");
    }

    // 6. Revert Rate
    await request({
        hostname: '127.0.0.1',
        port: 3005,
        path: `/api/rates/update`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        metal: 'gold',
        karat: 24,
        ratePerGram: originalPrice,
        reason: 'Audit Revert'
    });
    console.log(`Reverted Rate to ${originalPrice}`);

}

runAudit().catch(console.error);
