"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("--- SHOPIFY ID ANALYSIS ---");
    // Fetch shopifyProductId
    const products = await prisma.product.findMany({
        select: { shopifyProductId: true, title: true }
    });
    console.log(`Total Rows: ${products.length}`);
    const uniqueIDs = new Set(products.map(p => p.shopifyProductId));
    console.log(`Unique Shopify Product IDs: ${uniqueIDs.size}`);
    // Check if grouping by Title collapses different IDs
    // Map Title -> Set of IDs
    const titleToIDs = new Map();
    products.forEach(p => {
        if (!titleToIDs.has(p.title))
            titleToIDs.set(p.title, new Set());
        titleToIDs.get(p.title)?.add(p.shopifyProductId);
    });
    // Find titles with >1 ID
    console.log("\n--- TITLES WITH MULTIPLE PRODUCT IDs ---");
    let collisionCount = 0;
    for (const [title, ids] of titleToIDs.entries()) {
        if (ids.size > 1) {
            collisionCount++;
            if (collisionCount <= 10) {
                console.log(`Title "${title}" has ${ids.size} unique Shopify Product IDs.`);
            }
        }
    }
    console.log(`Total Titles with ID Collisions: ${collisionCount}`);
    await prisma.$disconnect();
}
main().catch(console.error);
//# sourceMappingURL=analyze_shopify_ids.js.map