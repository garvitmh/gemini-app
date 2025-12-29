
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- STARTING DEEP DATA ANALYSIS ---");

    // 1. Fetch all products (titles only)
    const products = await prisma.product.findMany({
        select: { title: true }
    });

    console.log(`Total Products Fetched: ${products.length}`);

    // 2. Exact Title Uniqueness
    const uniqueTitles = new Set(products.map(p => p.title));
    console.log(`Total Unique Titles: ${uniqueTitles.size}`);

    // 3. Strategy A Analysis (Split First -)
    const groupsA = new Map<string, string[]>();
    products.forEach(p => {
        const parts = p.title.split(' - ');
        const base = parts.length > 0 ? parts[0].trim() : p.title.trim();

        if (!groupsA.has(base)) groupsA.set(base, []);
        groupsA.get(base)?.push(p.title);
    });

    console.log(`\nStrategy A (Split First): ${groupsA.size} groups`);

    // 4. Inspect the Largest Groups
    console.log("\n--- INSPECTING LARGEST 5 GROUPS ---");
    const sortedA = [...groupsA.entries()].sort((a, b) => b[1].length - a[1].length);

    sortedA.slice(0, 5).forEach(([groupName, titles]) => {
        console.log(`\nGROUP: "${groupName}" (Count: ${titles.length})`);
        const examples = titles.slice(0, 5).concat(titles.slice(-5));
        const uniqueExamples = Array.from(new Set(examples));
        uniqueExamples.forEach(t => console.log(`   - ${t}`));
    });

    console.log("\n--- END ANALYSIS ---");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
