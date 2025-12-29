
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shops = await prisma.shop.findMany();
    console.log('--- SHOP DOMAINS ---');
    shops.forEach(s => {
        console.log(`ID: ${s.id} | Domain: ${s.domain}`);
    });
    await prisma.$disconnect();
}

main().catch(console.error);
