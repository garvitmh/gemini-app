const axios = require('axios');

async function testImport() {
    const csvContent = `SKU,Name,Weight(g),Karat,Metal,StoneWeight(ct),StoneType
INVALID_WEIGHT,Test 1,ABC,22,gold,0.5,diamond
INVALID_KARAT,Test 2,5.5,XYZ,gold,0.5,diamond
UNSUPPORTED_METAL,Test 3,5.5,22,copper,0.5,diamond
MISSING_SKU_ROW,,5.5,22,gold,0.5,diamond
NOT_IN_DB,Test 4,5.5,22,gold,0.5,diamond
`;
    // Note: The MISSING_SKU_ROW case will fail SKU check because the SKU column value is provided as literal "MISSING_SKU_ROW". 
    // Wait, to test missing SKU, I should leave it empty.
    const csvContent2 = `SKU,Name,Weight(g),Karat,Metal,StoneWeight(ct),StoneType
,No SKU Test,5.5,22,gold,0.5,diamond
EXISTING_BUT_WRONG_METAL,Ref,5.5,22,Pluto,0.5,diamond
`;
    const base64Content = Buffer.from(csvContent2).toString('base64');

    try {
        console.log('Sending import request with invalid data...');
        const response = await axios.post('http://localhost:3000/api/products/import', {
            fileData: base64Content,
            fileType: 'csv'
        });

        console.log('Response Status:', response.status);
        console.log('Import Summary:', {
            imported: response.data.imported,
            errors: response.data.errors
        });

        console.log('\nDetailed Errors:');
        response.data.details.errors.forEach((err, i) => {
            console.log(`${i + 1}. SKU: ${err.sku} | Error: ${err.error}`);
        });

    } catch (error) {
        console.error('Test failed:', error.response ? error.response.data : error.message);
    }
}

testImport();
