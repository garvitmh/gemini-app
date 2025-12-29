import axios from 'axios';

async function testSync() {
    try {
        console.log('--- Triggering Product Sync (Forensic Diagnosis) ---');
        // Port 3006 as per diagnostic switch
        const response = await axios.post('http://localhost:3006/api/products/sync');
        console.log('✅ Sync Response:', response.data);
    } catch (error: any) {
        console.error('❌ Sync Failed:', error.response?.data || error.message);
        console.log('Trying fallback port 3005...');
        try {
            const response = await axios.post('http://localhost:3005/api/products/sync');
            console.log('✅ Sync Response (3005):', response.data);
        } catch (err: any) {
            console.error('❌ Fallback Failed:', err.response?.data || err.message);
        }
    }
}

testSync();
