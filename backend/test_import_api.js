const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testImport() {
    console.log('=== Testing Product Import ===\n');

    // Read the test CSV file
    const csvPath = path.join(__dirname, 'test_import_single.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    console.log('CSV Content:');
    console.log(csvContent);
    console.log('\n');

    // Convert to base64
    const base64Content = Buffer.from(csvContent).toString('base64');

    try {
        console.log('Sending import request to http://localhost:3000/api/products/import...\n');

        const response = await axios.post('http://localhost:3000/api/products/import', {
            fileData: base64Content,
            fileType: 'csv'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Import Response:');
        console.log(JSON.stringify(response.data, null, 2));

        console.log('\n=== Check backend logs for [IMPORT] messages ===');
        console.log('Run: Get-Content backend.log -Tail 50');

    } catch (error) {
        console.error('❌ Import failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testImport();
