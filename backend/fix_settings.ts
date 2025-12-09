
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shop = await prisma.shop.findFirst({ include: { settings: true } });
    if (!shop) {
        console.log('No shop found');
        return;
    }

    console.log('Updating settings for shop:', shop.id);

    // Update or Create settings
    // If settings exist, update. If not, create.
    if (shop.settings) {
        await prisma.shopSettings.update({
            where: { id: shop.settings.id },
            data: {
                defaultMakingPerGram: 1500,
                defaultWastagePct: 2.0,
                defaultGstPct: 3.0,
                defaultDiscount: 0,
            },
        });
        console.log('✅ Updated existing settings.');
    } else {
        await prisma.shopSettings.create({
            data: {
                shopId: shop.id,
                defaultMakingPerGram: 1500,
                defaultWastagePct: 2.0,
                defaultGstPct: 3.0,
                defaultDiscount: 0,
            },
        });
        console.log('✅ Created new settings.');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
