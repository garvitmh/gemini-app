"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("--- SIMPLIFIED SKU ANALYSIS ---");
    // Fetch only SKU and Title to avoid potential schema field mismatches
    const products = await prisma.product.findMany({
        select: { sku: true, title: true }
    });
    console.log(`Total items: ${products.length}`);
    // Analyze SKU composition
    // Assumption: SKU is something like "CODE-NUMBER" or "CAT-CODE-NUMBER"
    const prefixes1 = new Map(); // Split by '-' take [0]
    const prefixes2 = new Map(); // Split by '-' take [0]-[1]
    products.forEach(p => {
        if (!p.sku)
            return;
        const parts = p.sku.split('-');
        // 1st token
        const p1 = parts[0] || "UNKNOWN";
        prefixes1.set(p1, (prefixes1.get(p1) || 0) + 1);
        // 1st+2nd token (if exists)
        if (parts.length > 1) {
            const p2 = `${parts[0]}-${parts[1]}`;
            prefixes2.set(p2, (prefixes2.get(p2) || 0) + 1);
        }
    });
    console.log(`Unique Prefixes (Token 1): ${prefixes1.size}`);
    console.log(`Unique Prefixes (Token 1+2): ${prefixes2.size}`);
    console.log("\nTop 10 Prefixes (Token 1):");
    [...prefixes1.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    console.log("\nTop 10 Prefixes (Token 1+2):");
    [...prefixes2.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    await prisma.$disconnect();
}
main().catch(console.error);
//# sourceMappingURL=inspect_skus.js.map