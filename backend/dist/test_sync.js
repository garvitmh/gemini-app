"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function testSync() {
    try {
        console.log('--- Triggering Product Sync (Forensic Diagnosis) ---');
        // Port 3006 as per diagnostic switch
        const response = await axios_1.default.post('http://localhost:3006/api/products/sync');
        console.log('✅ Sync Response:', response.data);
    }
    catch (error) {
        console.error('❌ Sync Failed:', error.response?.data || error.message);
        console.log('Trying fallback port 3005...');
        try {
            const response = await axios_1.default.post('http://localhost:3005/api/products/sync');
            console.log('✅ Sync Response (3005):', response.data);
        }
        catch (err) {
            console.error('❌ Fallback Failed:', err.response?.data || err.message);
        }
    }
}
testSync();
//# sourceMappingURL=test_sync.js.map