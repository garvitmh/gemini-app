const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestImportFile() {
    console.log('📄 Creating Test Import Excel File...\n');

    try {
        // Get a few products from database
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            console.log('❌ No shop found');
            return;
        }

        const products = await prisma.product.findMany({
            where: {
                shopId: shop.id,
                sku: { not: null }
            },
            take: 3,
            include: { gemstones: true }
        });

        if (products.length === 0) {
            console.log('❌ No products found');
            return;
        }

        console.log(`Found ${products.length} products to include in test file\n`);

        // Create Excel data
        const excelData = products.map(p => ({
            'SKU': p.sku,
            'Title': p.title,
            'Status': 'active',
            'Collection': '',
            'Metal Type': 'gold',
            'Metal Purity': '22',
            'Metal Weight (g)': 10.5,
            'Metal Weight Gross (g)': 11.0,
            'Wastage %': 2,
            'Gemstone Weight (ct)': 1.25,
            'Gemstone Pieces': 1,
            'Stone 1: Used': 'FALSE',
            'Stone 1: Type': '',
            'Stone 1: Shape': '',
            'Stone 1: Quality': '',
            'Stone 1: Color': '',
            'Stone 1: Clarity': '',
            'Stone 1: Cut': '',
            'Stone 1: Weight (ct)': '',
            'Stone 1: Pieces': '',
            'Stone 1: Rate Type': '',
            'Stone 1: Rate Value': '',
            'Stone 1: Custom': '',
            'Stone 2: Used': 'FALSE',
            'Stone 2: Type': '',
            'Stone 2: Shape': '',
            'Stone 2: Quality': '',
            'Stone 2: Color': '',
            'Stone 2: Clarity': '',
            'Stone 2: Cut': '',
            'Stone 2: Weight (ct)': '',
            'Stone 2: Pieces': '',
            'Stone 2: Rate Type': '',
            'Stone 2: Rate Value': '',
            'Stone 2: Custom': '',
            'Stone 3: Used': 'FALSE',
            'Stone 3: Type': '',
            'Stone 3: Shape': '',
            'Stone 3: Quality': '',
            'Stone 3: Color': '',
            'Stone 3: Clarity': '',
            'Stone 3: Cut': '',
            'Stone 3: Weight (ct)': '',
            'Stone 3: Pieces': '',
            'Stone 3: Rate Type': '',
            'Stone 3: Rate Value': '',
            'Stone 3: Custom': '',
            'Enamel Color': '',
            'Enamel Weight (g)': '',
            'Enamel Discount Type': 'none',
            'Enamel Discount Value': 0,
            'Discount Type': 'flat',
            'Discount Value': 0,
            'GST %': 3
        }));

        // Create workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

        // Save file
        const filename = 'test_import_with_data.xlsx';
        XLSX.writeFile(workbook, filename);

        console.log(`✅ Created test file: ${filename}`);
        console.log(`\nFile contains ${excelData.length} products with:`);
        console.log(`  - Metal Type: gold`);
        console.log(`  - Metal Purity: 22K`);
        console.log(`  - Metal Weight: 10.5g`);
        console.log(`  - Wastage: 2%`);
        console.log(`  - GST: 3%`);
        console.log(`\nYou can now import this file to test the price calculation and Shopify sync.`);
        console.log(`\nExpected behavior:`);
        console.log(`  1. Prices will be calculated based on gold 22K rate`);
        console.log(`  2. Breakdown will be generated and stored in database`);
        console.log(`  3. Price and breakdown will be pushed to Shopify`);
        console.log(`  4. Check Shopify product metafield 'custom.price_breakdown' for HTML`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createTestImportFile();
