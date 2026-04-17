"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function main() {
    try {
        const id = 'cmjwtn3640012tubhbq2dmkr4';
        const url = `http://localhost:3005/api/products/${id}/price-breakdown`;
        const res = await axios_1.default.get(url);
        console.log(JSON.stringify(res.data, null, 2));
    }
    catch (e) {
        console.error(e.message);
    }
}
main();
//# sourceMappingURL=fetch_breakdown.js.map