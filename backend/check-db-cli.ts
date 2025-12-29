import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Check ---');
  
  const shops = await prisma.shop.findMany();
  console.log(`Shops: ${shops.length}`);
  for (const shop of shops) {
    console.log(`- ${shop.domain} (id: ${shop.id})`);
    
    const metalRates = await prisma.metalRate.findMany({ where: { shopId: shop.id } });
    console.log(`  Metal Rates: ${metalRates.length}`);
    metalRates.forEach(r => console.log(`    - ${r.metal} ${r.karat || ''}: ${r.ratePerGram}`));

    const stoneRates = await prisma.stoneRate.findMany({ where: { shopId: shop.id } });
    console.log(`  Stone Rates: ${stoneRates.length}`);

    const products = await prisma.product.count({ where: { shopId: shop.id } });
    console.log(`  Products count: ${products}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
