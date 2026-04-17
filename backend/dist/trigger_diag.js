"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function testUpdate() {
    const productId = 'cmjdyhafa000a125bmpiz8fon'; // Real ID from DB
    try {
        console.log('--- Triggering Diagnostic Update ---');
        const response = await axios_1.default.put(`http://localhost:3005/api/products/${productId}`, {
            weightGrams: 10,
            metal: 'gold',
            karat: 24
        });
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(response.data, null, 2));
    }
    catch (error) {
        console.error('Update Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
        else {
            console.error('Error:', error.message);
        }
    }
}
testUpdate();
//# sourceMappingURL=trigger_diag.js.map