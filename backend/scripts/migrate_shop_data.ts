import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetDomain = 'daginawala11.myshopify.com';
    const sourceDomain = 'test-shop.myshopify.com';

    const targetShop = await prisma.shop.findUnique({ where: { domain: targetDomain } });
    const sourceShop = await prisma.shop.findUnique({ where: { domain: sourceDomain } });

    if (!targetShop || !sourceShop) {
        console.error('Target or source shop not found.');
        return;
    }

    console.log(`Moving products from ${sourceShop.id} to ${targetShop.id}...`);

    const updateCount = await prisma.product.updateMany({
        where: { shopId: sourceShop.id },
        data: { shopId: targetShop.id }
    });

    console.log(`Updated ${updateCount.count} products.`);

    // Also update Settings if they are missing for the target shop
    const targetSettings = await prisma.shopSettings.findUnique({ where: { shopId: targetShop.id } });
    const sourceSettings = await prisma.shopSettings.findUnique({ where: { shopId: sourceShop.id } });

    if (!targetSettings && sourceSettings) {
        console.log('Migrating settings...');
        await prisma.shopSettings.create({
            data: {
                ...sourceSettings,
                id: undefined, // Let it generate a new one
                shopId: targetShop.id
            }
        });
    }

    // Move Making Groups
    const groupsCount = await prisma.makingGroup.updateMany({
        where: { shopId: sourceShop.id },
        data: { shopId: targetShop.id }
    });
    console.log(`Updated ${groupsCount.count} making groups.`);

    // Move Metal Rates
    const metalCount = await prisma.metalRate.updateMany({
        where: { shopId: sourceShop.id },
        data: { shopId: targetShop.id }
    });
    console.log(`Updated ${metalCount.count} metal rates.`);

    // Move Stone Rates
    const stoneCount = await prisma.stoneRate.updateMany({
        where: { shopId: sourceShop.id },
        data: { shopId: targetShop.id }
    });
    console.log(`Updated ${stoneCount.count} stone rates.`);

    // Move Enamel Rates
    const enamelCount = await prisma.enamelRate.updateMany({
        where: { shopId: sourceShop.id },
        data: { shopId: targetShop.id }
    });
    console.log(`Updated ${enamelCount.count} enamel rates.`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
