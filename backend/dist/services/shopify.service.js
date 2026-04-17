"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopifyService = void 0;
const axios_1 = __importDefault(require("axios"));
const node_cache_1 = __importDefault(require("node-cache"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const collectionCache = new node_cache_1.default({ stdTTL: 300 }); // Cache for 5 minutes
class ShopifyService {
    constructor(domain, accessToken) {
        this.domain = domain;
        this.accessToken = accessToken;
    }
    // Restore forShop method for BulkPriceUpdateService
    static async forShop(domain) {
        // Fetch the shop and access token from database
        const prisma = new client_1.PrismaClient();
        try {
            const shop = await prisma.shop.findUnique({
                where: { domain }
            });
            if (!shop || !shop.accessToken) {
                throw new Error(`Shop ${domain} not found or missing access token`);
            }
            return new ShopifyService(domain, shop.accessToken);
        } finally {
            await prisma.$disconnect();
        }
    }
    // Update variant with price breakdown metafield
    /**
     * Generate HTML breakdown for Shopify product description
     */
    static generateBreakdownHtml(breakdown) {
        if (!breakdown) return '';
        const fmt = (n) => (n / 100).toFixed(2);
        
        // Dynamic require to avoid circular dependency or missing utils
        let gemstoneDisplay;
        try { gemstoneDisplay = require('../utils/gemstoneDisplay'); } catch (e) {
            gemstoneDisplay = { getGemstoneDisplayName: (t) => t };
        }
        
        const getDisplay = (t) => gemstoneDisplay.getGemstoneDisplayName(t || '').replace(/_/g, ' ');

        let html = `
    <!-- GEMS_PRICE_BREAKDOWN_START -->
    <div style="margin-top: 20px; border: 1px solid #e1e3e5; border-radius: 8px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <h3 style="background-color: #f9fafb; margin: 0; padding: 12px 16px; font-size: 16px; border-bottom: 1px solid #e1e3e5; color: #1a1c1d;">Price Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead style="background-color: #f9fafb; border-bottom: 1px solid #e1e3e5;">
                <tr>
                    <th style="padding: 10px 16px; text-align: left; font-weight: 600; color: #4a4d4f;">Component</th>
                    <th style="padding: 10px 16px; text-align: right; font-weight: 600; color: #4a4d4f;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        ${breakdown.metal_name || 'Metal'} Price
                        ${breakdown.has_metal_discount ? `<span style="margin-left:8px; font-size:11px; color:#d93025; background:#fee2e2; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Sale</span>` : ''}
                        <div style="font-size: 11px; color: #6b7280; font-weight: 400;">(₹${fmt(breakdown.metal_rate)}/g)</div>
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500; color: #1a1c1d;">
                        ${breakdown.has_metal_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 11px; font-weight: 400;">₹${fmt(breakdown.metal_value_original)}</div>` : ''}
                        ₹${fmt(breakdown.metal_value)}
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        Wastage
                        <div style="font-size: 11px; color: #6b7280; font-weight: 400;">(${breakdown.wastage_pct}%)</div>
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500; color: #1a1c1d;">₹${fmt(breakdown.wastage_amount)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        Making Charges
                        ${breakdown.has_making_discount ? `<span style="margin-left:8px; font-size:11px; color:#d93025; background:#fee2e2; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Sale</span>` : ''}
                        <div style="font-size: 11px; color: #6b7280; font-weight: 400;">
                            ${breakdown.making_charge_type === 'percent' ? `${breakdown.making_charge_rate}% of value` :
            breakdown.making_charge_type === 'flat' ? 'Flat Rate' : `₹${breakdown.making_charge_rate}/g`}
                        </div>
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500; color: #1a1c1d;">
                        ${breakdown.has_making_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 11px; font-weight: 400;">₹${fmt(breakdown.making_charges_original)}</div>` : ''}
                        ₹${fmt(breakdown.making_charges)}
                    </td>
                </tr>`;

        if (breakdown.gemstone_details && breakdown.gemstone_details.type === 'multiple' && breakdown.gemstone_details.gemstones && breakdown.gemstone_details.gemstones.length > 0) {
            for (const gem of breakdown.gemstone_details.gemstones) {
                const displayType = getDisplay(gem.type);
                const gemName = `${displayType}${gem.clarity ? ` (${gem.clarity})` : ''}${gem.color ? ` ${gem.color}` : ''}${gem.cut ? ` ${gem.cut}` : ''}`;
                
                const gemTypeSafe = (gem.type || '').toLowerCase();
                const isCZ = gemTypeSafe.includes('cubic zirconia') || gemTypeSafe.includes('cz');
                const unit = isCZ ? 'gm' : 'ct';

                let gemSubtext = '';
                if (gem.weight) {
                    const rate = Math.round((gem.cost / 100 / gem.weight) || 0);
                    gemSubtext = `${gem.weight}${unit} × ₹${rate.toLocaleString()}/${unit}`;
                }
                else if (gem.pieces) {
                    const rate = Math.round((gem.cost / 100 / gem.pieces) || 0);
                    gemSubtext = `${gem.pieces} pcs × ₹${rate.toLocaleString()}/pc`;
                }
                html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        ${gemName}
                        ${gem.hasDiscount ? `<span style="margin-left:8px; font-size:11px; color:#d93025; background:#fee2e2; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Sale</span>` : ''}
                        ${gemSubtext ? `<div style="font-size: 11px; color: #6b7280; font-weight: 400;">${gemSubtext}</div>` : ''}
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500; color: #1a1c1d;">
                        ${gem.hasDiscount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 11px; font-weight: 400;">₹${fmt(gem.cost)}</div>` : ''}
                        ₹${fmt(gem.finalCost)}
                    </td>
                </tr>`;
            }
        }
        else if ((breakdown.gemstone_price > 0 || breakdown.gemstone_price_original > 0) && breakdown.gemstone_details) {
            const isCZ = (breakdown.gemstone_name?.toLowerCase().includes('cubic zirconia') || breakdown.gemstone_name?.toLowerCase().includes('cz'));
            const unit = isCZ ? 'gm' : 'ct';

            html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        ${breakdown.gemstone_name || 'Gemstone'}
                        ${breakdown.has_gemstone_discount ? `<span style="margin-left:8px; font-size:11px; color:#d93025; background:#fee2e2; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Sale</span>` : ''}
                        ${(breakdown.gemstone_details && breakdown.gemstone_details.type === 'per_carat') ? `
                            <div style="font-size: 11px; color: #6b7280; font-weight: 400;">
                                ${breakdown.gemstone_details.weight}${unit} × ₹${(breakdown.gemstone_details.rate || 0).toLocaleString()}/${unit}
                            </div>` : ''}
                        ${(breakdown.gemstone_details && breakdown.gemstone_details.type === 'per_piece') ? `
                            <div style="font-size: 11px; color: #6b7280; font-weight: 400;">
                                ${breakdown.gemstone_details.pieces} pcs × ₹${(breakdown.gemstone_details.rate || 0).toLocaleString()}/pc
                            </div>` : ''}
                        ${(breakdown.gemstone_details && breakdown.gemstone_details.type === 'manual') ? `
                            <div style="font-size: 11px; color: #6b7280; font-weight: 400;">Gemstone Pricing Source: Manual (Per Piece)</div>` : 
                            `<div style="font-size: 11px; color: #6b7280; font-weight: 400;">Gemstone Pricing Source: Rate-Based</div>`}
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500; color: #1a1c1d;">
                        ${breakdown.has_gemstone_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 11px; font-weight: 400;">₹${fmt(breakdown.gemstone_price_original)}</div>` : ''}
                        ₹${fmt(breakdown.gemstone_price)}
                    </td>
                </tr>`;
        }
        if (breakdown.enamel_price > 0 || breakdown.enamel_price_original > 0) {
            html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        ${breakdown.enamel_name || 'Enamel'}
                        ${breakdown.has_enamel_discount ? `<span style="margin-left:8px; font-size:11px; color:#d93025; background:#fee2e2; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Sale</span>` : ''}
                        ${(breakdown.enamel_details && breakdown.enamel_details.type === 'per_gram') ? `
                            <div style="font-size: 11px; color: #6b7280; font-weight: 400;">
                                ${breakdown.enamel_details.weight}g × ₹${(breakdown.enamel_details.rate || 0).toLocaleString()}/g
                            </div>` : ''}
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500; color: #1a1c1d;">
                        ${breakdown.has_enamel_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 11px; font-weight: 400;">₹${fmt(breakdown.enamel_price_original)}</div>` : ''}
                        ₹${fmt(breakdown.enamel_price)}
                    </td>
                </tr>`;
        }
        html += `
                <tr style="background-color: #fafbfb; border-top: 1px solid #e1e3e5;">
                    <td style="padding: 10px 16px; font-weight: 600; color: #374151;">Subtotal</td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 600; color: #1a1c1d;">₹${fmt(breakdown.subtotal)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        GST
                        <div style="font-size: 11px; color: #6b7280; font-weight: 400;">(${breakdown.gst_pct}%)</div>
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500; color: #1a1c1d;">₹${fmt(breakdown.gst_amount || breakdown.gst || 0)}</td>
                </tr>`;
        if (breakdown.discount > 0) {
            const discLabel = breakdown.global_discount_value ? `(${breakdown.global_discount_value}${breakdown.global_discount_type === 'percent' ? '%' : '₹'})` : '';
            html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #d93025;">
                        Shop Discount
                        <div style="font-size: 11px; color: #d93025; font-weight: 400;">${discLabel}</div>
                    </td>
                    <td style="padding: 10px 16px; text-align: right; color: #d93025; font-weight: 500;">-₹${fmt(breakdown.discount)}</td>
                </tr>`;
        }
        if (breakdown.product_discount > 0) {
            const discLabel = breakdown.product_discount_value ? `(${breakdown.product_discount_value}${breakdown.product_discount_type === 'percent' ? '%' : '₹'})` : '';
            html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #d93025;">
                        Product Discount
                        <div style="font-size: 11px; color: #d93025; font-weight: 400;">${discLabel}</div>
                    </td>
                    <td style="padding: 10px 16px; text-align: right; color: #d93025; font-weight: 500;">-₹${fmt(breakdown.product_discount)}</td>
                </tr>`;
        }
        html += `
                <tr style="background-color: #f0fdf4;">
                    <td style="padding: 14px 16px; font-weight: 700; color: #166534; font-size: 16px;">Final Price</td>
                    <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #166534; font-size: 16px;">
                        ${breakdown.has_any_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 11px; font-weight: 400;">₹${fmt(breakdown.total_original)}</div>` : ''}
                        ₹${fmt(breakdown.total)}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div style="margin-top: 10px; font-size: 12px; color: #6b7280; text-align: center; font-style: italic;">
        * Prices are subject to change based on market rates.
    </div>
    <!-- GEMS_PRICE_BREAKDOWN_END -->
    `;
        return html;
    }

    // Update variant with full price breakdown (price, description, and metafields)
    async updateVariantWithBreakdown(variantId, price, breakdown) {
        try {
            // Ensure breakdown is an object if possible
            if (typeof breakdown === 'string') {
                try {
                    breakdown = JSON.parse(breakdown);
                } catch (e) {
                    // Stay as string if not valid JSON
                }
            }
            console.log(`Updating variant ${variantId} with price ₹${price} and full breakdown...`);

            // GID for GraphQL
            const gid = variantId.startsWith('gid://') ? variantId : `gid://shopify/ProductVariant/${variantId}`;
            // Numeric ID for REST
            const numericId = variantId.includes('ProductVariant/') ? variantId.split('ProductVariant/').pop() : (variantId.replace('gid://shopify/ProductVariant/', ''));

            // Step 1: Update price via REST API
            const priceRes = await axios_1.default.put(
                `https://${this.domain}/admin/api/2024-01/variants/${numericId}.json`,
                { variant: { id: numericId, price: price.toFixed(2) } },
                { headers: ShopifyService.getHeaders(this.accessToken) }
            );
            console.log(`[SHOPIFY] ✓ Price updated successfully to ₹${priceRes.data.variant.price}`);

            // Step 2: Update Metafields (Consolidated)
            if (breakdown) {
                const metafieldMutation = `
                    mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
                        metafieldsSet(metafields: $metafields) {
                            metafields { id key value }
                            userErrors { field message }
                        }
                    }
                `;
                const metafieldVariables = {
                    metafields: [
                        { ownerId: gid, namespace: "custom", key: "price_breakdown", value: typeof breakdown === 'string' ? breakdown : JSON.stringify(breakdown), type: "json" },
                        { ownerId: gid, namespace: "gemini", key: "price_breakdown", value: typeof breakdown === 'string' ? breakdown : JSON.stringify(breakdown), type: "json" },
                        { ownerId: gid, namespace: "custom", key: "code_form", value: typeof breakdown === 'string' ? breakdown : JSON.stringify(breakdown), type: "json" },
                        { ownerId: gid, namespace: "custom", key: "makingcharges", value: (breakdown.making_charges / 100).toFixed(2), type: "number_decimal" }
                    ]
                };
                const mfRes = await axios_1.default.post(`https://${this.domain}/admin/api/2024-01/graphql.json`, 
                    { query: metafieldMutation, variables: metafieldVariables }, 
                    { headers: ShopifyService.getHeaders(this.accessToken) }
                );
                if (mfRes.data.errors) console.error('[SHOPIFY] Metafield GraphQL errors:', mfRes.data.errors);
                else console.log(`[SHOPIFY] ✓ Metafields updated successfully`);
            }

            // Step 3: Update Product Description (with HTML table)
            if (breakdown) {
                const productQuery = `query($id: ID!) { productVariant(id: $id) { product { id bodyHtml } } }`;
                const pRes = await axios_1.default.post(`https://${this.domain}/admin/api/2024-01/graphql.json`, 
                    { query: productQuery, variables: { id: gid } }, 
                    { headers: ShopifyService.getHeaders(this.accessToken) }
                );
                
                const productData = pRes.data?.data?.productVariant?.product;
                if (productData) {
                    console.log(`[SHOPIFY] Found product ${productData.id} for variant ${variantId}`);
                    const currentHtml = productData.bodyHtml || '';
                    const newTableHtml = ShopifyService.generateBreakdownHtml(breakdown);
                    const regex = /<!-- GEMS_PRICE_BREAKDOWN_START -->[\s\S]*?<!-- GEMS_PRICE_BREAKDOWN_END -->/;
                    let newBodyHtml = regex.test(currentHtml) ? currentHtml.replace(regex, newTableHtml) : currentHtml + newTableHtml;

                    console.log(`[SHOPIFY] HTML changed: ${newBodyHtml !== currentHtml}`);
                    if (newBodyHtml !== currentHtml) {
                        const updateDescMutation = `mutation($id: ID!, $html: String!) { productUpdate(input: { id: $id, bodyHtml: $html }) { userErrors { message } } }`;
                        const updateRes = await axios_1.default.post(`https://${this.domain}/admin/api/2024-01/graphql.json`, 
                            { query: updateDescMutation, variables: { id: productData.id, html: newBodyHtml } }, 
                            { headers: ShopifyService.getHeaders(this.accessToken) }
                        );
                        
                        const errors = updateRes.data?.data?.productUpdate?.userErrors;
                        if (errors && errors.length > 0) {
                            console.error(`[SHOPIFY] ❌ Mutation Errors:`, JSON.stringify(errors));
                        } else {
                            console.log(`[SHOPIFY] ✓ Product description updated with HTML table`);
                        }
                    } else {
                        console.log(`[SHOPIFY] Table HTML is already up to date, skipping description update.`);
                    }
                } else {
                    console.warn(`[SHOPIFY] ⚠️ Product not found in Shopify for variant ${variantId}`);
                }
            }

            return { success: true };
        } catch (error) {
            console.error(`[SHOPIFY] Failed to update variant ${variantId}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    // Restore updateVariantPricesBatch for BulkPriceUpdateService
    async updateVariantPricesBatch(updates) {
        console.log(`Pushing ${updates.length} price updates to Shopify...`);
        const results = [];
        for (const update of updates) {
            try {
                // Use the comprehensive method for all updates if breakdown is available
                results.push(await this.updateVariantWithBreakdown(
                    update.variantId,
                    update.price,
                    update.breakdown
                ));
            }
            catch (error) {
                console.error(`Failed to update variant ${update.variantId} on Shopify:`, error);
                results.push({ success: false, result: error });
            }
        }
        return results;
    }
    // Add updateVariantPricesBulk as a placeholder or simple implementation
    async updateVariantPricesBulk(updates) {
        console.log(`Starting bulk update for ${updates.length} variants (simplified direct batch)...`);
        this.updateVariantPricesBatch(updates).catch(err => console.error("Bulk-simulated batch failed:", err));
        return "gid://shopify/BulkOperation/simulated_" + Date.now();
    }
    // Helper to get headers
    static getHeaders(accessToken) {
        return {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
        };
    }
    // Fetch all collections (id, title) - cached
    static async getAllCollections(accessToken) {
        const cacheKey = `collections_${accessToken}`;
        // Explicit cast to fix TS error
        const cached = collectionCache.get(cacheKey);
        if (cached)
            return cached;
        try {
            console.log('Fetching collections from Shopify...');
            const query = `
                {
                    collections(first: 250) {
                        edges {
                            node {
                                id
                                title
                            }
                        }
                    }
                }
            `;
            const response = await axios_1.default.post(`https://${this.shopDomainEnv}/admin/api/2024-01/graphql.json`, { query }, { headers: this.getHeaders(accessToken) });
            if (response.data.errors) {
                console.error('Shopify GraphQL Error:', response.data.errors);
                return [];
            }
            const collections = response.data.data.collections.edges.map((edge) => ({
                id: edge.node.id,
                title: edge.node.title,
            }));
            let hasNextPage = response.data.data.collections.pageInfo?.hasNextPage;
            let endCursor = response.data.data.collections.pageInfo?.endCursor;
            while (hasNextPage) {
                const nextQuery = `
                    {
                        collections(first: 250, after: "${endCursor}") {
                            edges {
                                node {
                                    id
                                    title
                                }
                            }
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                        }
                    }
                `;
                const nextRes = await axios_1.default.post(`https://${this.shopDomainEnv}/admin/api/2024-01/graphql.json`, { query: nextQuery }, { headers: this.getHeaders(accessToken) });
                const nextEdges = nextRes.data.data.collections.edges || [];
                collections.push(...nextEdges.map((edge) => ({
                    id: edge.node.id,
                    title: edge.node.title,
                })));
                hasNextPage = nextRes.data.data.collections.pageInfo?.hasNextPage;
                endCursor = nextRes.data.data.collections.pageInfo?.endCursor;
            }
            collectionCache.set(cacheKey, collections);
            return collections;
        }
        catch (error) {
            console.error('Error fetching collections:', error);
            return [];
        }
    }
    // Get Product IDs for a collection
    static async getCollectionProductIds(accessToken, collectionId, shopDomain) {
        const domain = shopDomain || this.shopDomainEnv;
        // Ensure collectionId is a valid GID
        if (collectionId && !collectionId.startsWith('gid://')) {
            collectionId = `gid://shopify/Collection/${collectionId}`;
        }
        const cacheKey = `col_products_${collectionId}_${domain}`;
        const cached = collectionCache.get(cacheKey);
        if (cached)
            return cached;
        try {
            console.log(`[SHOPIFY SERVICE V2] Fetching products for collection ${collectionId} on domain ${domain}`);
            let allProductIds = [];
            let hasNextPage = true;
            let cursor = null;
            while (hasNextPage) {
                const query = `
                    query($id: ID!, $cursor: String) {
                        node(id: $id) {
                            ... on Collection {
                                products(first: 250, after: $cursor) {
                                    edges {
                                        node {
                                            id
                                        }
                                    }
                                    pageInfo {
                                        hasNextPage
                                        endCursor
                                    }
                                }
                            }
                        }
                    }
                `;
                const variables = { id: collectionId, cursor };
                const response = await axios_1.default.post(`https://${domain}/admin/api/2024-01/graphql.json`, { query, variables }, { headers: this.getHeaders(accessToken) });
                if (response.data.errors) {
                    console.error('Shopify GraphQL Error (Collection Products):', JSON.stringify(response.data.errors, null, 2));
                    break;
                }
                const data = response.data.data.node?.products;
                if (!data) {
                    console.log(`[SHOPIFY SERVICE V2] No collection found for ${collectionId}. Data:`, JSON.stringify(response.data.data, null, 2));
                    break;
                }
                allProductIds.push(...data.edges.map((e) => e.node.id)); // These are GIDs
                hasNextPage = data.pageInfo.hasNextPage;
                cursor = data.pageInfo.endCursor;
            }
            console.log(`[SHOPIFY SERVICE V2] Found ${allProductIds.length} product IDs in Shopify. Sample: ${allProductIds[0]}`);
            collectionCache.set(cacheKey, allProductIds, 300); // Cache for 5 mins
            return allProductIds;
        }
        catch (error) {
            console.error(`Error fetching products for collection ${collectionId}:`, error);
            return [];
        }
    }
    // Sync products from Shopify
    async syncProducts(shopId) {
        console.log(`Starting sync for shop ${shopId}`);
        let job = null;
        try {
            // 1. Create Job
            job = await prisma.job.create({
                data: {
                    shopId,
                    jobType: 'product_sync',
                    status: 'running',
                    totalItems: 0,
                    processedItems: 0
                }
            });
            // 2. Fetch all products from Shopify
            // We'll use a simplified fetch here relying on the existing collection fetch or a direct product fetch
            // For improved reliability, let's implement a direct product fetch generator or loop
            const products = await this.fetchAllProducts();
            // Update job with total count
            await prisma.job.update({
                where: { id: job.id },
                data: { totalItems: products.length }
            });
            // 3. Process and Upsert
            let productsProcessed = 0;
            let variantsSynced = 0;
            let duplicatesSkipped = 0;
            let failed = 0;
            // Feature: Deletion Sync
            // Collect valid Shopify Product IDs currently in Shopify
            const currentShopifyProductIds = new Set();
            const batchSize = 50;
            for (let i = 0; i < products.length; i += batchSize) {
                const batch = products.slice(i, i + batchSize);
                await Promise.all(batch.map(async (p) => {
                    // Track valid product ID
                    currentShopifyProductIds.add(p.id);
                    // Iterate over all variants
                    const variants = p.variants.edges.map((e) => e.node);
                    if (variants.length === 0) {
                        return;
                    }
                    for (const variant of variants) {
                        try {
                            const price = variant?.price ? parseFloat(variant.price) : 0;
                            const variantId = variant?.id || `gid://shopify/ProductVariant/${p.id}`; // Fallback
                            // Safety check for duplicates is handled by upsert on unique shopifyVariantId
                            await prisma.product.upsert({
                                where: { shopifyVariantId: variantId },
                                create: {
                                    shopId,
                                    shopifyProductId: p.id,
                                    shopifyVariantId: variantId,
                                    sku: variant?.sku || '',
                                    title: p.title,
                                    variantTitle: variant?.title !== 'Default Title' ? variant?.title : null,
                                    currentPrice: price,
                                    status: p.status,
                                    imageUrl: p.images?.edges[0]?.node?.url || null,
                                    // Default fields
                                    weightGrams: 0,
                                    makingChargeValue: 0,
                                },
                                update: {
                                    title: p.title,
                                    status: p.status,
                                    currentPrice: price,
                                    sku: variant?.sku || undefined,
                                    imageUrl: p.images?.edges[0]?.node?.url || undefined,
                                }
                            });
                            variantsSynced++;
                        }
                        catch (err) {
                            console.error(`Failed to upsert variant ${variant?.id} for product ${p.id}:`, err);
                            failed++;
                        }
                    }
                    productsProcessed++;
                }));
                // Update progress every batch
                await prisma.job.update({
                    where: { id: job.id },
                    data: { processedItems: productsProcessed }
                });
            }
            // Feature: Deletion Sync Execution
            // Remove products that are in DB but NOT in the fetched list
            console.log('Starting Deletion Sync Analysis...');
            const localProducts = await prisma.product.findMany({
                where: { shopId },
                select: { shopifyProductId: true }
            });
            const localProductIds = new Set(localProducts.map(p => p.shopifyProductId));
            const idsToDelete = [...localProductIds].filter(id => !currentShopifyProductIds.has(id));
            let deletedCount = 0;
            if (idsToDelete.length > 0) {
                console.log(`Found ${idsToDelete.length} stale products to delete.`);
                const deleteResult = await prisma.product.deleteMany({
                    where: {
                        shopId,
                        shopifyProductId: { in: idsToDelete }
                    }
                });
                deletedCount = deleteResult.count;
                console.log(`Successfully deleted ${deletedCount} stale variants/products.`);
            }
            else {
                console.log('No stale products found. Local DB is in sync.');
            }
            console.log(`✅ Sync Summary: ${productsProcessed} products processed, ${variantsSynced} variants synced, ${deletedCount} deleted`);
            // 4. Complete Job
            await prisma.job.update({
                where: { id: job.id },
                data: {
                    status: 'completed',
                    result: JSON.stringify({ created: variantsSynced, failed, deleted: deletedCount }),
                    completedAt: new Date(),
                    processedItems: productsProcessed // Ensure final count is accurate
                }
            });
            console.log(`Sync completed for shop ${shopId}`);
        }
        catch (error) {
            console.error('Sync failed:', error);
            if (job) {
                await prisma.job.update({
                    where: { id: job.id },
                    data: {
                        status: 'failed',
                        error: error.message || 'Unknown error',
                        completedAt: new Date()
                    }
                });
            }
        }
    }
    // Helper to fetch all products
    async fetchAllProducts() {
        const products = [];
        let hasNextPage = true;
        let cursor = null;
        console.log('Fetching all products from Shopify...');
        while (hasNextPage) {
            const query = `
            query($cursor: String) {
                products(first: 250, after: $cursor) {
                    edges {
                        node {
                            id
                            title
                            status
                            images(first: 1) {
                                edges {
                                    node {
                                        url
                                    }
                                }
                            }
                            variants(first: 100) {
                                edges {
                                    node {
                                        id
                                        sku
                                        title
                                        price
                                    }
                                }
                            }
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;
            const response = await axios_1.default.post(`https://${ShopifyService.shopDomainEnv}/admin/api/2024-01/graphql.json`, { query, variables: { cursor } }, { headers: ShopifyService.getHeaders(this.accessToken) });
            if (response.data.errors) {
                throw new Error(JSON.stringify(response.data.errors));
            }
            const data = response.data.data.products;
            products.push(...data.edges.map((e) => e.node));
            hasNextPage = data.pageInfo.hasNextPage;
            cursor = data.pageInfo.endCursor;
        }
        return products;
    }
}
exports.ShopifyService = ShopifyService;
ShopifyService.shopDomainEnv = process.env.SHOPIFY_STORE;
//# sourceMappingURL=shopify.service.js.map