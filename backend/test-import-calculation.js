const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');

const prisma = new PrismaClient();

async function testImportPriceCalculation() {
    console.log('🧪 TESTING IMPORT PRICE CALCULATION');
    console.log('='.repeat(60));

    try {
        // 1. Find a test product
        const product = await prisma.product.findFirst({
            where: {
                weightGrams: { gt: 0 }
            },
            include: { gemstones: true }
        });

        if (!product) {
            console.log('❌ No test product found');
            return;
        }

        console.log(`\n📦 Test Product: ${product.sku}`);
        console.log(`   Current Price: ₹${product.currentPrice}`);
        console.log(`   Weight: ${product.weightGrams}g`);
        console.log(`   Metal: ${product.metal} ${product.karat}K`);

        // 2. Create a test Excel file
        const testData = [{
            'SKU': product.sku,
            'Status': product.status,
            'Metal Type': product.metal,
            'Metal Purity': product.karat,
            'Metal Weight (g)': product.weightGrams + 0.1, // Slight change
            'Gross Weight (g)': product.grossGoldWeight + 0.1,
            'Wastage %': product.wastagePct,
            'GST %': product.gstPct,
            'Discount Type': product.discountType,
            'Discount Value': product.discount,
            'Enamel Color': product.enamelColor || '',
            'Enamel Weight (g)': product.enamelWeightGrams || 0,
            'Enamel Discount Type': product.enamelDiscountType || 'none',
            'Enamel Discount Value': product.enamelDiscountValue || 0,
            'Stone 1: Used': 'FALSE',
            'Stone 2: Used': 'FALSE',
            'Stone 3: Used': 'FALSE'
        }];

        const worksheet = XLSX.utils.json_to_sheet(testData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const base64Data = excelBuffer.toString('base64');

        console.log(`\n📄 Created test Excel with weight: ${product.weightGrams + 0.1}g`);

        // 3. Simulate the import API call
        const axios = require('axios');

        console.log(`\n📡 Calling POST /api/products/import...`);

        try {
            // Note: This will fail without proper authentication
            // We're just testing to see the error
            const response = await axios.post('http://localhost:3000/api/products/import', {
                fileData: base64Data,
                fileType: 'xlsx'
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log(`\n✅ IMPORT SUCCESSFUL!`);
            console.log(`   Imported: ${response.data.imported}`);
            console.log(`   Errors: ${response.data.errors}`);

            // 4. Check the product price in database
            const updatedProduct = await prisma.product.findUnique({
                where: { id: product.id }
            });

            console.log(`\n🔍 Database Check:`);
            console.log(`   Old Price: ₹${product.currentPrice}`);
            console.log(`   New Price: ₹${updatedProduct.currentPrice}`);
            console.log(`   Price Changed: ${updatedProduct.currentPrice !== product.currentPrice ? 'Yes ✅' : 'No ❌'}`);
            console.log(`   New Weight: ${updatedProduct.weightGrams}g`);

        } catch (apiError) {
            console.log(`\n⚠️  API ERROR: ${apiError.message}`);
            if (apiError.response) {
                console.log(`   Status: ${apiError.response.status}`);
                console.log(`   Error: ${JSON.stringify(apiError.response.data, null, 2)}`);
            }

            console.log(`\n💡 This is expected - the import endpoint requires authentication.`);
            console.log(`   Please test by uploading the Excel file through the UI.`);
        }

    } catch (error) {
        console.error('\n❌ TEST ERROR:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testImportPriceCalculation();
