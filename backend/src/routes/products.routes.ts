import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PricingService } from '../services/pricing.service';
import { ShopifyService } from '../services/shopify.service';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

const router = Router();
const prisma = new PrismaClient();

// Get products with pagination and filters
router.get('/', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const {
            page = 1,
            limit = 50,
            search,
            metal,
            karat,
        } = req.query;

        const where: any = { shopId: shop.id };
        if (search) {
            where.OR = [
                { sku: { contains: search as string, mode: 'insensitive' } },
                { title: { contains: search as string, mode: 'insensitive' } },
            ];
        }
        if (metal) where.metal = metal;
        if (karat) where.karat = parseInt(karat as string);

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip: (parseInt(page as string) - 1) * parseInt(limit as string),
                take: parseInt(limit as string),
                orderBy: { updatedAt: 'desc' },
                include: { gemstones: true },
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
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Import products from CSV/XLSX
router.post('/import', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { fileData, fileType } = req.body; // Base64 encoded file data

        let rows: any[];

        if (fileType === 'csv') {
            const csvData = Buffer.from(fileData, 'base64').toString('utf-8');
            rows = parse(csvData, { columns: true, skip_empty_lines: true });
        } else if (fileType === 'xlsx') {
            const buffer = Buffer.from(fileData, 'base64');
            const workbook = XLSX.read(buffer);
            const sheetName = workbook.SheetNames[0];
            rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        } else {
            return res.status(400).json({ error: 'Unsupported file type' });
        }

        const imported: any[] = [];
        const errors: any[] = [];

        for (const row of rows) {
            try {
                const { SKU, Name, 'Weight(g)': weightGrams, Karat, Metal, 'StoneWeight(ct)': stoneWeightCarat, StoneType } = row;

                if (!SKU) {
                    errors.push({ row, error: 'SKU is required' });
                    continue;
                }

                // Find matching Shopify product by SKU
                const existingProduct = await prisma.product.findFirst({
                    where: { shopId: shop.id, sku: SKU },
                });

                if (existingProduct) {
                    // Update existing product
                    await prisma.product.update({
                        where: { id: existingProduct.id },
                        data: {
                            weightGrams: weightGrams ? parseFloat(weightGrams) : undefined,
                            karat: Karat ? parseInt(Karat) : undefined,
                            metal: Metal || undefined,
                            stoneWeightCarat: stoneWeightCarat ? parseFloat(stoneWeightCarat) : undefined,
                            stoneType: StoneType || undefined,
                        },
                    });
                    imported.push({ sku: SKU, status: 'updated' });
                } else {
                    errors.push({ row, error: 'Product not found in Shopify. Sync products first.' });
                }
            } catch (error) {
                errors.push({ row, error: (error as Error).message });
            }
        }

        res.json({
            success: true,
            imported: imported.length,
            errors: errors.length,
            details: { imported, errors },
        });
    } catch (error) {
        console.error('Error importing products:', error);
        res.status(500).json({ error: 'Failed to import products' });
    }
});

// Preview price changes for selected products
router.post('/preview-prices', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { productIds } = req.body;

        if (!productIds || !Array.isArray(productIds)) {
            return res.status(400).json({ error: 'Product IDs array is required' });
        }

        const preview = await PricingService.calculateBulkPrices(shop.id, productIds);

        res.json({ preview });
    } catch (error) {
        console.error('Error previewing prices:', error);
        res.status(500).json({ error: 'Failed to preview prices' });
    }
});

// Push prices to Shopify
router.post('/push', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { productIds } = req.body;

        if (!productIds || !Array.isArray(productIds)) {
            return res.status(400).json({ error: 'Product IDs array is required' });
        }

        // Calculate new prices
        const preview = await PricingService.calculateBulkPrices(shop.id, productIds);

        // Prepare updates for Shopify
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
        });

        const updates = products.map((product) => {
            const priceData = preview.find((p) => p.productId === product.id);
            return {
                variantId: product.shopifyVariantId,
                price: priceData?.newPrice || product.currentPrice || 0,
            };
        });

        // Push to Shopify
        const shopifyService = await ShopifyService.forShop(shopDomain);

        let result;
        if (updates.length > 1000) {
            // Use bulk operations for large updates
            const bulkOpId = await shopifyService.updateVariantPricesBulk(updates);
            result = { bulkOperationId: bulkOpId, message: 'Bulk operation started' };
        } else {
            // Use batch updates for smaller sets
            result = await shopifyService.updateVariantPricesBatch(updates);
        }

        // Update local database and create history records
        for (const product of products) {
            const priceData = preview.find((p) => p.productId === product.id);
            if (priceData) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: {
                        lastCalculatedPrice: priceData.newPrice,
                        lastPushedPrice: priceData.newPrice,
                        lastPushedAt: new Date(),
                    },
                });

                await prisma.priceHistory.create({
                    data: {
                        productId: product.id,
                        oldPrice: priceData.oldPrice,
                        newPrice: priceData.newPrice,
                        status: 'success',
                        triggeredBy: 'manual',
                    },
                });
            }
        }

        // Create audit log
        await prisma.auditLog.create({
            data: {
                shopId: shop.id,
                userId: shopDomain,
                action: 'price_push',
                entity: 'product',
                newValue: JSON.stringify({ count: productIds.length }),
            },
        });

        res.json({ success: true, result });
    } catch (error) {
        console.error('Error pushing prices:', error);
        res.status(500).json({ error: 'Failed to push prices' });
    }
});

