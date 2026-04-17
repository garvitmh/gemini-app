const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

const API_URL = 'http://localhost:3000/api';
const FRONTEND_URL = 'http://localhost:5173';

async function comprehensiveSystemCheck() {
    console.log('🔍 COMPREHENSIVE SYSTEM HEALTH CHECK');
    console.log('='.repeat(60));

    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    // 1. DATABASE CONNECTIVITY
    console.log('\n📊 1. DATABASE CONNECTIVITY');
    try {
        await prisma.$connect();
        const shopCount = await prisma.shop.count();
        console.log(`   ✅ Database connected (${shopCount} shop(s) configured)`);
        results.passed.push('Database connectivity');
    } catch (e) {
        console.log(`   ❌ Database connection failed: ${e.message}`);
        results.failed.push('Database connectivity');
    }

    // 2. BACKEND API HEALTH
    console.log('\n🔧 2. BACKEND API HEALTH');
    try {
        const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
        console.log(`   ✅ Backend API responding (${response.data.status})`);
        results.passed.push('Backend API health');
    } catch (e) {
        console.log(`   ❌ Backend API not responding: ${e.message}`);
        results.failed.push('Backend API health');
    }

    // 3. DATABASE STATUS ENDPOINT
    console.log('\n💾 3. DATABASE STATUS ENDPOINT');
    try {
        const response = await axios.get(`${API_URL}/db-status`, { timeout: 5000 });
        const data = response.data;
        console.log(`   ✅ DB Status: ${data.database}`);
        console.log(`   - Shop: ${data.shopDomain || 'Not configured'}`);
        console.log(`   - Products: ${data.productsCount}`);
        console.log(`   - Metal Rates: ${data.metalRatesCount}`);
        results.passed.push('Database status endpoint');
    } catch (e) {
        console.log(`   ❌ DB Status endpoint failed: ${e.message}`);
        results.failed.push('Database status endpoint');
    }

    // 4. SHOP CONFIGURATION
    console.log('\n🏪 4. SHOP CONFIGURATION');
    try {
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (shop) {
            console.log(`   ✅ Shop: ${shop.domain}`);
            console.log(`   - Access Token: ${shop.accessToken ? 'Configured' : 'Missing'}`);
            if (shop.settings) {
                console.log(`   - Settings: Configured`);
                console.log(`     • Making Charge: ${shop.settings.defaultMakingChargeType} = ${shop.settings.defaultMakingChargeValue}`);
                console.log(`     • GST: ${shop.settings.defaultGstPct}%`);
            } else {
                console.log(`   ⚠️  Settings: Not configured`);
                results.warnings.push('Shop settings not configured');
            }
            results.passed.push('Shop configuration');
        } else {
            console.log(`   ❌ No shop configured`);
            results.failed.push('Shop configuration');
        }
    } catch (e) {
        console.log(`   ❌ Shop check failed: ${e.message}`);
        results.failed.push('Shop configuration');
    }

    // 5. METAL RATES
    console.log('\n💰 5. METAL RATES');
    try {
        const rates = await prisma.metalRate.findMany({ take: 5 });
        console.log(`   ✅ Metal Rates: ${rates.length > 0 ? rates.length + ' configured' : 'None'}`);
        if (rates.length > 0) {
            rates.slice(0, 3).forEach(r => {
                console.log(`     • ${r.metal} ${r.karat ? r.karat + 'K' : ''}: ₹${r.ratePerGram}/g`);
            });
            results.passed.push('Metal rates');
        } else {
            console.log(`   ⚠️  No metal rates configured`);
            results.warnings.push('No metal rates');
        }
    } catch (e) {
        console.log(`   ❌ Metal rates check failed: ${e.message}`);
        results.failed.push('Metal rates');
    }

    // 6. PRODUCTS
    console.log('\n📦 6. PRODUCTS');
    try {
        const totalProducts = await prisma.product.count();
        const productsWithPrice = await prisma.product.count({ where: { currentPrice: { gt: 0 } } });
        const productsWithShopifyId = await prisma.product.count({ where: { shopifyVariantId: { not: null } } });

        console.log(`   ✅ Total Products: ${totalProducts}`);
        console.log(`   - With Prices: ${productsWithPrice}`);
        console.log(`   - Synced to Shopify: ${productsWithShopifyId}`);

        if (totalProducts > 0) {
            results.passed.push('Products');
        } else {
            console.log(`   ⚠️  No products in database`);
            results.warnings.push('No products');
        }
    } catch (e) {
        console.log(`   ❌ Products check failed: ${e.message}`);
        results.failed.push('Products');
    }

    // 7. PRODUCTS API ENDPOINT
    console.log('\n📋 7. PRODUCTS API ENDPOINT');
    try {
        const response = await axios.get(`${API_URL}/products?limit=1`, { timeout: 5000 });
        console.log(`   ✅ Products API responding`);
        console.log(`   - Total: ${response.data.pagination?.total || 0}`);
        results.passed.push('Products API endpoint');
    } catch (e) {
        console.log(`   ❌ Products API failed: ${e.message}`);
        results.failed.push('Products API endpoint');
    }

    // 8. RATES API ENDPOINT
    console.log('\n💎 8. RATES API ENDPOINT');
    try {
        const response = await axios.get(`${API_URL}/rates`, { timeout: 5000 });
        console.log(`   ✅ Rates API responding`);
        console.log(`   - Metal Rates: ${response.data.metalRates?.length || 0}`);
        console.log(`   - Stone Rates: ${response.data.stoneRates?.length || 0}`);
        results.passed.push('Rates API endpoint');
    } catch (e) {
        console.log(`   ❌ Rates API failed: ${e.message}`);
        results.failed.push('Rates API endpoint');
    }

    // 9. PUSH BREAKDOWN ENDPOINT
    console.log('\n🚀 9. PUSH BREAKDOWN ENDPOINT');
    try {
        // Just check if endpoint exists (will fail with 400 for empty productIds, which is expected)
        const response = await axios.post(`${API_URL}/products/push-breakdown`,
            { productIds: [] },
            { timeout: 5000, validateStatus: () => true }
        );
        if (response.status === 400 && response.data.error === 'Product IDs required') {
            console.log(`   ✅ Push Breakdown endpoint responding correctly`);
            results.passed.push('Push breakdown endpoint');
        } else {
            console.log(`   ⚠️  Unexpected response: ${response.status}`);
            results.warnings.push('Push breakdown endpoint behavior');
        }
    } catch (e) {
        console.log(`   ❌ Push Breakdown endpoint failed: ${e.message}`);
        results.failed.push('Push breakdown endpoint');
    }

    // 10. FRONTEND AVAILABILITY
    console.log('\n🌐 10. FRONTEND AVAILABILITY');
    try {
        const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
        console.log(`   ✅ Frontend responding (${response.status})`);
        results.passed.push('Frontend availability');
    } catch (e) {
        console.log(`   ❌ Frontend not responding: ${e.message}`);
        results.failed.push('Frontend availability');
    }

    // 11. GEMSTONE RATES
    console.log('\n💎 11. GEMSTONE RATES');
    try {
        const stoneRates = await prisma.stoneRate.count();
        console.log(`   ${stoneRates > 0 ? '✅' : '⚠️ '} Gemstone Rates: ${stoneRates}`);
        if (stoneRates > 0) {
            results.passed.push('Gemstone rates');
        } else {
            results.warnings.push('No gemstone rates');
        }
    } catch (e) {
        console.log(`   ❌ Gemstone rates check failed: ${e.message}`);
        results.failed.push('Gemstone rates');
    }

    // 12. MAKING GROUPS
    console.log('\n🔨 12. MAKING GROUPS');
    try {
        const makingGroups = await prisma.makingGroup.count();
        console.log(`   ${makingGroups > 0 ? '✅' : '⚠️ '} Making Groups: ${makingGroups}`);
        if (makingGroups > 0) {
            results.passed.push('Making groups');
        } else {
            results.warnings.push('No making groups');
        }
    } catch (e) {
        console.log(`   ❌ Making groups check failed: ${e.message}`);
        results.failed.push('Making groups');
    }

    // SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYSTEM CHECK SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);

    if (results.failed.length === 0) {
        console.log('\n🎉 ALL CRITICAL SYSTEMS OPERATIONAL!');
    } else {
        console.log('\n⚠️  CRITICAL ISSUES DETECTED:');
        results.failed.forEach(item => console.log(`   - ${item}`));
    }

    if (results.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        results.warnings.forEach(item => console.log(`   - ${item}`));
    }

    await prisma.$disconnect();
}

comprehensiveSystemCheck().catch(console.error);
