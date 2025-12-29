// Apply settings to all products
app.post('/api/settings/apply-to-all', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop || !shop.settings) {
            return res.status(404).json({ error: 'Shop or settings not found' });
        }

        const settings = shop.settings;

        // Get all products with weight and metal
        const products = await prisma.product.findMany({
            where: {
                shopId: shop.id,
                weightGrams: { not: null },
                metal: { not: null }
            },
            include: { gemstones: true }
        });

        console.log(`\n🔄 Applying settings to ${products.length} products...`);

        let successCount = 0;
        let errorCount = 0;
        const errors: any[] = [];

        // Get all metal rates for lookup
        const metalRates = await prisma.metalRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' }
        });

        for (const product of products) {
            try {
                // Find appropriate metal rate
                const metalRate = metalRates.find(r =>
                    r.metal === product.metal &&
                    (product.karat ? r.karat === product.karat : true)
                );

                if (!metalRate) {
                    errors.push({ sku: product.sku, error: 'No metal rate found' });
                    errorCount++;
                    continue;
                }

                // Get stone rate if needed (legacy support)
                let stoneRate = null;
                if (product.gemstones && product.gemstones.length > 0) {
                    stoneRate = null;
                } else if (product.gemstoneType && !product.isManualGemstonePrice) {
                    stoneRate = await prisma.stoneRate.findFirst({
                        where: {
                            shopId: shop.id,
                            stoneType: product.gemstoneType,
                            cut: product.gemstoneCut || null,
                            color: product.gemstoneColor || null,
                            clarity: product.gemstoneClarity || null,
                            caratRange: product.gemstoneCaratRange || null
                        },
                        orderBy: { updatedAt: 'desc' }
                    });
                }

                // Calculate new price
                const { price: newPrice, breakdown } = await calculateProductPrice(
                    product,
                    metalRate.ratePerGram,
                    stoneRate,
                    settings
                );

                // Generate breakdown HTML
                const breakdownHtml = generateBreakdownHtml(breakdown);

                // Update product
                await prisma.product.update({
                    where: { id: product.id },
                    data: {
                        currentPrice: newPrice,
                        priceBreakdownHtml: breakdownHtml
                    }
                });

                // Push to Shopify
                await pushToShopify(product, newPrice, breakdown);

                successCount++;

                // Delay every 10 products
                if (successCount % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    console.log(`   Progress: ${successCount}/${products.length}`);
                }

            } catch (error: any) {
                console.error(`   Error: ${product.sku}:`, error.message);
                errors.push({ sku: product.sku, error: error.message });
                errorCount++;
            }
        }

        console.log(`✅ Applied to ${successCount} products`);

        res.json({
            success: true,
            totalProducts: products.length,
            successCount,
            errorCount,
            errors: errors.slice(0, 10)
        });

    } catch (error: any) {
        console.error('Error applying settings:', error);
        res.status(500).json({ error: 'Failed to apply settings' });
    }
});
