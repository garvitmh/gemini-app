const axios = require('axios');

async function verifyTemplates() {
    try {
        console.log('--- Verifying Detailing (50+ Col) Template Endpoint ---');
        const templateRes = await axios.get('http://localhost:3000/api/products/template?format=csv');
        console.log('Template Header Preview:', templateRes.data.split('\n')[0].substring(0, 100) + '...');

        console.log('\n--- Verifying Detailing (50+ Col) Export Endpoint ---');
        const exportRes = await axios.get('http://localhost:3000/api/products/export?format=csv');
        console.log('Export Header Preview:', exportRes.data.split('\n')[0].substring(0, 100) + '...');

        const expectedStart = 'SKU,Title,Status,Collection,Metal Type,Metal Purity,Metal Weight (g),Gross Weight (g)';

        if (templateRes.data.startsWith(expectedStart) && exportRes.data.startsWith(expectedStart)) {
            console.log('\n✅ Verification SUCCESS: Both endpoints align with the DETAILING format.');
        } else {
            console.log('\n❌ Verification FAILURE: Headers do not match.');
            console.log('Expected start:', expectedStart);
            console.log('Actual start:', templateRes.data.substring(0, 80));
        }

    } catch (error) {
        console.error('Verification failed:', error.message);
    }
}

verifyTemplates();
