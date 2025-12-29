import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixShopSettings() {
    try {
        console.log('🔧 Fixing shop settings...');

        // Get the first shop
        const shop = await prisma.shop.findFirst();

        if (!shop) {
            console.log('❌ No shop found');
            return;
        }

        console.log(`✅ Found shop: ${shop.domain}`);

        // Check if settings exist
        let settings = await prisma.shopSettings.findUnique({
            where: { shopId: shop.id }
        });

        if (!settings) {
            // Create settings with defaults
            console.log('📝 Creating new shop settings with defaults...');
            settings = await prisma.shopSettings.create({
                data: {
                    shopId: shop.id,
                    defaultMakingChargeType: 'per_gram',
                    defaultMakingChargeValue: 1500,
                    defaultWastagePct: 2,
                    defaultGstPct: 3,
                    defaultDiscount: 0,
                    defaultMetalDiscountType: 'none',
                    defaultMetalDiscountValue: 0,
                    defaultMakingDiscountType: 'none',
                    defaultMakingDiscountValue: 0,
                    defaultGemstoneDiscountType: 'none',
                    defaultGemstoneDiscountValue: 0,
                    defaultEnamelDiscountType: 'none',
                    defaultEnamelDiscountValue: 0,
                }
            });
            console.log('✅ Settings created successfully!');
        } else {
            // Update existing settings to ensure defaults are set
            console.log('📝 Updating existing shop settings...');
            settings = await prisma.shopSettings.update({
                where: { shopId: shop.id },
                data: {
                    defaultMakingChargeType: settings.defaultMakingChargeType || 'per_gram',
                    defaultMakingChargeValue: settings.defaultMakingChargeValue ?? 1500,
                    defaultWastagePct: settings.defaultWastagePct ?? 2,
                    defaultGstPct: settings.defaultGstPct ?? 3,
                    defaultDiscount: settings.defaultDiscount ?? 0,
                    defaultMetalDiscountType: settings.defaultMetalDiscountType || 'none',
                    defaultMetalDiscountValue: settings.defaultMetalDiscountValue ?? 0,
                    defaultMakingDiscountType: settings.defaultMakingDiscountType || 'none',
                    defaultMakingDiscountValue: settings.defaultMakingDiscountValue ?? 0,
                    defaultGemstoneDiscountType: settings.defaultGemstoneDiscountType || 'none',
                    defaultGemstoneDiscountValue: settings.defaultGemstoneDiscountValue ?? 0,
                    defaultEnamelDiscountType: settings.defaultEnamelDiscountType || 'none',
                    defaultEnamelDiscountValue: settings.defaultEnamelDiscountValue ?? 0,
                }
            });
            console.log('✅ Settings updated successfully!');
        }

        console.log('\n📊 Current Settings:');
        console.log(`  Making Charge Type: ${settings.defaultMakingChargeType}`);
        console.log(`  Making Charge Value: ₹${settings.defaultMakingChargeValue}`);
        console.log(`  Wastage: ${settings.defaultWastagePct}%`);
        console.log(`  GST: ${settings.defaultGstPct}%`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixShopSettings();