// Sync products from Shopify
router.post('/sync', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const shopifyService = await ShopifyService.forShop(shopDomain);
        const syncedCount = await shopifyService.syncProducts(shop.id);

        res.json({ success: true, syncedCount });
    } catch (error) {
        console.error('Error syncing products:', error);
        res.status(500).json({ error: 'Failed to sync products' });
    }
});

// Update product mapping
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const { id } = req.params;
        const { gemstones, ...updates } = req.body;

        // Update product with basic fields
        const product = await prisma.product.update({
            where: { id, shopId: shop.id },
            data: updates,
        });

        // Handle gemstones separately if provided
        if (gemstones !== undefined) {
            // Delete all existing gemstones for this product
            await prisma.productGemstone.deleteMany({
                where: { productId: id },
            });

            // Create new gemstones if any
            if (Array.isArray(gemstones) && gemstones.length > 0) {
                await prisma.productGemstone.createMany({
                    data: gemstones.map((gem: any) => ({
                        productId: id,
                        gemstoneType: gem.gemstoneType,
                        gemstoneCut: gem.gemstoneCut || null,
                        gemstoneColor: gem.gemstoneColor || null,
                        gemstoneClarity: gem.gemstoneClarity || null,
                        gemstoneCaratRange: gem.gemstoneCaratRange || null,
                        gemstoneWeight: gem.gemstoneWeight || null,
                        discountType: gem.discountType || null,
                        discountValue: gem.discountValue || null,
                    })),
                });
            }
        }

        // Fetch the updated product with gemstones
        const updatedProduct = await prisma.product.findUnique({
            where: { id },
            include: { gemstones: true },
        });

        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Generate Template
router.get('/template', async (req: Request, res: Response) => {
    try {
        const format = req.query.format as string || 'xlsx';

        // Accurate columns based on import logic
        const headers = [
            {
                SKU: 'Example-SKU-123',
                Name: 'Gold Ring with Diamond (Reference Only)',
                'Weight(g)': 5.5,
                Karat: 22,
                Metal: 'gold',
                'StoneWeight(ct)': 0.5,
                StoneType: 'diamond'
            }
        ];

        if (format === 'csv') {
            const csvContent = 'SKU,Name,Weight(g),Karat,Metal,StoneWeight(ct),StoneType\nExample-SKU-123,Gold Ring (Ref),5.5,22,gold,0.5,diamond';
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=products_template.csv');
            res.send(csvContent);
        } else {
            const worksheet = XLSX.utils.json_to_sheet(headers);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=products_template.xlsx');
            res.send(buffer);
        }
    } catch (error) {
        console.error('Error generating template:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Export Products
router.get('/export', async (req: Request, res: Response) => {
    try {
        const shopDomain = res.locals.shopify.session.shop;
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const format = req.query.format as string || 'xlsx';
        const products = await prisma.product.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
            include: { gemstones: true }
        });

        // Flatten data for export
        const rows = products.map(p => {
            const gemInfo = p.gemstones.map(g => `${g.gemstoneType} (${g.gemstoneWeight}ct)`).join(', ');
            return {
                SKU: p.sku,
                Title: p.title,
                Variant: p.variantTitle,
                Status: p.status,
                'Weight(g)': p.weightGrams,
                Karat: p.karat,
                Metal: p.metal,
                Price: p.currentPrice,
                'Stone Info': gemInfo,
                'Last Updated': p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''
            };
        });

        if (format === 'csv') {
            const worksheet = XLSX.utils.json_to_sheet(rows);
            const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=products_export_${Date.now()}.csv`);
            res.send(csvOutput);
        } else {
            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=products_export_${Date.now()}.xlsx`);
            res.send(buffer);
        }
    } catch (error) {
        console.error('Error exporting products:', error);
        res.status(500).json({ error: 'Failed to export products' });
    }
});

export default router;
