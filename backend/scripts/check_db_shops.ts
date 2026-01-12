import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DATABASE SHOPS ---');
    const shops = await prisma.shop.findMany();
    shops.forEach(s => {
        console.log(`ID: ${s.id}`);
        console.log(`Domain: ${s.domain}`);
        console.log(`Token Prefix: ${s.accessToken ? s.accessToken.substring(0, 10) + '...' : 'NONE'}`);
        console.log('---------------------');
    });

    console.log('\n--- SETTINGS ---');
    const settings = await prisma.shopSettings.findFirst();
    console.log('Settings Found:', !!settings);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
