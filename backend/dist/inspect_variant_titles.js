"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("--- VARIANT TITLE ANALYSIS ---");
    const products = await prisma.product.findMany({
        where: { title: "Bracelet- Cubic Zirconia 18K Gold" },
        select: { title: true, variantTitle: true, sku: true },
        take: 20
    });
    console.log(`Checking 20 items from "Bracelet- Cubic Zirconia 18K Gold"`);
    products.forEach(p => {
        console.log(`Title: "${p.title}" | Variant: "${p.variantTitle}" | SKU: "${p.sku}"`);
    });
    // Count unique variants
    const allVariants = await prisma.product.groupBy({
        by: ['variantTitle'],
        _count: true
    });
    console.log(`\nTotal Unique Variant Titles in DB: ${allVariants.length}`);
    await prisma.$disconnect();
}
main().catch(console.error);
//# sourceMappingURL=inspect_variant_titles.js.map