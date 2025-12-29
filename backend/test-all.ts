import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

interface TestResult {
    test: string;
    status: 'PASS' | 'FAIL';
    details?: string;
}

const results: TestResult[] = [];

async function runTests() {
    console.log('🧪 Gemini App - Complete Functionality Test\n');
    console.log('='.repeat(60));

    // Test 1: Health Check
    console.log('\n1️⃣ Testing Health Check...');
    try {
        const res = await axios.get(`${BASE_URL}/health`);
        results.push({ test: 'Health Check', status: 'PASS', details: res.data.status });
        console.log(`   ✅ PASS - Status: ${res.data.status}`);
    } catch (err: any) {
        results.push({ test: 'Health Check', status: 'FAIL', details: err.message });
        console.log(`   ❌ FAIL - ${err.message}`);
    }

    // Test 2: Database Status
    console.log('\n2️⃣ Testing Database Status...');
    try {
        const res = await axios.get(`${BASE_URL}/db-status`);
        results.push({ test: 'Database Status', status: 'PASS', details: `${res.data.productsCount} products, ${res.data.metalRatesCount} rates` });
        console.log(`   ✅ PASS`);
        console.log(`      - Shop: ${res.data.shopDomain}`);
        console.log(`      - Products: ${res.data.productsCount}`);
        console.log(`      - Metal Rates: ${res.data.metalRatesCount}`);
        console.log(`      - Shopify Credentials: ${res.data.hasShopifyCredentials ? 'Yes' : 'No'}`);
    } catch (err: any) {
        results.push({ test: 'Database Status', status: 'FAIL', details: err.message });
        console.log(`   ❌ FAIL - ${err.message}`);
    }

    // Test 3: Get Rates
    console.log('\n3️⃣ Testing Rates Endpoint...');
    try {
        const res = await axios.get(`${BASE_URL}/rates`);
        results.push({ test: 'Get Rates', status: 'PASS', details: `${res.data.metalRates.length} metal rates, ${res.data.stoneRates.length} stone rates` });
        console.log(`   ✅ PASS`);
        console.log(`      - Metal Rates: ${res.data.metalRates.length}`);
        console.log(`      - Stone Rates: ${res.data.stoneRates.length}`);
    } catch (err: any) {
        results.push({ test: 'Get Rates', status: 'FAIL', details: err.message });
        console.log(`   ❌ FAIL - ${err.message}`);
    }

    // Test 4: Get Products (paginated)
    console.log('\n4️⃣ Testing Products Endpoint...');
    try {
        const res = await axios.get(`${BASE_URL}/products`, { params: { page: 1, limit: 5 } });
        results.push({ test: 'Get Products', status: 'PASS', details: `${res.data.pagination.total} total products` });
        console.log(`   ✅ PASS`);
        console.log(`      - Total Products: ${res.data.pagination.total}`);
        console.log(`      - Fetched: ${res.data.products.length}`);
        if (res.data.products.length > 0) {
            console.log(`      - Sample: ${res.data.products[0].title}`);
        }
    } catch (err: any) {
        results.push({ test: 'Get Products', status: 'FAIL', details: err.message });
        console.log(`   ❌ FAIL - ${err.message}`);
    }

    // Test 5: Get Settings
    console.log('\n5️⃣ Testing Settings Endpoint...');
    try {
        const res = await axios.get(`${BASE_URL}/settings`);
        results.push({ test: 'Get Settings', status: 'PASS', details: 'Settings retrieved' });
        console.log(`   ✅ PASS`);
        if (res.data.settings) {
            console.log(`      - Making Charge: ₹${res.data.settings.defaultMakingPerGram}/g`);
            console.log(`      - Wastage: ${res.data.settings.defaultWastagePct}%`);
            console.log(`      - GST: ${res.data.settings.defaultGstPct}%`);
        }
    } catch (err: any) {
        results.push({ test: 'Get Settings', status: 'FAIL', details: err.message });
        console.log(`   ❌ FAIL - ${err.message}`);
    }

    // Test 6: Get Audit Logs
    console.log('\n6️⃣ Testing Audit Logs Endpoint...');
    try {
        const res = await axios.get(`${BASE_URL}/audit`, { params: { page: 1, limit: 5 } });
        results.push({ test: 'Get Audit Logs', status: 'PASS', details: `${res.data.pagination.total} logs` });
        console.log(`   ✅ PASS - ${res.data.pagination.total} audit logs`);
    } catch (err: any) {
        results.push({ test: 'Get Audit Logs', status: 'FAIL', details: err.message });
        console.log(`   ❌ FAIL - ${err.message}`);
    }

    // Test 7: Get Price History
    console.log('\n7️⃣ Testing Price History Endpoint...');
    try {
        const res = await axios.get(`${BASE_URL}/audit/history`, { params: { page: 1, limit: 5 } });
        results.push({ test: 'Get Price History', status: 'PASS', details: `${res.data.pagination.total} history records` });
        console.log(`   ✅ PASS - ${res.data.pagination.total} history records`);
    } catch (err: any) {
        results.push({ test: 'Get Price History', status: 'FAIL', details: err.message });
        console.log(`   ❌ FAIL - ${err.message}`);
    }

    // Test 8: Frontend Accessibility
    console.log('\n8️⃣ Testing Frontend Server...');
    try {
        const res = await axios.get('http://localhost:5173', { timeout: 5000 });
        results.push({ test: 'Frontend Server', status: 'PASS', details: 'Accessible' });
        console.log(`   ✅ PASS - Frontend accessible`);
    } catch (err: any) {
        results.push({ test: 'Frontend Server', status: 'FAIL', details: err.message });
        console.log(`   ❌ FAIL - ${err.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST SUMMARY\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    console.log('\n📋 DETAILED RESULTS:\n');
    results.forEach((r, i) => {
        const icon = r.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${i + 1}. ${r.test}: ${r.status}`);
        if (r.details) {
            console.log(`   ${r.details}`);
        }
    });

    console.log('\n' + '='.repeat(60));

    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! Website is fully functional!');
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed. Please review above.`);
    }
}

runTests().catch(console.error);
