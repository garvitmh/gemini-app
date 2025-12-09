import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { BulkPriceUpdateService } from './services/bulkPriceUpdate.service';

const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'daginawala11.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

if (!SHOPIFY_ACCESS_TOKEN) {
    console.error('ERROR: SHOPIFY_ACCESS_TOKEN not set in environment variables');
    process.exit(1);
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to calculate price and breakdown
const calculateProductPrice = (product: any, ratePerGram: number, settings: any) => {
    const weight = product.weightGrams || 0;
    const metalValueRaw = ratePerGram * weight;

    // Defaults
    const wastagePct = settings.defaultWastagePct ?? 2;
    const makingPerGram = settings.defaultMakingPerGram ?? 1500;
    const gstPct = settings.defaultGstPct ?? 3;
    const discount = settings.defaultDiscount ?? 0;

    const wastageAmount = metalValueRaw * (wastagePct / 100);
    const metalValue = metalValueRaw + wastageAmount;

    // Making charge (per gram)
    const makingCharge = makingPerGram * weight;

    let gemstoneCost = 0;
    if (product.isManualGemstonePrice) {
        gemstoneCost = product.manualGemstonePrice || 0;
    }

    const subtotal = metalValue + makingCharge + gemstoneCost;
    const gstAmount = subtotal * (gstPct / 100);
    const finalPrice = subtotal + gstAmount - discount;

    // Store all values × 100 for precision and consistency
    return {
        price: finalPrice,
        breakdown: {
            metal_rate: Math.round(ratePerGram * 100),
            metal_value: Math.round(metalValue * 100),
            wastage_amount: Math.round(wastageAmount * 100),
            wastage_pct: wastagePct,
            making_charges: Math.round(makingCharge * 100),
            making_charge_per_gram: Math.round(makingPerGram * 100),
            gemstone_price: Math.round(gemstoneCost * 100),
            subtotal: Math.round(subtotal * 100),
            gst_amount: Math.round(gstAmount * 100),
            gst_pct: gstPct,
            discount: Math.round(discount * 100),
            total: Math.round(finalPrice * 100)
        }
    };
};

// Helper to log audit events
const logAudit = async (shopId: string, action: string, entity: string, entityId: string | null, details: any, reason?: string) => {
    try {
        await prisma.auditLog.create({
            data: {
                shopId,
                action,
                entity,
                entityId,
                oldValue: details.oldValue ? JSON.stringify(details.oldValue) : null,
                newValue: details.newValue ? JSON.stringify(details.newValue) : null,
                reason,
            }
        });
    } catch (e) {
        console.error('Failed to log audit:', e);
    }
};

// Helper to push to Shopify & Log History
const pushToShopify = async (product: any, price: number, breakdown: any) => {
    try {
        const variantId = product.shopifyVariantId.replace('gid://shopify/ProductVariant/', '');
        await axios.put(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}.json`,
            {
                variant: {
                    id: parseInt(variantId),
                    price: price.toFixed(2),
                    metafields: [
                        {
                            namespace: 'gemini',
                            key: 'price_breakdown',
                            value: JSON.stringify(breakdown),
                            type: 'json'
                        }
                    ]
                }
            },
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                    'Content-Type': 'application/json',
                },
            }
        );

        // Log Price History (Success)
        await prisma.priceHistory.create({
            data: {
                productId: product.id,
                oldPrice: product.currentPrice || 0,
                newPrice: price,
                status: 'success',
                triggeredBy: 'system'
            }
        });

        return true;
    } catch (error: any) {
        console.error(`Failed to push ${product.sku} to Shopify:`, error.message);

        // Log Price History (Failure)
        await prisma.priceHistory.create({
            data: {
                productId: product.id,
                oldPrice: product.currentPrice || 0,
                newPrice: price,
                status: 'failed',
                errorMessage: error.message,
                triggeredBy: 'system'
            }
        });
        return false;
    }
};

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// Mock Shopify session for local dev
app.use('/api/*', (req, res, next) => {
    res.locals.shopify = {
        session: {
            shop: SHOPIFY_STORE,
        },
    };
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get rates
app.get('/api/rates', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        // Get all metal rates
        const allMetalRates = await prisma.metalRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
        });

        // Group by metal and karat, keeping only the latest
        const latestRatesMap = new Map();
        for (const rate of allMetalRates) {
            const key = `${rate.metal}-${rate.karat || 'null'}`;
            if (!latestRatesMap.has(key)) {
                latestRatesMap.set(key, rate);
            }
        }

        const metalRates = Array.from(latestRatesMap.values());

        const stoneRates = await prisma.stoneRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
        });

        const metalRatesWithChange = metalRates.map((rate) => ({
            ...rate,
            ratePer10g: rate.ratePerGram * 10,
            change24h: 0,
        }));

        res.json({ metalRates: metalRatesWithChange, stoneRates });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch rates' });
    }
});

// Update rate
app.post('/api/rates/update', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { metal, karat, ratePerGram, reason } = req.body;

        const newRate = await prisma.metalRate.create({
            data: {
                shopId: shop.id,
                metal,
                karat: karat || null,
                ratePerGram: parseFloat(ratePerGram),
                rateSource: 'manual',
                reason,
            },
        });

        console.log(`✅ Updated ${metal} ${karat ? karat + 'K' : ''} rate to ₹${ratePerGram}/g`);

        // Log audit
        await logAudit(shop.id, 'rate_update', 'metal_rate', newRate.id, { newValue: newRate }, reason);

        // Find all products with this metal and karat
        const affectedProducts = await prisma.product.findMany({
            where: {
                shopId: shop.id,
                metal: metal,
                karat: karat || null,
                weightGrams: { not: null },
            },
        });

        console.log(`📊 Found ${affectedProducts.length} products to update`);

        // Use async bulk processing for large batches
        if (affectedProducts.length > 100) {
            console.log(`⏳ Large batch detected - using async processing for ${affectedProducts.length} products`);

            const jobId = await BulkPriceUpdateService.triggerUpdate({
                shopId: shop.id,
                metal,
                karat,
                triggeredBy: 'rate_change',
            });

            return res.json({
                success: true,
                rate: newRate,
                productsAffected: affectedProducts.length,
                message: `Queued bulk update for ${affectedProducts.length} products`,
                jobId,
                async: true,
            });
        }

        // Process synchronously for small batches (<=100)
        console.log(`✅ Small batch - processing ${affectedProducts.length} products synchronously`);

        // Recalculate prices for all affected products
        let updatedCount = 0;
        const settings = shop.settings || {
            defaultMakingPerGram: 1500,
            defaultWastagePct: 2,
            defaultGstPct: 3,
            defaultDiscount: 0,
        };

        for (const product of affectedProducts) {
            try {
                // Calculate new price
                const { price: newPrice, breakdown } = calculateProductPrice(product, parseFloat(ratePerGram), settings);

                // Update in database
                await prisma.product.update({
                    where: { id: product.id },
                    data: { currentPrice: newPrice },
                });

                // Push to Shopify
                const success = await pushToShopify(product, newPrice, breakdown);
                if (success) updatedCount++;

                // Small delay to avoid rate limits
                if (updatedCount % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`Error updating product ${product.sku}:`, error);
            }
        }

        console.log(`✅ Updated ${updatedCount} products in Shopify`);

        res.json({
            success: true,
            rate: newRate,
            productsUpdated: updatedCount,
            productsAffected: affectedProducts.length
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update rate' });
    }
});

// Update gemstone/stone rate
app.post('/api/stone-rates/update', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { stoneType, cut, color, clarity, caratRange, ratePerCarat, ratePerPiece, reason } = req.body;

        const newRate = await prisma.stoneRate.create({
            data: {
                shopId: shop.id,
                stoneType,
                cut: cut || null,
                color: color || null,
                clarity: clarity || null,
                caratRange: caratRange || null,
                ratePerCarat: ratePerCarat ? parseFloat(ratePerCarat) : null,
                ratePerPiece: ratePerPiece ? parseFloat(ratePerPiece) : null,
                updatedBy: 'manual',
                reason,
            },
        });

        console.log(`✅ Updated ${stoneType} rate: ${ratePerCarat ? `₹${ratePerCarat}/carat` : `₹${ratePerPiece}/piece`}`);

        res.json({ success: true, rate: newRate });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update stone rate' });
    }
});

// Get audit logs
app.get('/api/audit', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: { shopId: shop.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit as string),
            }),
            prisma.auditLog.count({ where: { shopId: shop.id } }),
        ]);

        res.json({
            logs,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string)),
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Get price history
app.get('/api/audit/history', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const [history, total] = await Promise.all([
            prisma.priceHistory.findMany({
                include: { product: { select: { sku: true, title: true } } },
                orderBy: { pushedAt: 'desc' },
                skip,
                take: parseInt(limit as string),
            }),
            prisma.priceHistory.count(),
        ]);

        res.json({
            history,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string)),
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get products
app.get('/api/products', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { page = 1, limit = 50, search } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const where: any = { shopId: shop.id };
        if (search) {
            where.OR = [
                { sku: { contains: search as string } },
                { title: { contains: search as string } },
            ];
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: parseInt(limit as string),
                orderBy: { updatedAt: 'desc' },
            }),
            prisma.product.count({ where }),
        ]);

        res.json({
            products,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Sync products from Shopify
app.post('/api/products/sync', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        console.log(`Syncing products from ${SHOPIFY_STORE}...`);

        // Fetch products from Shopify REST API
        console.log('Making Shopify API request...');
        const response = await axios.get(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250`,
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                },
                timeout: 30000,
            }
        );

        console.log('Received response from Shopify.');
        const shopifyProducts = response.data.products;
        console.log(`Fetched ${shopifyProducts.length} products to process.`);

        let syncedCount = 0;

        for (const product of shopifyProducts) {
            const imageUrl = product.image?.src || product.images?.[0]?.src || null;
            const status = product.status;

            // console.log(`Processing ${product.id}: ${product.title} (Status: ${status}, Image: ${imageUrl ? 'Yes' : 'No'})`);

            for (const variant of product.variants) {
                await prisma.product.upsert({
                    where: { shopifyVariantId: `gid://shopify/ProductVariant/${variant.id}` },
                    create: {
                        shopId: shop.id,
                        shopifyProductId: `gid://shopify/Product/${product.id}`,
                        shopifyVariantId: `gid://shopify/ProductVariant/${variant.id}`,
                        sku: variant.sku || null,
                        title: product.title,
                        variantTitle: variant.title,
                        imageUrl,
                        status,
                        currentPrice: parseFloat(variant.price),
                    },
                    update: {
                        title: product.title,
                        variantTitle: variant.title,
                        imageUrl,
                        status,
                        currentPrice: parseFloat(variant.price),
                        sku: variant.sku || null,
                    },
                });
                syncedCount++;
            }
        }

        console.log(`✅ Synced ${syncedCount} products from Shopify`);
        res.json({ success: true, syncedCount });
    } catch (error: any) {
        console.error('Error syncing products:', error.message);
        if (error.response) {
            console.error('Shopify Response Error:', JSON.stringify(error.response.data, null, 2));
        }
        res.status(500).json({
            error: 'Failed to sync products',
            details: error.response?.data || error.message
        });
    }
});

