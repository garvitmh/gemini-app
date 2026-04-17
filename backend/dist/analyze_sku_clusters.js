"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("--- SKU CLUSTER ANALYSIS ---");
    // Target the specific problematic group
    const targetTitle = "Bracelet- Cubic Zirconia 18K Gold";
    // Fetch all SKUs for this title
    const products = await prisma.product.findMany({
        where: { title: targetTitle },
        select: { sku: true }
    });
    console.log(`Analyzing Title: "${targetTitle}"`);
    console.log(`Total Products: ${products.length}`);
    // Dump all SKUs sorted to see patterns
    const skus = products.map(p => p.sku).sort();
    // Print first 50
    console.log("\nSample SKUs (First 50):");
    skus.slice(0, 50).forEach(s => console.log(s));
    // Try to find common prefixes within this group
    const prefixes = new Map();
    skus.forEach(s => {
        if (!s)
            return; // Skip null/undefined SKUs
        // dynamic split
        const parts = s.split(/[-_ ]/); // Split by hyphen, underscore, or space
        if (parts.length > 1) {
            const p = parts[0] + "-" + parts[1];
            prefixes.set(p, (prefixes.get(p) || 0) + 1);
        }
        else {
            prefixes.set(s, (prefixes.get(s) || 0) + 1);
        }
    });
    console.log("\nPotential Sub-Groups (Token 1+2):");
    [...prefixes.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => console.log(`  "${k}": ${v} items`));
    await prisma.$disconnect();
}
main().catch(console.error);
//# sourceMappingURL=analyze_sku_clusters.js.map