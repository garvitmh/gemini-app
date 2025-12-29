
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- STARTING SKU ANALYSIS ---");

    // 1. Fetch all SKUs
    const products = await prisma.product.findMany({
        select: { sku: true, title: true }
    });

    console.log(`Total SKUs: ${products.length}`);

    // 2. Analyze SKU Prefixes (Split by '-')
    const prefixes = new Map<string, number>();

    products.forEach(p => {
        // Try getting the "Model Number" part
        // Format assumption: CATEGORY-MODEL-VARIANT or similar?
        // Let's try splitting by first hyphen
        const parts = p.sku.split('-');
        let prefix = parts[0];

        // If prefix is very short (e.g. initials), maybe take first TWO parts?
        if (parts.length > 1) {
            // Just test the first token for now
        }

        // Count frequency
        prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
    });

    console.log(`Unique SKU Prefixes (First Token): ${prefixes.size}`);

    // Dump top 20 prefixes
    console.log("\nTop 20 SKU Prefixes:");
    const sortedPrefixes = [...prefixes.entries()].sort((a, b) => b[1] - a[1]);
    sortedPrefixes.slice(0, 20).forEach(([p, count]) => {
        console.log(`  "${p}": ${count} items`);
    });

    // Analyze SKU Prefix vs Title
    // Do different Titles share the same SKU Prefix?
    console.log("\n--- SKU vs TITLE CORRELATION ---");
    // Pick the top prefix
    if (sortedPrefixes.length > 0) {
        const topP = sortedPrefixes[0][0];
        const subset = products.filter(p => p.sku.startsWith(topP));
        const uniqueTitlesInSubset = new Set(subset.map(p => p.title));
        console.log(`Prefix "${topP}" contains ${uniqueTitlesInSubset.size} unique titles.`);
        console.log(`Titles: ${Array.from(uniqueTitlesInSubset).slice(0, 5).join(" | ")}`);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
