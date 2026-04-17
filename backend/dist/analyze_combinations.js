"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("--- COMBINATION ANALYSIS ---");
    // Fetch generic fields
    const products = await prisma.product.findMany({
        select: { title: true, metal: true, gemstoneType: true }
    });
    // Strategy: Title + Metal + Gemstone
    const combos = new Set();
    products.forEach(p => {
        // Normalize fields
        const t = p.title ? p.title.trim() : "NoTitle";
        // Metal/Gem might be null
        const m = p.metal ? p.metal.trim() : "NoMetal";
        const g = p.gemstoneType ? p.gemstoneType.trim() : "NoGem";
        const key = `${t} | ${m} | ${g}`;
        combos.add(key);
    });
    console.log(`Unique Combinations (Title + Metal + Gemstone): ${combos.size}`);
    // Sample some keys
    console.log("\nSample Groups:");
    Array.from(combos).slice(0, 20).forEach(c => console.log(c));
    // Also try just Title + Metal
    const tm = new Set(products.map(p => `${p.title} | ${p.metal}`));
    console.log(`\nUnique Combinations (Title + Metal): ${tm.size}`);
    await prisma.$disconnect();
}
main().catch(console.error);
//# sourceMappingURL=analyze_combinations.js.map