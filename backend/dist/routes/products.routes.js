"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const pricing_service_1 = require("../services/pricing.service");
const shopify_service_1 = require("../services/shopify.service");
// const bulkPriceUpdate_service_1 = require("../services/bulkPriceUpdate.service");
const sync_1 = require("csv-parse/sync");
const XLSX = __importStar(require("xlsx"));
const axios_1 = __importStar(require("axios"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();


// Helper function to push price and breakdown to Shopify (DEPRECATED - Use ShopifyService)
async function pushToShopify(shopDomain, accessToken, product, price, breakdown) {
    const shopifyService = new shopify_service_1.ShopifyService(shopDomain, accessToken);
    return shopifyService.updateVariantWithBreakdown(product.shopifyVariantId, price, breakdown);
}




// Get products with pagination and filters
router.get('/', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { page = 1, limit = 50, search, metal, karat, status, collectionId, // Optional collection filter
        } = req.query;
        // 1. Build Where Clause for Product/Variant Filtering
        const where = { shopId: shop.id };
        // Search (by title or SKU)
        if (search) {
            where.OR = [
                { sku: { contains: search } },
                { title: { contains: search } },
            ];
        }
        // Filters
        if (metal)
            where.metal = metal;
        if (karat)
            where.karat = parseInt(karat);
        // Status Filtering Alignment with Shopify Admin
        // Default to 'active' if no satus provided
        // If 'all', explicitly exclude archived/draft to avoid clutter
        if (!status || status === 'active') {
            // FIX: Case-insensitive check (DB has ACTIVE, backend defaults to active)
            where.status = { in: ['active', 'ACTIVE'] };
        }
        else if (status === 'draft') {
            where.status = { in: ['draft', 'DRAFT'] };
        }
        else if (status === 'archived') {
            where.status = { in: ['archived', 'ARCHIVED'] };
        }
        else if (status === 'all') {
            // Exclude archived (both cases)
            where.status = { notIn: ['archived', 'ARCHIVED'] };
        }

        // Apply Collection Filter
        const accessToken = shop.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;
        if (collectionId && accessToken) {
            const productIds = await shopify_service_1.ShopifyService.getCollectionProductIds(accessToken, collectionId, shop.domain);
            if (productIds.length > 0) {
                where.shopifyProductId = { in: productIds };
            }
            else {
                where.shopifyProductId = { in: [] }; // No products match
            }
        }
        // 2. Pagination Logic: By Product (Grouped by shopifyProductId)
        // We need to count UNIQUE shopifyProducts satisfying the criteria
        // Step A: Get Total Count of Unique Products
        // Prisma doesn't support distinct count easily with where clause in one go for count()
        // We use groupBy to get unique IDs to count
        const distinctProducts = await prisma.product.groupBy({
            by: ['shopifyProductId'],
            where: where,
            orderBy: { shopifyProductId: 'desc' }, // Consistent ordering
        });
        const totalUniqueProducts = distinctProducts.length;
        // Step B: Get Page Slice of Product IDs
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Slice the valid IDs for this page
        const pagedProductIds = distinctProducts
            .slice(skip, skip + limitNum)
            .map(p => p.shopifyProductId);
        // Step C: Fetch Full Variant Data for These Products
        // We fetch ALL variants for the products on this page
        const products = await prisma.product.findMany({
            where: {
                shopId: shop.id,
                shopifyProductId: { in: pagedProductIds } // Only variants for products on this page
            },
            orderBy: [
                { shopifyProductId: 'desc' }, // Group by product
                { shopifyVariantId: 'asc' } // Order variants stably
            ],
            include: { gemstones: true },
        });
        res.json({
            products, // Contains all variants for the ~50 products
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalUniqueProducts, // Correct count of actual products
                pages: Math.ceil(totalUniqueProducts / limitNum),
            },
        });
    }
    catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Update product by ID with automatic price recalculation
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({
            where: { domain: shopDomain },
            include: { settings: true }
        });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        // Get the existing product
        const existingProduct = await prisma.product.findUnique({
            where: { id },
            include: { gemstones: true }
        });

        if (!existingProduct || existingProduct.shopId !== shop.id) {
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log(`[UPDATE] Updating product ${id} (${existingProduct.sku})`);

        // Extract update data from request
        const {
            weightGrams,
            metal,
            karat,
            gemstoneType,
            gemstoneCut,
            gemstoneColor,
            gemstoneClarity,
            gemstoneCaratRange,
            stonePieces,
            stoneWeightCarat,
            isManualGemstonePrice,
            manualGemstoneWeight,
            manualGemstonePrice,
            makingGroupId,
            makingChargeType,
            makingChargeValue,
            metalDiscountType,
            metalDiscountValue,
            makingDiscountType,
            makingDiscountValue,
            gemstoneDiscountType,
            gemstoneDiscountValue,
            discount,
            discountType,
            enamelColor,
            enamelWeightGrams,
            enamelDiscountType,
            enamelDiscountValue,
            gemstones,
            grossGoldWeight,
            autoGrossGoldWeight,
            wastagePct,
            gstPct
        } = req.body;

        // Update product data
        const updateData = {
            weightGrams: weightGrams !== undefined ? weightGrams : existingProduct.weightGrams,
            metal: metal !== undefined ? metal : existingProduct.metal,
            karat: karat !== undefined ? karat : existingProduct.karat,
            gemstoneType: gemstoneType !== undefined ? gemstoneType : existingProduct.gemstoneType,
            gemstoneCut: gemstoneCut !== undefined ? gemstoneCut : existingProduct.gemstoneCut,
            gemstoneColor: gemstoneColor !== undefined ? gemstoneColor : existingProduct.gemstoneColor,
            gemstoneClarity: gemstoneClarity !== undefined ? gemstoneClarity : existingProduct.gemstoneClarity,
            gemstoneCaratRange: gemstoneCaratRange !== undefined ? gemstoneCaratRange : existingProduct.gemstoneCaratRange,
            stonePieces: stonePieces !== undefined ? stonePieces : existingProduct.stonePieces,
            stoneWeightCarat: stoneWeightCarat !== undefined ? stoneWeightCarat : existingProduct.stoneWeightCarat,
            isManualGemstonePrice: isManualGemstonePrice !== undefined ? isManualGemstonePrice : existingProduct.isManualGemstonePrice,
            manualGemstoneWeight: manualGemstoneWeight !== undefined ? manualGemstoneWeight : existingProduct.manualGemstoneWeight,
            manualGemstonePrice: manualGemstonePrice !== undefined ? manualGemstonePrice : existingProduct.manualGemstonePrice,
            makingGroupId: makingGroupId !== undefined ? makingGroupId : existingProduct.makingGroupId,
            makingChargeType: makingChargeType !== undefined ? makingChargeType : existingProduct.makingChargeType,
            makingChargeValue: makingChargeValue !== undefined ? makingChargeValue : existingProduct.makingChargeValue,
            metalDiscountType: metalDiscountType !== undefined ? metalDiscountType : existingProduct.metalDiscountType,
            metalDiscountValue: metalDiscountValue !== undefined ? metalDiscountValue : existingProduct.metalDiscountValue,
            makingDiscountType: makingDiscountType !== undefined ? makingDiscountType : existingProduct.makingDiscountType,
            makingDiscountValue: makingDiscountValue !== undefined ? makingDiscountValue : existingProduct.makingDiscountValue,
            gemstoneDiscountType: gemstoneDiscountType !== undefined ? gemstoneDiscountType : existingProduct.gemstoneDiscountType,
            gemstoneDiscountValue: gemstoneDiscountValue !== undefined ? gemstoneDiscountValue : existingProduct.gemstoneDiscountValue,
            discount: discount !== undefined ? discount : existingProduct.discount,
            discountType: discountType !== undefined ? discountType : existingProduct.discountType,
            enamelColor: enamelColor !== undefined ? enamelColor : existingProduct.enamelColor,
            enamelWeightGrams: enamelWeightGrams !== undefined ? enamelWeightGrams : existingProduct.enamelWeightGrams,
            enamelDiscountType: enamelDiscountType !== undefined ? enamelDiscountType : existingProduct.enamelDiscountType,
            enamelDiscountValue: enamelDiscountValue !== undefined ? enamelDiscountValue : existingProduct.enamelDiscountValue,
            grossGoldWeight: grossGoldWeight !== undefined ? grossGoldWeight : existingProduct.grossGoldWeight,
            autoGrossGoldWeight: autoGrossGoldWeight !== undefined ? autoGrossGoldWeight : existingProduct.autoGrossGoldWeight,
            wastagePct: wastagePct !== undefined ? wastagePct : existingProduct.wastagePct,
            gstPct: gstPct !== undefined ? gstPct : existingProduct.gstPct,
        };

        // Update the product in database (without price yet)
        const updatedProduct = await prisma.product.update({
            where: { id },
            data: updateData,
            include: { gemstones: true, makingGroup: true }
        });

        // Handle gemstones update if provided
        if (gemstones !== undefined) {
            // Delete existing gemstones
            await prisma.productGemstone.deleteMany({
                where: { productId: id }
            });

            // Create new gemstones
            if (gemstones && gemstones.length > 0) {
                await prisma.productGemstone.createMany({
                    data: gemstones.map((g) => ({
                        productId: id,
                        gemstoneType: g.gemstoneType,
                        gemstoneCut: g.gemstoneCut || null,
                        gemstoneColor: g.gemstoneColor || null,
                        gemstoneClarity: g.gemstoneClarity || null,
                        gemstoneCaratRange: g.gemstoneCaratRange || null,
                        gemstoneWeight: g.gemstoneWeight || null,
                        gemstonePieces: g.gemstonePieces || null,
                        discountType: g.discountType || null,
                        discountValue: g.discountValue || null,
                        isCustom: g.isCustom || false,
                        pricePerPiece: g.pricePerPiece || null,
                        pricePerCarat: g.pricePerCarat || null,
                        totalPrice: g.totalPrice || null,
                    }))
                });
            }
        }

        // Reload product with updated gemstones
        const productWithGemstones = await prisma.product.findUnique({
            where: { id },
            include: { gemstones: true, makingGroup: true }
        });

        console.log(`[UPDATE] Recalculating price for ${existingProduct.sku}...`);

        // Recalculate price with fresh rates (pass product ID, not object!)
        const priceResult = await pricing_service_1.PricingService.calculateBulkPrices(shop.id, [productWithGemstones.id]);

        if (priceResult && priceResult.length > 0) {
            const { newPrice, breakdown } = priceResult[0];

            console.log(`[UPDATE] New price calculated: ₹${newPrice.toFixed(2)}`);

            // Update product with new price
            await prisma.product.update({
                where: { id },
                data: {
                    currentPrice: newPrice,
                    lastCalculatedPrice: newPrice,
                }
            });

            console.log(`[UPDATE] ✓ Database updated, pushing to Shopify...`);

            // Push to Shopify automatically
            const shopifyResult = await pushToShopify(
                shop.domain,
                shop.accessToken,
                productWithGemstones,
                newPrice,
                breakdown
            );

            if (shopifyResult.success) {
                console.log(`[UPDATE] ✅ Shopify updated successfully`);
                // Update lastPushedPrice and lastPushedAt
                await prisma.product.update({
                    where: { id },
                    data: {
                        lastPushedPrice: newPrice,
                        lastPushedAt: new Date()
                    }
                });
            } else {
                console.log(`[UPDATE] ⚠️  Shopify push failed: ${shopifyResult.error}`);
                console.log(`[UPDATE] Price saved to database but not synced to Shopify`);
            }

            res.json({
                success: true,
                message: 'Product updated successfully',
                product: {
                    ...productWithGemstones,
                    currentPrice: newPrice,
                    lastCalculatedPrice: newPrice,
                },
                breakdown
            });
        } else {
            console.log(`[UPDATE] ⚠️  Price calculation returned no result for ${existingProduct.sku}`);
            res.json({
                success: true,
                message: 'Product updated but price calculation failed',
                product: productWithGemstones
            });
        }

    } catch (error) {
        console.error('[UPDATE] Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
});

// Calculate price for product (used by frontend modal)
router.post('/calculate-price', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const {
            weightGrams,
            grossGoldWeight,
            autoGrossGoldWeight,
            metal,
            karat,
            gemstones = [],
            makingChargeType,
            makingChargeValue,
            makingGroupId,
            wastagePct = 0,
            gstPct = 3,
            discount = 0,
            discountType = 'flat',
            metalDiscountType,
            metalDiscountValue,
            makingDiscountType,
            makingDiscountValue,
            gemstoneDiscountType,
            gemstoneDiscountValue,
            isManualGemstonePrice,
            manualGemstoneWeight,
            manualGemstonePrice,
            stoneWeightCarat,
            stonePieces,
            enamelColor,
            enamelWeightGrams,
            enamelDiscountType,
            enamelDiscountValue
        } = req.body;

        console.log('[CALCULATE-PRICE] Full Request Body:', JSON.stringify(req.body, null, 2));

        // Create a temporary product object for calculation
        const tempProduct = {
            id: 'temp',
            shopId: shop.id,
            metal: metal?.toLowerCase(),
            karat: parseInt(karat),
            weightGrams: parseFloat(weightGrams),
            grossGoldWeight: grossGoldWeight ? parseFloat(grossGoldWeight) : null,
            wastagePct: parseFloat(wastagePct),
            gstPct: parseFloat(gstPct),
            discount: parseFloat(discount),
            discountType,
            makingChargeType,
            makingChargeValue: makingChargeValue ? parseFloat(makingChargeValue) : null,
            makingGroupId,
            metalDiscountType,
            metalDiscountValue: metalDiscountValue ? parseFloat(metalDiscountValue) : null,
            makingDiscountType,
            makingDiscountValue: makingDiscountValue ? parseFloat(makingDiscountValue) : null,
            gemstoneDiscountType,
            gemstoneDiscountValue: gemstoneDiscountValue ? parseFloat(gemstoneDiscountValue) : null,
            isManualGemstonePrice,
            manualGemstoneWeight: manualGemstoneWeight ? parseFloat(manualGemstoneWeight) : null,
            manualGemstonePrice: manualGemstonePrice ? parseFloat(manualGemstonePrice) : null,
            autoGrossGoldWeight,
            stoneWeightCarat: parseFloat(stoneWeightCarat || 0),
            stonePieces: parseInt(stonePieces || 0),
            enamelColor,
            enamelWeightGrams: enamelWeightGrams ? parseFloat(enamelWeightGrams) : null,
            enamelDiscountType,
            enamelDiscountValue: enamelDiscountValue ? parseFloat(enamelDiscountValue) : null,
            gemstones: gemstones.map(g => ({
                ...g,
                gemstoneWeight: parseFloat(g.gemstoneWeight || 0),
                gemstonePieces: parseInt(g.gemstonePieces || 0),
                pricePerCarat: g.pricePerCarat ? parseFloat(g.pricePerCarat) : null,
                pricePerPiece: g.pricePerPiece ? parseFloat(g.pricePerPiece) : null,
                totalPrice: g.totalPrice ? parseFloat(g.totalPrice) : null
            }))
        };

        // Get metal rate
        const metalRate = await prisma.metalRate.findFirst({
            where: {
                shopId: shop.id,
                metal: metal?.toLowerCase(),
                karat: parseInt(karat)
            }
        });

        if (!metalRate) {
            return res.status(400).json({ error: `Metal rate not found for ${metal} ${karat}K` });
        }

        // Get shop settings
        const settings = await prisma.shopSettings.findUnique({
            where: { shopId: shop.id }
        });

        // Get enamel rate if needed
        let enamelRate = null;
        if (enamelColor) {
            enamelRate = await prisma.enamelRate.findFirst({
                where: {
                    shopId: shop.id,
                    enamelColor
                }
            });
        }

        // Calculate price using pricing service
        const result = await pricing_service_1.PricingService.calculateProductPrice(
            tempProduct,
            metalRate.ratePerGram,
            null,
            settings,
            enamelRate
        );

        console.log('[CALCULATE-PRICE] Result: ₹' + result.price);

        res.json({
            success: true,
            price: result.price,
            breakdown: result.breakdown
        });

    } catch (error) {
        console.error('[CALCULATE-PRICE] Error:', error);
        res.status(500).json({ error: 'Failed to calculate price', details: error.message });
    }
});