// Export products
app.get('/api/products/export', async (req, res) => {
    try {
        const format = req.query.format as string;
        const shop = await prisma.shop.findFirst();
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        const products = await prisma.product.findMany({
            where: { shopId: shop.id },
            orderBy: { title: 'asc' },
        });

        const data = products.map(p => ({
            SKU: p.sku,
            Title: p.title,
            weightGrams: p.weightGrams,
            metal: p.metal,
            karat: p.karat,
            gemstoneType: p.gemstoneType,
            gemstoneCut: p.gemstoneCut,
            gemstoneColor: p.gemstoneColor,
            gemstoneClarity: p.gemstoneClarity,
            gemstoneCaratRange: p.gemstoneCaratRange,
            manualGemstonePrice: p.manualGemstonePrice,
            isManualGemstonePrice: p.isManualGemstonePrice ? 'Yes' : 'No',
            CurrentPrice: p.currentPrice
        }));

        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Products');

        if (format === 'csv') {
            const csv = xlsx.utils.sheet_to_csv(worksheet);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
            res.send(csv);
        } else {
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
            res.send(buffer);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export products' });
    }
});

// Import products from CSV/Excel
app.post('/api/products/import', upload.single('file'), async (req: any, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        // Parse file
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`📂 Processing import file: ${req.file.originalname} (${rows.length} rows)`);

        let updatedCount = 0;
        let errors: any[] = [];

        // Get metal rates once for lookup
        const metalRates = await prisma.metalRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
        });

        const settings = shop.settings || {
            defaultMakingPerGram: 1500,
            defaultWastagePct: 2,
            defaultGstPct: 3,
            defaultDiscount: 0,
        };

        for (const row of rows) {
            const sku = row.sku || row.SKU || row.Sku;
            if (!sku) continue;

            try {
                // Find product by SKU
                const product = await prisma.product.findFirst({ where: { shopId: shop.id, sku: String(sku) } });

                if (!product) {
                    errors.push({ sku, error: 'Product not found' });
                    continue;
                }

                // Prepare update data
                const updateData: any = {};
                // Helper to normalize keys? simple check for now
                if (row.weightGrams !== undefined) updateData.weightGrams = parseFloat(row.weightGrams);
                if (row.metal !== undefined) updateData.metal = row.metal;
                if (row.karat !== undefined) updateData.karat = parseInt(row.karat);
                if (row.gemstoneType !== undefined) updateData.gemstoneType = row.gemstoneType;
                if (row.gemstoneCut !== undefined) updateData.gemstoneCut = row.gemstoneCut;
                if (row.gemstoneColor !== undefined) updateData.gemstoneColor = row.gemstoneColor;
                if (row.gemstoneClarity !== undefined) updateData.gemstoneClarity = row.gemstoneClarity;
                if (row.gemstoneCaratRange !== undefined) updateData.gemstoneCaratRange = row.gemstoneCaratRange;

                // Manual overrides
                if (row.manualGemstonePrice !== undefined) {
                    updateData.manualGemstonePrice = parseFloat(row.manualGemstonePrice);
                    updateData.isManualGemstonePrice = true;
                }

                // Update product in DB
                const updatedProduct = await prisma.product.update({
                    where: { id: product.id },
                    data: updateData
                });

                // Calculate Price if needed
                let newPrice = updatedProduct.currentPrice;
                if (updatedProduct.weightGrams && updatedProduct.metal) {
                    const rate = metalRates.find(r =>
                        r.metal === updatedProduct.metal &&
                        (updatedProduct.karat ? r.karat === updatedProduct.karat : true)
                    );

                    if (rate) {
                        const { price, breakdown } = calculateProductPrice(updatedProduct, rate.ratePerGram, settings);
                        newPrice = price;

                        // Update DB Price
                        await prisma.product.update({
                            where: { id: product.id },
                            data: { currentPrice: newPrice }
                        });

                        // Push to Shopify & Log History
                        await pushToShopify(updatedProduct, newPrice, breakdown);
                    }
                }

                // Log Audit
                await logAudit(shop.id, 'bulk_import', 'product', product.id, { oldValue: {}, newValue: updateData }, 'Bulk Import via File');

                updatedCount++;
                if (updatedCount % 10 === 0) await new Promise(r => setTimeout(r, 200));

            } catch (err: any) {
                console.error(`Error processing SKU ${sku}:`, err);
                errors.push({ sku, error: err.message });
            }
        }

        res.json({ success: true, updatedCount, errors });
    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to process import file' });
    }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            weightGrams, metal, karat,
            gemstoneType, gemstoneCut, gemstoneColor,
            gemstoneClarity, gemstoneCaratRange
        } = req.body;

        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        // Update product details
        const product = await prisma.product.update({
            where: { id },
            data: {
                weightGrams: weightGrams ? parseFloat(weightGrams) : null,
                metal: metal || null,
                karat: karat ? parseInt(karat) : null,
                gemstoneType: gemstoneType || null,
                gemstoneCut: gemstoneCut || null,
                gemstoneColor: gemstoneColor || null,
                gemstoneClarity: gemstoneClarity || null,
                gemstoneCaratRange: gemstoneCaratRange || null,
                isManualGemstonePrice: req.body.isManualGemstonePrice || false,
                manualGemstoneWeight: req.body.manualGemstoneWeight ? parseFloat(req.body.manualGemstoneWeight) : null,
                manualGemstonePrice: req.body.manualGemstonePrice ? parseFloat(req.body.manualGemstonePrice) : null,
            },
        });

        // Calculate new price if we have weight and metal
        let newPrice = product.currentPrice;
        if (product && product.weightGrams && product.metal) {
            // Get current metal rate
            const metalRate = await prisma.metalRate.findFirst({
                where: {
                    shopId: shop.id,
                    metal: product.metal,
                    karat: product.karat || null,
                },
                orderBy: { updatedAt: 'desc' },
            });

            if (metalRate) {
                // Get settings for making charge, wastage, GST
                const settings = shop.settings || {
                    defaultMakingPerGram: 1500,
                    defaultWastagePct: 2,
                    defaultGstPct: 3,
                    defaultDiscount: 0,
                };

                // Calculate price
                const { price: calculatedPrice, breakdown } = calculateProductPrice(product, metalRate.ratePerGram, settings);
                newPrice = calculatedPrice;

                // Update product with new price
                await prisma.product.update({
                    where: { id },
                    data: { currentPrice: newPrice },
                });

                console.log(`✅ Calculated price for ${product.sku}: ₹${newPrice.toFixed(2)}`);

                // Push updated price to Shopify & Log History
                await pushToShopify(product, newPrice, breakdown);

                // Log audit
                await logAudit(shop.id, 'product_update', 'product', id, { oldValue: {}, newValue: { ...req.body, price: newPrice } }, 'Manual Update');

                res.json({ success: true, product: { ...product, currentPrice: newPrice } });
            } else {
                // Metal rate not found
                res.json({ success: true, product });
            }
        } else {
            // Not enough info to calc price
            res.json({ success: true, product });
        }
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Get price breakdown for a product
app.get('/api/products/:id/price-breakdown', async (req, res) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.findUnique({ where: { id } });
        if (!product || !product.weightGrams || !product.metal) {
            return res.status(400).json({ error: 'Product must have weight and metal set' });
        }

        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const metalRate = await prisma.metalRate.findFirst({
            where: { shopId: shop.id, metal: product.metal, karat: product.karat || null },
            orderBy: { updatedAt: 'desc' },
        });

        if (!metalRate) {
            return res.status(404).json({ error: 'Metal rate not found' });
        }

        const settings = shop.settings || {
            defaultMakingPerGram: 1500,
            defaultWastagePct: 2,
            defaultGstPct: 3,
            defaultDiscount: 0,
        };

        const { breakdown } = calculateProductPrice(product, metalRate.ratePerGram, settings);

        res.json({ breakdown });
    } catch (error) {
        console.error('Error calculating price breakdown:', error);
        res.status(500).json({ error: 'Failed to calculate price breakdown' });
    }
});

