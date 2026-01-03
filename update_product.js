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
                        console.error("Failed to parse JSON:", e.message);
                        console.error("Raw body:", body); // Added logging
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
                    console.error("Failed to parse JSON:", e.message);
                    resolve({});
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function updateProduct() {
    const productId = 'cmjwtn3640012tubhbq2dmkr4';

    console.log(`Fetching product ${productId}...`);
    const product = await request({
        hostname: '127.0.0.1',
        port: 3005,
        path: `/api/products/${productId}`,
        method: 'GET'
    });

    if (!product || !product.id) {
        console.error('Product not found');
        return;
    }

    console.log(`Product: ${product.title}`);
    console.log('Triggering price recalculation and Shopify sync...');

    // Update product (this will recalculate and push to Shopify)
    const updateResult = await request({
        hostname: '127.0.0.1',
        port: 3005,
        path: `/api/products/${productId}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
    }, {
        // Send minimal update to trigger recalculation
        weightGrams: product.weightGrams,
        metal: product.metal,
        karat: product.karat
    });

    console.log('Update result:', updateResult.success ? '✅ SUCCESS' : '❌ FAILED');
    if (updateResult.message) {
        console.log('Message:', updateResult.message);
    }
}

updateProduct().catch(console.error);