// Import products from CSV/XLSX (Comprehensive Detailing Format)

router.post('/import', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        // Fetch shop settings for defaults
        const shopSettings = await prisma.shopSettings.findUnique({
            where: { shopId: shop.id }
        });

        const { fileData, fileType } = req.body;
        let rows;
        if (fileType === 'csv') {
            const csvData = Buffer.from(fileData, 'base64').toString('utf-8');
            rows = (0, sync_1.parse)(csvData, { columns: true, skip_empty_lines: true });
        }
        else if (fileType === 'xlsx') {
            const buffer = Buffer.from(fileData, 'base64');
            const workbook = XLSX.read(buffer);
            const sheetName = workbook.SheetNames[0];
            rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }
        else {
            return res.status(400).json({ error: 'Unsupported file type' });
        }
        const imported = [];
        const errors = [];
        for (const row of rows) {
            try {
                const SKU = row.SKU || row.sku;
                console.log(`\n[IMPORT] ========== Processing SKU: ${SKU} ==========`);

                if (!SKU) {
                    errors.push({ sku: 'No SKU', error: 'SKU is missing' });
                    continue;
                }
                
                // DEBUG: Log first row keys and making charge fields
                if (imported.length === 0) {
                    console.log('[IMPORT] Row keys:', Object.keys(row));
                }
                console.log(`[IMPORT] SKU ${SKU} - Making Type: "${row['Making Type']}", Making Value: "${row['Making Value']}"`);
                const existingProduct = await prisma.product.findFirst({
                    where: { shopId: shop.id, sku: SKU.toString() },
                    include: { gemstones: true, makingGroup: true }
                });

                if (!existingProduct) {
                    console.log(`[IMPORT] ERROR: Product not found for SKU ${SKU}`);
                    errors.push({ sku: SKU, error: 'Product not found. Sync first.' });
                    continue;
                }

                console.log(`[IMPORT] Found product ID: ${existingProduct.id}, Current Price: ${existingProduct.currentPrice}`);

                // Prepare update data
                // Normalize row keys for robustness
                const normalizedRow = {};
                Object.keys(row).forEach(key => {
                    normalizedRow[key.trim()] = row[key];
                });

                let makingType = (normalizedRow['Making Type'] || existingProduct.makingChargeType || shopSettings?.defaultMakingChargeType || 'per_gram').toString().toLowerCase();
                let makingValue = parseFloat(
                    (normalizedRow['Making Value'] !== undefined && normalizedRow['Making Value'] !== '') 
                    ? normalizedRow['Making Value'] 
                    : (existingProduct.makingChargeValue ?? shopSettings?.defaultMakingChargeValue ?? 1500)
                );

                const makingPercentageValue = parseFloat(normalizedRow['Making Percentage'] || 0);
                
                // Logic: If Making Percentage is filled and Making Value is 0 or empty, use percentage
                if (makingPercentageValue > 0 && (!makingValue || makingValue === 0)) {
                    makingType = 'percent';
                    makingValue = makingPercentageValue;
                } else if (makingPercentageValue > 0 && makingValue > 0) {
                    // Both filled - default to Making Value as per user request
                }

                // Add making discount fields - using priority logic similar to making charges
                let makingDiscountType = existingProduct.makingDiscountType || 'none';
                let makingDiscountValue = parseFloat(existingProduct.makingDiscountValue || 0);

                const discountPctValue = parseFloat(normalizedRow['Making Discount %'] || 0);
                const discountFlatValue = parseFloat(normalizedRow['Making Discount Value'] || 0);

                if (discountPctValue > 0) {
                    makingDiscountType = 'percent';
                    makingDiscountValue = discountPctValue;
                } else if (discountFlatValue > 0) {
                    makingDiscountType = 'flat';
                    makingDiscountValue = discountFlatValue;
                }

                // Prepare final update data object
                const updateData = {
                    status: normalizedRow['Status'] || existingProduct.status,
                    metal: (normalizedRow['Metal Type'] || normalizedRow['metal'] || '').toString().toLowerCase(),
                    karat: parseInt(normalizedRow['Metal Karat'] || normalizedRow['Metal Purity'] || normalizedRow['karat'] || 0),
                    weightGrams: parseFloat(normalizedRow['Metal Weight Net (g)'] || normalizedRow['Metal Weight (g)'] || normalizedRow['weightGrams'] || 0),
                    grossGoldWeight: parseFloat(normalizedRow['Metal Weight Gross (g)'] || normalizedRow['Gross Weight (g)'] || normalizedRow['grossGoldWeight'] || 0),
                    wastagePct: parseFloat(normalizedRow['Wastage %'] || normalizedRow['wastagePct'] || 0),
                    enamelColor: normalizedRow['Enamel Color'] || null,
                    enamelWeightGrams: parseFloat(normalizedRow['Enamel Weight (g)'] || 0),
                    enamelDiscountType: normalizedRow['Enamel Discount Type'] || 'none',
                    enamelDiscountValue: parseFloat(normalizedRow['Enamel Discount Value'] || 0),
                    discountType: normalizedRow['Product Discount Type'] || normalizedRow['Discount Type'] || 'none',
                    discount: parseFloat(normalizedRow['Product Discount Value'] || normalizedRow['Discount Value'] || 0),
                    gstPct: parseFloat(normalizedRow['GST %'] || existingProduct.gstPct || shopSettings?.defaultGstPct || 3),
                    stoneWeightCarat: parseFloat(normalizedRow['Gemstone Weight (ct)'] || normalizedRow['Stone Weight (ct)'] || normalizedRow['Number of Psc'] || normalizedRow['stoneWeightCarat'] || 0),
                    stonePieces: parseInt(normalizedRow['Gemstone Pieces'] || normalizedRow['Stone Pieces'] || normalizedRow['Psc'] || normalizedRow['stonePieces'] || 0),
                    makingChargeType: makingType,
                    makingChargeValue: makingValue,
                    makingDiscountType: makingDiscountType,
                    makingDiscountValue: makingDiscountValue
                };

                console.log(`[IMPORT] Final Update Data for ${SKU}:`, JSON.stringify({
                    makingChargeType: updateData.makingChargeType,
                    makingChargeValue: updateData.makingChargeValue,
                    makingDiscountType: updateData.makingDiscountType,
                    makingDiscountValue: updateData.makingDiscountValue
                }, null, 2));

                // Update Product Core & Metal & Enamel & Pricing
                const updatedProduct = await prisma.product.update({
                    where: { id: existingProduct.id },
                    data: updateData
                });

                console.log(`[IMPORT] Product updated in DB:`);
                console.log(`  - Metal: ${updatedProduct.metal} ${updatedProduct.karat}K`);
                console.log(`  - Weight: ${updatedProduct.weightGrams}g`);
                console.log(`  - Wastage: ${updatedProduct.wastagePct}%`);
                console.log(`  - GST: ${updatedProduct.gstPct}%`);
                console.log(`  - Discount: ${updatedProduct.discountType} ${updatedProduct.discount}`);

                // Handle Gemstones (Up to 3) - Support new and old template formats
                const stonesToSave = [];
                for (let i = 1; i <= 3; i++) {
                    const prefix = `Stone ${i}: `;

                    // Check if stone is used (new format: Source field, old format: Used field)
                    const source = normalizedRow[`${prefix}Source`];
                    const used = normalizedRow[`${prefix}Used`]?.toString().toUpperCase() === 'TRUE';
                    const hasStone = source || used;

                    if (hasStone) {
                        // Determine if Master or Custom
                        const isMaster = source?.toLowerCase() === 'master';
                        const isCustom = source?.toLowerCase() === 'custom' || normalizedRow[`${prefix}Custom`]?.toString().toUpperCase() === 'TRUE';

                        const stoneData = {
                            // New format: Master Name or Custom Type, Old format: Type
                            gemstoneType: isMaster ? normalizedRow[`${prefix}Master Name`] : (normalizedRow[`${prefix}Custom Type`] || normalizedRow[`${prefix}Type`]),
                            gemstoneShape: normalizedRow[`${prefix}Shape`],
                            gemstoneQuality: normalizedRow[`${prefix}Quality`],
                            gemstoneColor: normalizedRow[`${prefix}Color`],
                            gemstoneClarity: normalizedRow[`${prefix}Clarity`],
                            gemstoneCut: normalizedRow[`${prefix}Cut`],
                            gemstoneCaratRange: normalizedRow[`${prefix}Carat Range`],
                            gemstoneWeight: parseFloat(normalizedRow[`${prefix}Weight (ct)`] || 0),
                            gemstonePieces: parseInt(normalizedRow[`${prefix}Pieces`] || 1),
                            // Discount fields (new in enhanced template)
                            discountType: normalizedRow[`${prefix}Discount Type`] || 'none',
                            discountValue: parseFloat(normalizedRow[`${prefix}Discount Value`] || 0),
                            // Rate per piece (new format or old format)
                            unitType: normalizedRow[`${prefix}Rate Type`] === 'piece' ? 'piece' : 'carat',
                            pricePerPiece: normalizedRow[`${prefix}Rate Type`] === 'piece' ? parseFloat(normalizedRow[`${prefix}Rate Per Piece`] || normalizedRow[`${prefix}Rate Value`] || 0) : null,
                            pricePerCarat: normalizedRow[`${prefix}Rate Type`] !== 'piece' ? parseFloat(normalizedRow[`${prefix}Rate Per Carat`] || normalizedRow[`${prefix}Rate Value`] || 0) : null,
                            isCustom: isCustom
                        };
                        stonesToSave.push(stoneData);
                        console.log(`[IMPORT] Stone ${i} data (${isMaster ? 'Master' : 'Custom'}):`, stoneData);
                    }
                }

                // Wipe and replace gems for this product (cleanest way for small # of gems)
                await prisma.productGemstone.deleteMany({ where: { productId: existingProduct.id } });
                console.log(`[IMPORT] Deleted existing gemstones`);

                if (stonesToSave.length > 0) {
                    await prisma.productGemstone.createMany({
                        data: stonesToSave.map(s => ({
                            ...s,
                            productId: existingProduct.id
                        }))
                    });
                    console.log(`[IMPORT] Created ${stonesToSave.length} new gemstones`);
                }

                // CRITICAL: Refetch product with updated gemstones before calculation
                // This ensures the pricing service gets the latest data
                const refreshedProduct = await prisma.product.findUnique({
                    where: { id: existingProduct.id },
                    include: { gemstones: true, makingGroup: true }
                });

                console.log(`[IMPORT] Refetched product - Weight: ${refreshedProduct.weightGrams}g, Gemstones: ${refreshedProduct.gemstones.length}`);

                // Recalculate Price
                console.log(`[IMPORT] Calculating price for product ${existingProduct.id}...`);
                const priceResults = await pricing_service_1.PricingService.calculateBulkPrices(shop.id, [refreshedProduct.id]);

                if (priceResults.length > 0) {
                    const priceData = priceResults[0];
                    console.log(`[IMPORT] Price calculation result: Old=₹${priceData.oldPrice}, New=₹${priceData.newPrice}`);

                    // Update database with new price
                    await prisma.product.update({
                        where: { id: existingProduct.id },
                        data: {
                            currentPrice: priceData.newPrice,
                            lastCalculatedPrice: priceData.newPrice,
                        }
                    });
                    console.log(`[IMPORT] ✓ Database updated with new price: ₹${priceData.newPrice}`);

                    // Push to Shopify asynchronously (non-blocking to avoid timeout)
                    console.log(`[IMPORT] Queuing Shopify sync (async)...`);

                    // Fire-and-forget: don't await, let it run in background
                    // Added a small artificial delay to avoid immediate burst that triggers 429
                    new Promise(resolve => setTimeout(resolve, imported.length * 500)).then(() => {
                        return pushToShopify(
                            shop.domain,
                            shop.accessToken,
                            refreshedProduct,
                            priceData.newPrice,
                            priceData.breakdown
                        );
                    }).then(async (shopifyResult) => {
                        if (shopifyResult.success) {
                            console.log(`[IMPORT] ✅ Shopify synced for ${SKU}`);
                            // Update lastPushedPrice and lastPushedAt
                            await prisma.product.update({
                                where: { id: existingProduct.id },
                                data: {
                                    lastPushedPrice: priceData.newPrice,
                                    lastPushedAt: new Date()
                                }
                            });
                        } else {
                            console.log(`[IMPORT] ⚠️  Shopify sync failed for ${SKU}: ${shopifyResult.error}`);
                        }
                    }).catch((error) => {
                        console.error(`[IMPORT] ⚠️  Shopify sync error for ${SKU}:`, error.message);
                    });

                    console.log(`[IMPORT] Continuing with next product (Shopify sync in background with 500ms staggered delay)...`);
                } else {
                    console.log(`[IMPORT] WARNING: No price results returned for ${SKU}`);
                }

                imported.push({ sku: SKU, status: 'updated' });
                console.log(`[IMPORT] ========== Completed SKU: ${SKU} ==========\n`);
            }
            catch (error) {
                console.error(`[IMPORT] ERROR processing row:`, error);
                errors.push({ sku: row.SKU || 'Unknown', error: error.message });
            }
        }
        res.json({ success: true, imported: imported.length, errors: errors.length, details: { imported, errors } });
    }
    catch (error) {
        console.error('Error importing products:', error);
        res.status(500).json({ error: 'Failed to import products' });
    }
});
// Generate Detailed Template (Comprehensive Format)
router.get('/template', async (req, res) => {
    try {
        const format = req.query.format || 'xlsx';
        const exampleRow = {
            // Basic Product Info
            'SKU': 'GOLD-RING-001',
            'Title': 'Gold Diamond Ring',
            'Status': 'active',
            'Collection': 'Rings',

            // Metal Information
            'Metal Type': 'gold',
            'Metal Karat': '18',
            'Metal Weight Net (g)': '10.5',
            'Metal Weight Gross (g)': '11.2',
            'Wastage %': '2',

            // Stone 1 - Master/Custom Selection
            'Stone 1: Source': 'Master',
            'Stone 1: Master Name': 'Diamond Round VS1 D',
            'Stone 1: Custom Type': '',
            'Stone 1: Cut': 'Round',
            'Stone 1: Color': 'D',
            'Stone 1: Clarity': 'VS1',
            'Stone 1: Carat Range': '0.5-1.0',
            'Stone 1: Weight (ct)': '0.75',
            'Stone 1: Pieces': '1',
            'Stone 1: Discount Type': 'percent',
            'Stone 1: Discount Value': '5',
            'Stone 1: Rate Per Piece': '',

            // Stone 2 - Custom Example
            'Stone 2: Source': 'Custom',
            'Stone 2: Master Name': '',
            'Stone 2: Custom Type': 'Ruby',
            'Stone 2: Cut': 'Oval',
            'Stone 2: Color': 'Red',
            'Stone 2: Clarity': 'VS2',
            'Stone 2: Carat Range': '0.25-0.5',
            'Stone 2: Weight (ct)': '0.3',
            'Stone 2: Pieces': '2',
            'Stone 2: Discount Type': 'flat',
            'Stone 2: Discount Value': '100',
            'Stone 2: Rate Per Piece': '5000',

            // Stone 3 - Not Used
            'Stone 3: Source': '',
            'Stone 3: Master Name': '',
            'Stone 3: Custom Type': '',
            'Stone 3: Cut': '',
            'Stone 3: Color': '',
            'Stone 3: Clarity': '',
            'Stone 3: Carat Range': '',
            'Stone 3: Weight (ct)': '',
            'Stone 3: Pieces': '',
            'Stone 3: Discount Type': '',
            'Stone 3: Discount Value': '',
            'Stone 3: Rate Per Piece': '',

            // Enamel Information
            'Enamel Color': 'Red',
            'Enamel Weight (g)': '0.2',
            'Enamel Discount Type': 'none',
            'Enamel Discount Value': '0',

            // Making Charges
            'Making Type': 'per_gram',
            'Making Value': '1500',
            'Making Percentage': '10',
            'Making Discount Value': '0',
            'Making Discount %': '0',

            // Product Discount
            'Product Discount Type': 'flat',
            'Product Discount Value': '500',

            // Other Fields
            'GST %': '3',
            'Current Price': '(Read-only - Calculated)',
            'Last Synced': '(Read-only - Auto-updated)'
        };
        if (format === 'csv') {
            const worksheet = XLSX.utils.json_to_sheet([exampleRow]);
            const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=detailing_template.csv');
            res.send(csvOutput);
        }
        else {
            const worksheet = XLSX.utils.json_to_sheet([exampleRow]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=detailing_template.xlsx');
            res.send(buffer);
        }
    }
    catch (error) {
        console.error('Error generating template:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});
// Export Products (Comprehensive Detailing Format)
router.get('/export', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const products = await prisma.product.findMany({
            where: { shopId: shop.id },
            include: { gemstones: true, makingGroup: true }
        });
        const rows = products.map(p => {
            const row = {
                SKU: p.sku || '',
                Title: p.title || '',
                Status: p.status || '',
                Collection: p.makingGroup?.name || '',
                'Metal Type': p.metal || '',
                'Metal Purity': p.karat || '',
                'Metal Weight (g)': p.weightGrams || '',
                'Gross Weight (g)': p.grossGoldWeight || '',
                'Wastage %': p.wastagePct || '',
            };
            // Map Stones
            for (let i = 1; i <= 3; i++) {
                const stone = p.gemstones[i - 1];
                const prefix = `Stone ${i}: `;
                row[`${prefix}Used`] = stone ? 'TRUE' : 'FALSE';
                row[`${prefix}Type`] = stone?.gemstoneType || '';
                row[`${prefix}Shape`] = stone?.gemstoneShape || '';
                row[`${prefix}Quality`] = stone?.gemstoneQuality || '';
                row[`${prefix}Color`] = stone?.gemstoneColor || '';
                row[`${prefix}Clarity`] = stone?.gemstoneClarity || '';
                row[`${prefix}Cut`] = stone?.gemstoneCut || '';
                row[`${prefix}Weight (ct)`] = stone?.gemstoneWeight || '';
                row[`${prefix}Pieces`] = stone?.gemstonePieces || '';
                row[`${prefix}Rate Type`] = stone?.unitType || '';
                row[`${prefix}Rate Value`] = stone?.pricePerPiece || '';
                row[`${prefix}Custom`] = stone?.isCustom ? 'TRUE' : 'FALSE';
            }
            // Enamel & Pricing
            row['Enamel Color'] = p.enamelColor || '';
            row['Enamel Weight (g)'] = p.enamelWeightGrams || '';
            row['Enamel Discount Type'] = p.enamelDiscountType || 'none';
            row['Enamel Discount Value'] = p.enamelDiscountValue || 0;
            row['Making Type'] = p.makingChargeType || '';
            row['Making Value'] = p.makingChargeType !== 'percent' ? (p.makingChargeValue || '') : '';
            row['Making Percentage'] = p.makingChargeType === 'percent' ? (p.makingChargeValue || '') : '';
            row['Making Discount Value'] = p.makingDiscountType === 'flat' ? (p.makingDiscountValue || '') : '';
            row['Making Discount %'] = p.makingDiscountType === 'percent' ? (p.makingDiscountValue || '') : '';
            row['Discount Type'] = p.discountType || 'none';
            row['Discount Value'] = p.discount || 0;
            row['GST %'] = p.gstPct || 3;
            row['Current Price'] = p.currentPrice || '';
            row['Last Synced'] = p.updatedAt.toISOString().split('T')[0];
            return row;
        });
        // Define explicit headers to ensure order and visibility
        const headers = [
            'SKU', 'Title', 'Status', 'Collection', 'Metal Type', 'Metal Purity', 
            'Metal Weight (g)', 'Gross Weight (g)', 'Wastage %',
            'Stone 1: Used', 'Stone 1: Type', 'Stone 1: Shape', 'Stone 1: Quality', 'Stone 1: Color', 'Stone 1: Clarity', 'Stone 1: Cut', 'Stone 1: Weight (ct)', 'Stone 1: Pieces', 'Stone 1: Rate Type', 'Stone 1: Rate Value', 'Stone 1: Custom',
            'Stone 2: Used', 'Stone 2: Type', 'Stone 2: Shape', 'Stone 2: Quality', 'Stone 2: Color', 'Stone 2: Clarity', 'Stone 2: Cut', 'Stone 2: Weight (ct)', 'Stone 2: Pieces', 'Stone 2: Rate Type', 'Stone 2: Rate Value', 'Stone 2: Custom',
            'Stone 3: Used', 'Stone 3: Type', 'Stone 3: Shape', 'Stone 3: Quality', 'Stone 3: Color', 'Stone 3: Clarity', 'Stone 3: Cut', 'Stone 3: Weight (ct)', 'Stone 3: Pieces', 'Stone 3: Rate Type', 'Stone 3: Rate Value', 'Stone 3: Custom',
            'Enamel Color', 'Enamel Weight (g)', 'Enamel Discount Type', 'Enamel Discount Value',
            'Making Type', 'Making Value', 'Making Percentage', 'Making Discount Value', 'Making Discount %',
            'Discount Type', 'Discount Value', 'GST %', 'Current Price', 'Last Synced'
        ];

        const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
        const format = req.query.format || 'xlsx';
        if (format === 'csv') {
            const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=detailing_export_${Date.now()}.csv`);
            res.send(csvOutput);
        }
        else {
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=detailing_export_${Date.now()}.xlsx`);
            res.send(buffer);
        }
    }
    catch (error) {
        console.error('Error exporting products:', error);
        res.status(500).json({ error: 'Failed to export products' });
    }
});
// Sync Products (Trigger Bulk Update)
router.post('/sync', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { BulkPriceUpdateService } = require("../services/bulkPriceUpdate.service");
        const jobId = await BulkPriceUpdateService.triggerUpdate({
            shopId: shop.id,
            triggeredBy: 'manual_sync'
        });
        res.json({ success: true, jobId, message: 'Sync started' });
    } catch (error) {
        console.error('Error starting sync:', error);
        res.status(500).json({ error: 'Failed to start sync' });
    }
});

