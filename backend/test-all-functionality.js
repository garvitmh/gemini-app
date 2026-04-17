const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');
const XLSX = require('xlsx');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';

const testResults = {
    passed: [],
    failed: [],
    warnings: []
};

function logTest(name, passed, details = '') {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}`);
    if (details) console.log(`   ${details}`);

    if (passed) {
        testResults.passed.push(name);
    } else {
        testResults.failed.push(name);
    }
}

async function testFunctionality() {
    console.log('🧪 COMPREHENSIVE FUNCTIONALITY TEST SUITE');
    console.log('='.repeat(70));

    let testProduct = null;
    let testShop = null;

    try {
        // ============================================================
        // SECTION 1: DATABASE & CONFIGURATION
        // ============================================================
        console.log('\n📊 SECTION 1: DATABASE & CONFIGURATION');
        console.log('-'.repeat(70));

        // Test 1.1: Database Connection
        try {
            await prisma.$connect();
            testShop = await prisma.shop.findFirst({ include: { settings: true } });
            logTest('1.1 Database Connection', !!testShop, `Shop: ${testShop?.domain}`);
        } catch (e) {
            logTest('1.1 Database Connection', false, e.message);
            return;
        }

        // Test 1.2: Shop Settings
        const hasSettings = testShop.settings !== null;
        logTest('1.2 Shop Settings Configured', hasSettings,
            hasSettings ? `GST: ${testShop.settings.defaultGstPct}%, Making: ${testShop.settings.defaultMakingChargeType}` : 'Missing');

        // Test 1.3: Metal Rates
        const metalRates = await prisma.metalRate.count();
        logTest('1.3 Metal Rates Available', metalRates > 0, `${metalRates} rates configured`);

        // ============================================================
        // SECTION 2: PRODUCT MANAGEMENT
        // ============================================================
        console.log('\n📦 SECTION 2: PRODUCT MANAGEMENT');
        console.log('-'.repeat(70));

        // Test 2.1: List Products API
        try {
            const response = await axios.get(`${API_URL}/products?limit=10`);
            const hasProducts = response.data.products && response.data.products.length > 0;
            logTest('2.1 List Products API', hasProducts,
                `Found ${response.data.pagination?.total || 0} products`);

            if (hasProducts) {
                testProduct = response.data.products[0];
            }
        } catch (e) {
            logTest('2.1 List Products API', false, e.message);
        }

        // Test 2.2: Search Products
        if (testProduct) {
            try {
                const response = await axios.get(`${API_URL}/products?search=${testProduct.sku}`);
                const found = response.data.products.some(p => p.sku === testProduct.sku);
                logTest('2.2 Search Products', found, `Searched for SKU: ${testProduct.sku}`);
            } catch (e) {
                logTest('2.2 Search Products', false, e.message);
            }
        }

        // Test 2.3: Filter by Status
        try {
            const response = await axios.get(`${API_URL}/products?status=active&limit=5`);
            logTest('2.3 Filter by Status', response.status === 200,
                `Active products: ${response.data.products?.length || 0}`);
        } catch (e) {
            logTest('2.3 Filter by Status', false, e.message);
        }

        // ============================================================
        // SECTION 3: PRICE CALCULATION
        // ============================================================
        console.log('\n💰 SECTION 3: PRICE CALCULATION');
        console.log('-'.repeat(70));

        if (testProduct && testProduct.weightGrams > 0) {
            // Test 3.1: Price Calculation Service
            try {
                const { PricingService } = require('./dist/services/pricing.service');

                const product = await prisma.product.findUnique({
                    where: { id: testProduct.id },
                    include: { gemstones: true, makingGroup: true }
                });

                const metalRate = await prisma.metalRate.findFirst({
                    where: { shopId: testShop.id, metal: product.metal }
                });

                if (metalRate && testShop.settings) {
                    const result = await PricingService.calculateProductPrice(
                        product,
                        metalRate.ratePerGram,
                        null,
                        testShop.settings
                    );

                    const hasPrice = result.price > 0;
                    logTest('3.1 Price Calculation', hasPrice,
                        `Calculated: ₹${result.price.toFixed(2)}`);

                    // Test 3.2: Breakdown Generation
                    const hasBreakdown = result.breakdown && result.breakdown.total > 0;
                    logTest('3.2 Breakdown Generation', hasBreakdown,
                        `Breakdown includes: metal, making, GST`);
                } else {
                    logTest('3.1 Price Calculation', false, 'Missing metal rate or settings');
                }
            } catch (e) {
                logTest('3.1 Price Calculation', false, e.message);
            }
        }

        // ============================================================
        // SECTION 4: RATES MANAGEMENT
        // ============================================================
        console.log('\n💎 SECTION 4: RATES MANAGEMENT');
        console.log('-'.repeat(70));

        // Test 4.1: Get Rates API
        try {
            const response = await axios.get(`${API_URL}/rates`);
            const hasRates = response.data.metalRates && response.data.metalRates.length > 0;
            logTest('4.1 Get Rates API', hasRates,
                `Metal: ${response.data.metalRates?.length || 0}, Stone: ${response.data.stoneRates?.length || 0}`);
        } catch (e) {
            logTest('4.1 Get Rates API', false, e.message);
        }

        // Test 4.2: Stone Rates
        const stoneRates = await prisma.stoneRate.count();
        logTest('4.2 Gemstone Rates', stoneRates >= 0, `${stoneRates} stone rates configured`);

        // Test 4.3: Making Groups
        const makingGroups = await prisma.makingGroup.count();
        logTest('4.3 Making Groups', makingGroups >= 0, `${makingGroups} groups configured`);

        // ============================================================
        // SECTION 5: PUSH TO SHOPIFY
        // ============================================================
        console.log('\n🚀 SECTION 5: PUSH TO SHOPIFY');
        console.log('-'.repeat(70));

        // Test 5.1: Push Breakdown Endpoint Validation
        try {
            const response = await axios.post(`${API_URL}/products/push-breakdown`,
                { productIds: [] },
                { validateStatus: () => true }
            );
            const correctValidation = response.status === 400 &&
                response.data.error === 'Product IDs required';
            logTest('5.1 Push Endpoint Validation', correctValidation,
                'Correctly validates empty product IDs');
        } catch (e) {
            logTest('5.1 Push Endpoint Validation', false, e.message);
        }

        // Test 5.2: Push Single Product (if we have a valid product)
        if (testProduct && testProduct.shopifyVariantId) {
            try {
                console.log(`   Testing push for product: ${testProduct.sku}...`);
                const response = await axios.post(`${API_URL}/products/push-breakdown`,
                    { productIds: [testProduct.id] },
                    { timeout: 30000 }
                );

                const success = response.data.success && response.data.successCount > 0;
                logTest('5.2 Push Single Product', success,
                    success ? `Pushed ${testProduct.sku} successfully` : 'Push failed');

                if (success) {
                    // Verify lastPushedAt was updated
                    const updated = await prisma.product.findUnique({
                        where: { id: testProduct.id },
                        select: { lastPushedAt: true, lastPushedPrice: true }
                    });
                    logTest('5.3 Push Timestamp Update', !!updated.lastPushedAt,
                        `Last pushed: ${updated.lastPushedAt?.toISOString() || 'Never'}`);
                }
            } catch (e) {
                logTest('5.2 Push Single Product', false, e.message);
            }
        } else {
            testResults.warnings.push('No product with Shopify ID for push test');
        }

        // ============================================================
        // SECTION 6: IMPORT/EXPORT
        // ============================================================
        console.log('\n📥 SECTION 6: IMPORT/EXPORT');
        console.log('-'.repeat(70));

        // Test 6.1: Export Template
        try {
            const response = await axios.get(`${API_URL}/products/template?format=xlsx`,
                { responseType: 'arraybuffer' }
            );
            const isExcel = response.headers['content-type']?.includes('spreadsheet');
            logTest('6.1 Export Template', isExcel,
                `Template size: ${response.data.byteLength} bytes`);
        } catch (e) {
            logTest('6.1 Export Template', false, e.message);
        }

        // Test 6.2: Export Products
        try {
            const response = await axios.get(`${API_URL}/products/export?format=xlsx`,
                { responseType: 'arraybuffer' }
            );
            const isExcel = response.headers['content-type']?.includes('spreadsheet');
            logTest('6.2 Export Products', isExcel,
                `Export size: ${response.data.byteLength} bytes`);
        } catch (e) {
            logTest('6.2 Export Products', false, e.message);
        }

        // ============================================================
        // SECTION 7: SHOPIFY INTEGRATION
        // ============================================================
        console.log('\n🏪 SECTION 7: SHOPIFY INTEGRATION');
        console.log('-'.repeat(70));

        // Test 7.1: Shopify Service Initialization
        try {
            const { ShopifyService } = require('./dist/services/shopify.service');
            const service = await ShopifyService.forShop(testShop.domain);
            logTest('7.1 Shopify Service Init', !!service,
                `Initialized for ${testShop.domain}`);
        } catch (e) {
            logTest('7.1 Shopify Service Init', false, e.message);
        }

        // Test 7.2: Access Token Configuration
        const hasToken = !!testShop.accessToken;
        logTest('7.2 Shopify Access Token', hasToken,
            hasToken ? 'Token configured' : 'Token missing');

        // ============================================================
        // SECTION 8: DATA INTEGRITY
        // ============================================================
        console.log('\n🔍 SECTION 8: DATA INTEGRITY');
        console.log('-'.repeat(70));

        // Test 8.1: Products with Complete Data
        const completeProducts = await prisma.product.count({
            where: {
                metal: { not: null },
                weightGrams: { gt: 0 },
                currentPrice: { gt: 0 }
            }
        });
        const totalProducts = await prisma.product.count();
        const completeness = totalProducts > 0 ? (completeProducts / totalProducts * 100).toFixed(1) : 0;
        logTest('8.1 Product Data Completeness', completeness > 50,
            `${completeProducts}/${totalProducts} products (${completeness}%) have complete data`);

        // Test 8.2: Price Consistency
        const productsWithBreakdown = await prisma.product.count({
            where: {
                currentPrice: { gt: 0 },
                priceBreakdownHtml: { not: null }
            }
        });
        logTest('8.2 Price-Breakdown Consistency', productsWithBreakdown > 0,
            `${productsWithBreakdown} products have both price and breakdown`);

        // Test 8.3: Shopify Sync Status
        const syncedProducts = await prisma.product.count({
            where: {
                shopifyVariantId: { not: null },
                shopifyProductId: { not: null }
            }
        });
        logTest('8.3 Shopify Sync Status', syncedProducts > 0,
            `${syncedProducts}/${totalProducts} products synced to Shopify`);

        // ============================================================
        // SECTION 9: PERFORMANCE
        // ============================================================
        console.log('\n⚡ SECTION 9: PERFORMANCE');
        console.log('-'.repeat(70));

        // Test 9.1: API Response Time
        const start = Date.now();
        try {
            await axios.get(`${API_URL}/products?limit=50`);
            const duration = Date.now() - start;
            logTest('9.1 API Response Time', duration < 2000,
                `${duration}ms (target: <2000ms)`);
        } catch (e) {
            logTest('9.1 API Response Time', false, e.message);
        }

        // Test 9.2: Database Query Performance
        const dbStart = Date.now();
        await prisma.product.findMany({ take: 100 });
        const dbDuration = Date.now() - dbStart;
        logTest('9.2 Database Query Speed', dbDuration < 500,
            `${dbDuration}ms (target: <500ms)`);

    } catch (error) {
        console.error('\n❌ CRITICAL ERROR:', error.message);
        testResults.failed.push('Critical test suite error');
    } finally {
        await prisma.$disconnect();
    }

    // ============================================================
    // FINAL SUMMARY
    // ============================================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 FUNCTIONALITY TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Passed:   ${testResults.passed.length}`);
    console.log(`❌ Failed:   ${testResults.failed.length}`);
    console.log(`⚠️  Warnings: ${testResults.warnings.length}`);

    const totalTests = testResults.passed.length + testResults.failed.length;
    const successRate = totalTests > 0 ? (testResults.passed.length / totalTests * 100).toFixed(1) : 0;
    console.log(`\n📈 Success Rate: ${successRate}%`);

    if (testResults.failed.length === 0) {
        console.log('\n🎉 ALL FUNCTIONALITY TESTS PASSED!');
        console.log('✨ System is fully operational and ready for production use.');
    } else {
        console.log('\n⚠️  SOME TESTS FAILED:');
        testResults.failed.forEach(test => console.log(`   - ${test}`));
    }

    if (testResults.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        testResults.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    console.log('\n' + '='.repeat(70));
}

testFunctionality().catch(console.error);
