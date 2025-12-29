// API Endpoint Test Script
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testEndpoints() {
    console.log('🧪 TESTING API ENDPOINTS\n');

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`✅ ${name}`);
            results.passed++;
            results.tests.push({ name, status: 'passed' });
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
            results.failed++;
            results.tests.push({ name, status: 'failed', error: error.message });
        }
    };

    // Test 1: Health Check
    await test('Health Check', async () => {
        const res = await axios.get(`${BASE_URL}/health`);
        if (res.data.status !== 'ok') throw new Error('Health check failed');
    });

    // Test 2: Database Status
    await test('Database Status', async () => {
        const res = await axios.get(`${BASE_URL}/db-status`);
        if (res.data.database !== 'connected') throw new Error('DB not connected');
    });

    // Test 3: Get Rates
    await test('Get Rates', async () => {
        const res = await axios.get(`${BASE_URL}/rates`);
        if (!res.data.metalRates) throw new Error('No metal rates returned');
    });

    // Test 4: Get Products
    await test('Get Products', async () => {
        const res = await axios.get(`${BASE_URL}/products?page=1&limit=10`);
        if (!Array.isArray(res.data.products)) throw new Error('Products not array');
    });

    // Test 5: Template Download
    await test('Template Download', async () => {
        const res = await axios.get(`${BASE_URL}/products/template?format=xlsx`, {
            responseType: 'arraybuffer'
        });
        if (res.data.byteLength === 0) throw new Error('Empty template');
    });

    // Test 6: Export Products
    await test('Export Products', async () => {
        const res = await axios.get(`${BASE_URL}/products/export?format=csv`, {
            responseType: 'text'
        });
        if (typeof res.data !== 'string') throw new Error('Export failed');
    });

    console.log('\n📊 RESULTS');
    console.log('─'.repeat(50));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`Total: ${results.passed + results.failed}`);

    if (results.failed > 0) {
        console.log('\n⚠️  Failed Tests:');
        results.tests.filter(t => t.status === 'failed').forEach(t => {
            console.log(`   - ${t.name}: ${t.error}`);
        });
    }
}

testEndpoints().catch(err => {
    console.error('Test suite error:', err.message);
});
