require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addGemstones() {
    console.log('\n💎 Adding Gemstone Types...\n');

    try {
        const shop = await prisma.shop.findFirst();

        if (!shop) {
            console.log('❌ No shop found. Please run the app first.');
            return;
        }

        const gemstones = [
            { name: 'Ruby (Manik)', type: 'ruby', defaultRate: 150000 },
            { name: 'Diamond (Heera)', type: 'diamond', defaultRate: 250000 },
            { name: 'Pearl (Moti)', type: 'pearl', defaultRate: 50000 },
            { name: 'Black Beeds', type: 'black_beeds', defaultRate: 5000 },
            { name: 'Yellow Sapphire (Pukhraj)', type: 'yellow_sapphire', defaultRate: 120000 },
            { name: 'Blue Sapphire (Neelam)', type: 'blue_sapphire', defaultRate: 150000 },
            { name: 'Emerald (Panna)', type: 'emerald', defaultRate: 180000 },
            { name: 'Red Coral (Moonga)', type: 'red_coral', defaultRate: 30000 },
            { name: 'Cat\'s Eye (Lehsunia)', type: 'cats_eye', defaultRate: 80000 },
            { name: 'Hessonite (Gomed)', type: 'hessonite', defaultRate: 60000 },
            { name: 'Opal', type: 'opal', defaultRate: 40000 },
            { name: 'Garnet', type: 'garnet', defaultRate: 25000 },
            { name: 'Aquamarine', type: 'aquamarine', defaultRate: 70000 },
            { name: 'Topaz', type: 'topaz', defaultRate: 35000 },
            { name: 'Navratan', type: 'navratan', defaultRate: 100000 },
            { name: 'Mother of Pearl', type: 'mother_of_pearl', defaultRate: 15000 },
            { name: 'Moissanite', type: 'moissanite', defaultRate: 200000 },
            { name: 'CZ Cubic Zirconia', type: 'cz', defaultRate: 1000 }
        ];

        let added = 0;
        let skipped = 0;

        for (const gem of gemstones) {
            // Check if already exists
            const existing = await prisma.stoneRate.findFirst({
                where: {
                    shopId: shop.id,
                    stoneType: gem.type
                }
            });

            if (existing) {
                console.log(`⏭️  ${gem.name} - Already exists`);
                skipped++;
            } else {
                await prisma.stoneRate.create({
                    data: {
                        shopId: shop.id,
                        stoneType: gem.type,
                        ratePerCarat: gem.defaultRate,
                        ratePerPiece: null,
                        reason: 'Added via gemstone setup script'
                    }
                });
                console.log(`✅ ${gem.name} - Added (₹${gem.defaultRate}/ct)`);
                added++;
            }
        }

        console.log('\n' + '─'.repeat(60));
        console.log(`✅ Added: ${added} gemstones`);
        console.log(`⏭️  Skipped: ${skipped} (already exist)`);
        console.log(`📊 Total: ${gemstones.length} gemstone types`);
        console.log('─'.repeat(60));
        console.log('\n💡 You can now configure rates for each gemstone in the Rates page');
        console.log('   with different cuts, colors, clarities, and carat ranges.\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

addGemstones();
