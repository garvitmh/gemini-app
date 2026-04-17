const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';

async function quickFunctionalityCheck() {
    console.log('QUICK FUNCTIONALITY CHECK');
    console.log('========================\n');

    const results = [];

    try {
        // 1. Database
        await prisma.$connect();
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        results.push({ name: 'Database Connection', pass: !!shop });
        results.push({ name: 'Shop Settings', pass: !!shop.settings });

        // 2. Products
        const productCount = await prisma.product.count();
        results.push({ name: 'Products in DB', pass: productCount > 0, detail: `${productCount} products` });

        // 3. Metal Rates
        const rateCount = await prisma.metalRate.count();
        results.push({ name: 'Metal Rates', pass: rateCount > 0, detail: `${rateCount} rates` });

        // 4. API - Products List
        const prodResp = await axios.get(`${API_URL}/products?limit=5`);
        results.push({ name: 'Products API', pass: prodResp.status === 200, detail: `${prodResp.data.products?.length} returned` });

        // 5. API - Rates
        const ratesResp = await axios.get(`${API_URL}/rates`);
        results.push({ name: 'Rates API', pass: ratesResp.status === 200 });

        // 6. API - Push Breakdown Validation
        const pushResp = await axios.post(`${API_URL}/products/push-breakdown`,
            { productIds: [] },
            { validateStatus: () => true }
        );
        results.push({ name: 'Push Endpoint', pass: pushResp.status === 400 });

        // 7. Price Calculation
        const testProd = await prisma.product.findFirst({
            where: { weightGrams: { gt: 0 }, metal: { not: null } },
            include: { gemstones: true }
        });

        if (testProd) {
            const { PricingService } = require('./dist/services/pricing.service');
            const metalRate = await prisma.metalRate.findFirst({
                where: { shopId: shop.id, metal: testProd.metal }
            });

            if (metalRate && shop.settings) {
                const priceResult = await PricingService.calculateProductPrice(
                    testProd, metalRate.ratePerGram, null, shop.settings
                );
                results.push({ name: 'Price Calculation', pass: priceResult.price > 0, detail: `Rs.${priceResult.price.toFixed(2)}` });
                results.push({ name: 'Breakdown Generation', pass: !!priceResult.breakdown });
            }
        }

        // 8. Export
        const exportResp = await axios.get(`${API_URL}/products/template?format=xlsx`,
            { responseType: 'arraybuffer' }
        );
        results.push({ name: 'Export Template', pass: exportResp.status === 200 });

        // 9. Frontend
        const frontendResp = await axios.get('http://localhost:5173', { timeout: 5000 });
        results.push({ name: 'Frontend Server', pass: frontendResp.status === 200 });

        // 10. Shopify Service
        const { ShopifyService } = require('./dist/services/shopify.service');
        const shopifyService = await ShopifyService.forShop(shop.domain);
        results.push({ name: 'Shopify Service', pass: !!shopifyService });

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }

    // Print Results
    console.log('\nRESULTS:');
    console.log('--------');
    let passed = 0;
    results.forEach(r => {
        const icon = r.pass ? 'PASS' : 'FAIL';
        const detail = r.detail ? ` (${r.detail})` : '';
        console.log(`[${icon}] ${r.name}${detail}`);
        if (r.pass) passed++;
    });

    console.log(`\nSUMMARY: ${passed}/${results.length} tests passed`);
    console.log(passed === results.length ? '\nALL TESTS PASSED!' : '\nSOME TESTS FAILED');
}

quickFunctionalityCheck().catch(console.error);