// Get settings
app.get('/api/settings', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        res.json({ shop, settings: shop.settings });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings
app.put('/api/settings', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const settings = await prisma.shopSettings.upsert({
            where: { shopId: shop.id },
            create: { shopId: shop.id, ...req.body },
            update: req.body,
        });

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Root
app.get('/', (req, res) => {
    res.json({
        message: 'Metal & Gem Price Editor API',
        status: 'running',
        shop: SHOPIFY_STORE,
    });
});

// Health check endpoint for Render.com
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'gemini-backend'
    });
});

// ===== BULK OPERATIONS =====

// Trigger bulk price update
app.post('/api/bulk/trigger-price-update', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { metal, karat } = req.body;
        const jobId = await BulkPriceUpdateService.triggerUpdate({
            shopId: shop.id,
            metal,
            karat,
            triggeredBy: 'manual',
        });

        res.json({
            success: true,
            jobId,
            message: 'Price update queued. Check job status for progress.',
        });
    } catch (error) {
        console.error('Error triggering bulk update:', error);
        res.status(500).json({ error: 'Failed to trigger bulk update' });
    }
});

// Get job status
app.get('/api/bulk/job-status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await BulkPriceUpdateService.getJobStatus(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json(job);
    } catch (error) {
        console.error('Error fetching job status:', error);
        res.status(500).json({ error: 'Failed to fetch job status' });
    }
});

// Get active jobs
app.get('/api/bulk/active-jobs', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const jobs = await BulkPriceUpdateService.getActiveJobs(shop.id);
        res.json({ jobs });
    } catch (error) {
        console.error('Error fetching active jobs:', error);
        res.status(500).json({ error: 'Failed to fetch active jobs' });
    }
});

// Get recent jobs
app.get('/api/bulk/recent-jobs', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const limit = parseInt(req.query.limit as string) || 10;
        const jobs = await BulkPriceUpdateService.getRecentJobs(shop.id, limit);
        res.json({ jobs });
    } catch (error) {
        console.error('Error fetching recent jobs:', error);
        res.status(500).json({ error: 'Failed to fetch recent jobs' });
    }
});

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Connected to: ${SHOPIFY_STORE}`);
    console.log(`✅ Ready for manual price entry!`);
});

export { prisma };
