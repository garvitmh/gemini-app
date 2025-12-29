import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

console.log('🔍 Gemini Desktop App - Diagnostic Check\n');
console.log('='.repeat(60));

async function runDiagnostics() {
    const results = {
        database: false,
        shopRecord: false,
        settings: false,
        shopifyConnection: false,
        productsCount: 0,
        ratesCount: 0
    };

    // 1. Check if database file exists
    console.log('\n📊 Checking Database...');
    try {
        await prisma.$connect();
        console.log('✅ Database connection successful');
        results.database = true;
    } catch (error: any) {
        console.log('❌ Database connection failed:', error.message);
        return results;
    }

    // 2. Check Shop record
    console.log('\n🏪 Checking Shop Record...');
    try {
        const shop = await prisma.shop.findFirst();
        if (shop) {
            console.log('✅ Shop record found');
            console.log(`   Domain: ${shop.domain}`);
            console.log(`   Active: ${shop.isActive}`);
            results.shopRecord = true;

            // 3. Check Settings
            console.log('\n⚙️  Checking Settings...');
            const settings = await prisma.shopSettings.findUnique({
                where: { shopId: shop.id }
            });
            if (settings) {
                console.log('✅ Settings found');
                console.log(`   Making Charge: ₹${settings.defaultMakingPerGram}/g`);
                console.log(`   Wastage: ${settings.defaultWastagePct}%`);
                console.log(`   GST: ${settings.defaultGstPct}%`);
                results.settings = true;
            } else {
                console.log('❌ Settings not found');
            }

            // 4. Check Products
            console.log('\n📦 Checking Products...');
            const productsCount = await prisma.product.count({
                where: { shopId: shop.id }
            });
            console.log(`   Total products: ${productsCount}`);
            results.productsCount = productsCount;

            if (productsCount > 0) {
                const productsWithDetails = await prisma.product.count({
                    where: {
                        shopId: shop.id,
                        weightGrams: { not: null },
                        metal: { not: null }
                    }
                });
                console.log(`   Products with metal/weight data: ${productsWithDetails}`);
            }

            // 5. Check Metal Rates
            console.log('\n💰 Checking Metal Rates...');
            const metalRates = await prisma.metalRate.findMany({
                where: { shopId: shop.id },
                orderBy: { updatedAt: 'desc' }
            });
            results.ratesCount = metalRates.length;

            if (metalRates.length > 0) {
                console.log(`✅ Found ${metalRates.length} metal rates:`);
                metalRates.forEach(rate => {
                    console.log(`   ${rate.metal} ${rate.karat ? rate.karat + 'K' : ''}: ₹${rate.ratePerGram}/g`);
                });
            } else {
                console.log('⚠️  No metal rates found - you need to set rates first');
            }

            // 6. Check Stone Rates
            console.log('\n💎 Checking Stone Rates...');
            const stoneRates = await prisma.stoneRate.findMany({
                where: { shopId: shop.id },
                orderBy: { updatedAt: 'desc' },
                take: 5
            });

            if (stoneRates.length > 0) {
                console.log(`✅ Found ${stoneRates.length} stone rates (showing first 5):`);
                stoneRates.forEach(rate => {
                    const price = rate.ratePerCarat ? `₹${rate.ratePerCarat}/ct` : `₹${rate.ratePerPiece}/piece`;
                    console.log(`   ${rate.stoneType}: ${price}`);
                });
            } else {
                console.log('⚠️  No stone rates found');
            }
        } else {
            console.log('❌ No shop record found - database needs initialization');
        }
    } catch (error: any) {
        console.log('❌ Error checking shop:', error.message);
    }

    // 7. Check Shopify Connection
    console.log('\n🌐 Checking Shopify Connection...');
    const shopifyStore = process.env.SHOPIFY_STORE;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shopifyStore || !shopifyToken) {
        console.log('⚠️  Shopify credentials not configured');
        console.log(`   SHOPIFY_STORE: ${shopifyStore || 'NOT SET'}`);
        console.log(`   SHOPIFY_ACCESS_TOKEN: ${shopifyToken ? 'SET' : 'NOT SET'}`);
    } else {
        try {
            const response = await axios.get(
                `https://${shopifyStore}/admin/api/2024-01/shop.json`,
                {
                    headers: {
                        'X-Shopify-Access-Token': shopifyToken,
                    },
                    timeout: 10000,
                }
            );
            console.log('✅ Shopify connection successful');
            console.log(`   Shop: ${response.data.shop.name}`);
            results.shopifyConnection = true;
        } catch (error: any) {
            console.log('❌ Shopify connection failed:', error.response?.status || error.message);
            if (error.response?.status === 401) {
                console.log('   → Invalid access token');
            } else if (error.response?.status === 404) {
                console.log('   → Shop not found');
            }
        }
    }

    // 8. Check Backend Server
    console.log('\n🚀 Checking Backend Server...');
    try {
        const response = await axios.get('http://localhost:3000/api/health', {
            timeout: 5000
        });
        console.log('✅ Backend server is running');
        console.log(`   Status: ${response.data.status}`);
    } catch (error: any) {
        console.log('⚠️  Backend server check failed');
        console.log('   Make sure to run: npm run dev');
    }

    await prisma.$disconnect();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 SUMMARY\n');
    console.log(`Database: ${results.database ? '✅' : '❌'}`);
    console.log(`Shop Record: ${results.shopRecord ? '✅' : '❌'}`);
    console.log(`Settings: ${results.settings ? '✅' : '❌'}`);
    console.log(`Products Synced: ${results.productsCount}`);
    console.log(`Metal Rates Set: ${results.ratesCount}`);
    console.log(`Shopify Connection: ${results.shopifyConnection ? '✅' : '⚠️'}`);

    console.log('\n💡 RECOMMENDATIONS:\n');
    if (!results.shopRecord) {
        console.log('1. Run the setup script: .\\setup-desktop.ps1');
    }
    if (results.productsCount === 0) {
        console.log('2. Sync products from Shopify in the web interface');
    }
    if (results.ratesCount === 0) {
        console.log('3. Set metal rates in the Rates page');
    }
    if (!results.shopifyConnection) {
        console.log('4. Verify Shopify credentials in backend\\.env');
    }

    console.log('\n' + '='.repeat(60));
}

runDiagnostics().catch(console.error);
