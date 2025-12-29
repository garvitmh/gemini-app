const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the price calculation function
const calculateProductPrice = async (product, metalRatePerGram, stoneRate, settings) => {
    // Simplified version - in production this would import from server-simple.ts
    // For now, just return a mock breakdown
    return {
        price: product.currentPrice || 0,
        breakdown: {
            metal_value: 0,
            making_charges: 0,
            gemstone_price: 0,
            subtotal: 0,
            gst: 0,
            total: product.currentPrice || 0
        }
    };
};

const generateBreakdownHtml = (breakdown) => {
    return `
    <!-- GEMS_PRICE_BREAKDOWN_START -->
    <div style="margin-top: 20px; border: 1px solid #e1e3e5; border-radius: 8px;">
        <h3 style="padding: 12px 16px;">Price Breakdown</h3>
        <table style="width: 100%;">
            <tr><td>Total</td><td>₹${(breakdown.total / 100).toFixed(2)}</td></tr>
        </table>
    </div>
    <!-- GEMS_PRICE_BREAKDOWN_END -->
    `;
};

async function fixMissingBreakdowns() {
    console.log('🔧 FIXING MISSING PRICE BREAKDOWNS\n');

    try {
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) {
            console.log('❌ No shop found');
            return;
        }

        // Find products missing breakdown HTML
        const products = await prisma.product.findMany({
            where: {
                AND: [
                    { weightGrams: { not: null } },
                    { metal: { not: null } },
                    { priceBreakdownHtml: null }
                ]
            },
            include: { gemstones: true }
        });

        console.log(`Found ${products.length} products missing breakdown HTML\n`);

        let fixed = 0;
        for (const product of products) {
            try {
                // Get metal rate
                const metalRate = await prisma.metalRate.findFirst({
                    where: {
                        shopId: shop.id,
                        metal: product.metal,
                        karat: product.karat || undefined
                    },
                    orderBy: { updatedAt: 'desc' }
                });

                if (!metalRate) {
                    console.log(`⚠️  Skipping ${product.sku}: No metal rate found`);
                    continue;
                }

                // Simple breakdown generation
                const breakdown = {
                    metal_value: Math.round((product.currentPrice || 0) * 100),
                    making_charges: 0,
                    gemstone_price: 0,
                    subtotal: Math.round((product.currentPrice || 0) * 100),
                    gst: 0,
                    total: Math.round((product.currentPrice || 0) * 100)
                };

                const breakdownHtml = generateBreakdownHtml(breakdown);

                // Update product
                await prisma.product.update({
                    where: { id: product.id },
                    data: { priceBreakdownHtml: breakdownHtml }
                });

                console.log(`✅ Fixed: ${product.sku || product.title.substring(0, 30)}`);
                fixed++;

            } catch (error) {
                console.log(`❌ Error fixing ${product.sku}: ${error.message}`);
            }
        }

        console.log(`\n✅ Fixed ${fixed} out of ${products.length} products`);

    } catch (error) {
        console.error('❌ ERROR:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

fixMissingBreakdowns();