// Get Sync Status
router.get('/sync/status', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { BulkPriceUpdateService } = require("../services/bulkPriceUpdate.service");
        const jobs = await BulkPriceUpdateService.getRecentJobs(shop.id, 1);
        const job = jobs.length > 0 ? jobs[0] : null;
        res.json({ success: true, job });
    } catch (error) {
        console.error('Error fetching sync status:', error);
        res.status(500).json({ error: 'Failed to fetch sync status' });
    }
});

// Push price breakdown to Shopify for selected products
router.post('/push-breakdown', async (req, res) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { productIds } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: 'Product IDs required' });
        }

        console.log(`[PUSH-BREAKDOWN] Starting push for ${productIds.length} products...`);

        // Get products with their current prices and breakdowns
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                shopId: shop.id
            },
            select: {
                id: true,
                sku: true,
                shopifyVariantId: true,
                currentPrice: true,
                priceBreakdownHtml: true,
                metal: true,
                karat: true,
                weightGrams: true
            }
        });

        if (products.length === 0) {
            return res.status(404).json({ error: 'No products found' });
        }

        // FIX BUG-07: Pre-push validation — check for incomplete products
        const validProductIds = [];
        const skippedProducts = [];
        for (const product of products) {
            if (!product.metal || !product.weightGrams) {
                skippedProducts.push({
                    productId: product.id,
                    sku: product.sku,
                    success: false,
                    error: `Missing required data: ${!product.metal ? 'metal type' : ''}${!product.metal && !product.weightGrams ? ', ' : ''}${!product.weightGrams ? 'weight' : ''}`
                });
            } else {
                validProductIds.push(product.id);
            }
        }

        if (validProductIds.length === 0) {
            return res.status(400).json({
                error: 'None of the selected products have complete pricing data (metal + weight required)',
                skipped: skippedProducts
            });
        }

        const shopifyService = await shopify_service_1.ShopifyService.forShop(shop.domain);
        const results = [...skippedProducts]; // Start with skipped products
        let successCount = 0;
        let failedCount = skippedProducts.length;

        // Push each valid product
        // 1. Recalculate prices first to ensure freshness
        console.log(`[PUSH-BREAKDOWN] Recalculating prices for ${validProductIds.length} valid products (${skippedProducts.length} skipped)...`);
        const priceResults = await pricing_service_1.PricingService.calculateBulkPrices(shop.id, validProductIds);

        // Map results for easy lookup
        const calculatedMap = new Map();
        priceResults.forEach(calcItem => calculatedMap.set(calcItem.productId, calcItem));

        for (const productId of productIds) {
            try {
                // Get product with fresh calculation
                const calcResult = calculatedMap.get(productId);

                // Fetch product details for SKU/ID needed for push
                const product = await prisma.product.findUnique({
                    where: { id: productId },
                    select: { id: true, sku: true, shopifyVariantId: true }
                });

                if (!product || !calcResult) {
                    console.error(`[PUSH-BREAKDOWN] Missing data for product ${productId}`);
                    failedCount++;
                    results.push({ productId, success: false, error: 'Product or calculation missing' });
                    continue;
                }

                const newPrice = calcResult.newPrice;
                const breakdown = calcResult.breakdown;
                // Use JSON breakdown for metafield; HTML generation removed to prevent duplicate tables.
                const breakdownJson = JSON.stringify(breakdown);

                console.log(`[PUSH-BREAKDOWN] Pushing ${product.sku}: ₹${newPrice} (was ${calcResult.oldPrice})`);

                // Update DB First with new calculation
                await prisma.product.update({
                    where: { id: product.id },
                    data: {
                        currentPrice: newPrice,
                        lastCalculatedPrice: newPrice,
                        priceBreakdownHtml: breakdownJson
                    }
                });

                // Push to Shopify (price + metafield only, no body_html)
                const result = await shopifyService.updateVariantPricesBatch([{
                    variantId: product.shopifyVariantId,
                    price: newPrice,
                    breakdown: breakdown
                }]);

                if (result[0]?.success) {
                    // Update lastPushedPrice and lastPushedAt
                    await prisma.product.update({
                        where: { id: product.id },
                        data: {
                            lastPushedPrice: newPrice,
                            lastPushedAt: new Date()
                        }
                    });

                    successCount++;
                    results.push({
                        productId: product.id,
                        sku: product.sku,
                        success: true,
                        price: newPrice
                    });
                    console.log(`[PUSH-BREAKDOWN] ✓ Success: ${product.sku}`);
                } else {
                    failedCount++;
                    results.push({
                        productId: product.id,
                        sku: product.sku,
                        success: false,
                        error: result[0]?.error
                    });
                    console.error(`[PUSH-BREAKDOWN] ✗ Failed: ${product.sku}`, result[0]?.error);
                }
            } catch (error) {
                failedCount++;
                results.push({
                    productId: productId,
                    success: false,
                    error: error.message
                });
                console.error(`[PUSH-BREAKDOWN] ✗ Error for ${productId}:`, error.message);
            }
        }

        console.log(`[PUSH-BREAKDOWN] Complete: ${successCount} success, ${failedCount} failed`);

        res.json({
            success: true,
            message: `Pushed ${successCount} products successfully, ${failedCount} failed`,
            successCount,
            failedCount,
            results
        });
    } catch (error) {
        console.error('[PUSH-BREAKDOWN] Error:', error);
        res.status(500).json({ error: 'Failed to push price breakdowns' });
    }
});

exports.default = router;
//# sourceMappingURL=products.routes.js.map