"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const shops = await prisma.shop.findMany();
    console.log('--- SHOP DOMAINS ---');
    shops.forEach(s => {
        console.log(`ID: ${s.id} | Domain: ${s.domain}`);
    });
    await prisma.$disconnect();
}
main().catch(console.error);
//# sourceMappingURL=dump_shops.js.map