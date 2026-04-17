"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const multer_1 = __importDefault(require("multer"));
const xlsx = __importStar(require("xlsx"));
const bulkPriceUpdate_service_1 = require("./services/bulkPriceUpdate.service");
const PORT = process.env.PORT || 3000;
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'daginawala11.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const IS_DESKTOP_MODE = process.env.NODE_ENV === 'development' && !process.env.SHOPIFY_ACCESS_TOKEN;
if (!SHOPIFY_ACCESS_TOKEN) {
    console.warn('⚠️  WARNING: SHOPIFY_ACCESS_TOKEN not set in environment variables');
    console.warn('⚠️  Running in DESKTOP MODE - Shopify sync features will be limited');
    console.warn('⚠️  Set SHOPIFY_ACCESS_TOKEN in backend/.env to enable full functionality');
}
const app = (0, express_1.default)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Helper to calculate price and breakdown
const calculateProductPrice = async (product, ratePerGram, stoneRate, settings, enamelRate = null) => {
    console.log('✨ calculateProductPrice - product.gemstones:', product.gemstones);
    // NEW: Auto Gross Weight Calculation
    let resolvedWeight = product.weightGrams || 0;
    if (product.autoGrossGoldWeight) {
        let stonesWeight = 0;
        if (product.gemstones && product.gemstones.length > 0) {
            stonesWeight = product.gemstones.reduce((sum, g) => sum + (g.gemstoneWeight || 0), 0);
        }
        else if (product.stoneWeightCarat) {
            stonesWeight = product.stoneWeightCarat;
        }
        resolvedWeight = (product.weightGrams || 0) + stonesWeight + (product.enamelWeightGrams || 0);
    }
    else if (product.grossGoldWeight != null && product.grossGoldWeight > 0) {
        resolvedWeight = product.grossGoldWeight;
    }
    const weight = resolvedWeight || 0;
    const metalValueRaw = ratePerGram * weight;
    // Defaults
    const wastagePct = settings.defaultWastagePct ?? 2;
    // Making charge lookup: Product override > Shop Default > Fallback
    const makingChargeType = product.makingChargeType || settings.defaultMakingChargeType || 'per_gram';
    const makingChargeValue = (product.makingChargeValue !== undefined && product.makingChargeValue !== null && !isNaN(product.makingChargeValue))
        ? product.makingChargeValue
        : (settings.defaultMakingChargeValue ?? 1500);
    const gstPct = settings.defaultGstPct ?? 3;
    const discount = settings.defaultDiscount ?? 0;
    const wastageAmount = metalValueRaw * (wastagePct / 100);
    const metalValue = metalValueRaw + wastageAmount;
    // --- DISCOUNT LOGIC ---
    const applyDiscount = (original, type, value) => {
        if (!type || type === 'none')
            return original;
        if (type === 'percent')
            return original * (1 - value / 100);
        if (type === 'flat')
            return Math.max(0, original - value);
        return original;
    };
    // 1. Metal Discount
    const metalDiscType = product.metalDiscountType || settings.defaultMetalDiscountType;
    const metalDiscValue = product.metalDiscountValue ?? settings.defaultMetalDiscountValue;
    const finalMetalValue = applyDiscount(metalValue, metalDiscType, metalDiscValue);
    // Calculate Making Charge based on Type
    let makingCharge = 0;
    if (makingChargeType === 'per_gram') {
        makingCharge = makingChargeValue * weight;
    }
    else if (makingChargeType === 'percent') {
        // Percentage of (Metal Value + Wastage) - typically undiscounted
        makingCharge = metalValue * (makingChargeValue / 100);
    }
    else if (makingChargeType === 'flat') {
        makingCharge = makingChargeValue;
    }
    else {
        makingCharge = 1500 * weight;
    }
    // 2. Making Charge Discount
    const makingDiscType = product.makingDiscountType || settings.defaultMakingDiscountType;
    const makingDiscValue = product.makingDiscountValue ?? settings.defaultMakingDiscountValue;
    const finalMakingCharge = applyDiscount(makingCharge, makingDiscType, makingDiscValue);
    let gemstoneCost = 0;
    let stoneDetails = null;
    const gemstonesArray = [];
    // Handle multiple gemstones (new approach)
    if (product.gemstones && product.gemstones.length > 0) {
        console.log(`🔍 Processing ${product.gemstones.length} gemstones for product`);
        for (const gemstone of product.gemstones) {
            console.log(`  - Gemstone: ${gemstone.gemstoneType}`);
            let gemCost = 0;
            // Find stone rate for this gemstone
            const gemStoneRate = await prisma.stoneRate.findFirst({
                where: {
                    shopId: product.shopId,
                    stoneType: gemstone.gemstoneType,
                    cut: gemstone.gemstoneCut || null,
                    // COLOR REMOVED PER GUARDRAIL 2: Never used in rate lookup
                    clarity: gemstone.gemstoneClarity || null,
                },
            });
            let rateNotSet = false;
            if (gemstone.isCustom) {
                // GUARDRAIL 1 & 3: Mandatory Validation & No Implicit Defaults
                if (gemstone.pricePerPiece == null ||
                    gemstone.pricePerPiece <= 0 ||
                    gemstone.gemstonePieces == null ||
                    gemstone.gemstonePieces <= 0) {
                    // SAFETY: Ignore invalid custom gemstone entirely
                    continue;
                }
                gemCost = gemstone.pricePerPiece * gemstone.gemstonePieces;
            }
            else if (gemStoneRate) {
                if (gemStoneRate.ratePerCarat && gemstone.gemstoneWeight) {
                    gemCost = gemStoneRate.ratePerCarat * gemstone.gemstoneWeight;
                }
                else if (gemStoneRate.ratePerPiece && gemstone.gemstonePieces) {
                    gemCost = gemStoneRate.ratePerPiece * gemstone.gemstonePieces;
                }
                else if (gemStoneRate.ratePerPiece) {
                    // If no pieces specified, assume 1 piece
                    gemCost = gemStoneRate.ratePerPiece;
                }
            }
            else {
                // No rate found for this gemstone
                rateNotSet = true;
            }
            // Apply individual gemstone discount if set, otherwise use product default
            const gemDiscType = gemstone.discountType || product.gemstoneDiscountType || settings.defaultGemstoneDiscountType;
            const gemDiscValue = gemstone.discountValue ?? product.gemstoneDiscountValue ?? settings.defaultGemstoneDiscountValue;
            const finalGemCost = applyDiscount(gemCost, gemDiscType, gemDiscValue);
            gemstoneCost += finalGemCost;
            gemstonesArray.push({
                type: gemstone.gemstoneType,
                cut: gemstone.gemstoneCut,
                color: gemstone.gemstoneColor,
                clarity: gemstone.gemstoneClarity,
                caratRange: gemstone.gemstoneCaratRange,
                weight: gemstone.gemstoneWeight,
                pieces: gemstone.gemstonePieces,
                cost: Math.round(gemCost * 100), // Convert to paise for display
                finalCost: Math.round(finalGemCost * 100), // Convert to paise for display
                hasDiscount: gemCost !== finalGemCost,
                rateNotSet: rateNotSet,
            });
        }
        stoneDetails = { type: 'multiple', gemstones: gemstonesArray, totalCost: gemstoneCost };
    }
    // Fallback to old single gemstone approach for backward compatibility
    else if (product.isManualGemstonePrice) {
        gemstoneCost = product.manualGemstonePrice || 0;
        stoneDetails = { type: 'manual', cost: gemstoneCost };
    }
    else if (stoneRate) {
        if (stoneRate.ratePerCarat) {
            const stoneWeight = product.stoneWeightCarat || 0;
            gemstoneCost = stoneRate.ratePerCarat * stoneWeight;
            stoneDetails = { type: 'per_carat', rate: stoneRate.ratePerCarat, weight: stoneWeight, cost: gemstoneCost };
        }
        else if (stoneRate.ratePerPiece) {
            const pieces = product.stonePieces || 0;
            gemstoneCost = stoneRate.ratePerPiece * pieces;
            stoneDetails = { type: 'per_piece', rate: stoneRate.ratePerPiece, pieces: pieces, cost: gemstoneCost };
        }
        // Apply discount for old single gemstone
        const stoneDiscType = product.gemstoneDiscountType || settings.defaultGemstoneDiscountType;
        const stoneDiscValue = product.gemstoneDiscountValue ?? settings.defaultGemstoneDiscountValue;
        gemstoneCost = applyDiscount(gemstoneCost, stoneDiscType, stoneDiscValue);
    }
    const finalGemstoneCost = gemstoneCost; // Already discounted above
    // 4. Enamel Cost Calculation
    let enamelCost = 0;
    let enamelDetails = null;
    if (product.enamelColor && product.enamelWeightGrams && enamelRate) {
        if (enamelRate.ratePerGram) {
            enamelCost = enamelRate.ratePerGram * product.enamelWeightGrams;
            enamelDetails = {
                type: 'per_gram',
                color: product.enamelColor,
                rate: enamelRate.ratePerGram,
                weight: product.enamelWeightGrams,
                cost: enamelCost
            };
        }
    }
    // 5. Enamel Discount
    const enamelDiscType = product.enamelDiscountType || settings.defaultEnamelDiscountType;
    const enamelDiscValue = product.enamelDiscountValue ?? settings.defaultEnamelDiscountValue;
    const finalEnamelCost = applyDiscount(enamelCost, enamelDiscType, enamelDiscValue);
    // Final Calculation
    const subtotal = finalMetalValue + finalMakingCharge + finalGemstoneCost + finalEnamelCost;
    const gstAmount = subtotal * (gstPct / 100);
    const finalPrice = subtotal + gstAmount - discount; // Global discount (legacy)
    // Store all values × 100 for precision and consistency
    return {
        price: finalPrice,
        breakdown: {
            metal: product.metal,
            karat: product.karat,
            weight: weight,
            metal_name: `${product.metal} ${product.karat ? product.karat + 'K' : ''}`,
            metal_rate: Math.round(ratePerGram * 100),
            // Original Values
            metal_value_original: Math.round(metalValue * 100),
            making_charges_original: Math.round(makingCharge * 100),
            gemstone_price_original: Math.round(gemstoneCost * 100),
            enamel_price_original: Math.round(enamelCost * 100),
            // Final Values (visible)
            metal_value: Math.round(finalMetalValue * 100), // Used by current UI
            making_charges: Math.round(finalMakingCharge * 100),
            gemstone_price: Math.round(finalGemstoneCost * 100),
            enamel_price: Math.round(finalEnamelCost * 100),
            wastage_amount: Math.round(wastageAmount * 100),
            wastage_pct: wastagePct,
            making_charge_type: makingChargeType,
            making_charge_rate: makingChargeValue,
            gemstone_name: stoneDetails ? (stoneRate?.stoneType || product.gemstoneType) : 'Gemstone',
            gemstone_details: stoneDetails,
            enamel_name: enamelDetails ? `${enamelDetails.color} Enamel` : 'Enamel',
            enamel_details: enamelDetails,
            subtotal: Math.round(subtotal * 100),
            gst_amount: Math.round(gstAmount * 100),
            gst_pct: gstPct,
            discount: Math.round(discount * 100), // Global discount
            total: Math.round(finalPrice * 100),
            total_original: Math.round((metalValue + makingCharge + gemstoneCost + enamelCost + ((metalValue + makingCharge + gemstoneCost + enamelCost) * (gstPct / 100)) - discount) * 100),
            // Discount Flags
            has_metal_discount: finalMetalValue < metalValue,
            has_making_discount: finalMakingCharge < makingCharge,
            has_gemstone_discount: finalGemstoneCost < gemstoneCost,
            has_enamel_discount: finalEnamelCost < enamelCost,
            has_any_discount: (finalPrice < (metalValue + makingCharge + gemstoneCost + enamelCost + ((metalValue + makingCharge + gemstoneCost + enamelCost) * (gstPct / 100)) - discount))
        }
    };
};
// Helper to log audit events
const logAudit = async (shopId, action, entity, entityId, details, reason) => {
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
    }
    catch (e) {
        console.error('Failed to log audit:', e);
    }
};
// Helper to generate HTML table for breakdown
const generateBreakdownHtml = (breakdown) => {
    // Format helper
    const fmt = (n) => (n / 100).toFixed(2);
    let html = `
    <!-- GEMS_PRICE_BREAKDOWN_START -->
    <div style="margin-top: 20px; border: 1px solid #e1e3e5; border-radius: 8px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <h3 style="background-color: #f9fafb; margin: 0; padding: 12px 16px; font-size: 16px; border-bottom: 1px solid #e1e3e5;">Price Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tbody>
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        ${breakdown.metal_name || 'Metal'} Price
                        ${breakdown.has_metal_discount ? `<span style="margin-left:8px; font-size:12px; color:#d93025; background:#fee2e2; padding:2px 6px; border-radius:4px;">Sale</span>` : ''}
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500;">
                        ${breakdown.has_metal_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 12px;">₹${fmt(breakdown.metal_value_original)}</div>` : ''}
                        ₹${fmt(breakdown.metal_value)}
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">Wastage (${breakdown.wastage_pct}%)</td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500;">₹${fmt(breakdown.wastage_amount)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        Making Charges
                        ${breakdown.has_making_discount ? `<span style="margin-left:8px; font-size:12px; color:#d93025; background:#fee2e2; padding:2px 6px; border-radius:4px;">Sale</span>` : ''}
                        <div style="font-size: 12px; color: #6b7280;">
                            ${breakdown.making_charge_type === 'percent' ? `${breakdown.making_charge_rate}% of value` :
        breakdown.making_charge_type === 'flat' ? 'Flat Rate' : `₹${breakdown.making_charge_rate}/g`}
                        </div>
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500;">
                        ${breakdown.has_making_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 12px;">₹${fmt(breakdown.making_charges_original)}</div>` : ''}
                        ₹${fmt(breakdown.making_charges)}
                    </td>
                </tr>`;
    // Handle multiple gemstones - only show if there are actual gemstones
    if (breakdown.gemstone_details && breakdown.gemstone_details.type === 'multiple' && breakdown.gemstone_details.gemstones && breakdown.gemstone_details.gemstones.length > 0) {
        for (const gem of breakdown.gemstone_details.gemstones) {
            const displayType = (gem.type || '').replace(/_/g, ' ');
            const gemName = `${displayType}${gem.clarity ? ` (${gem.clarity})` : ''}${gem.color ? ` ${gem.color}` : ''}${gem.cut ? ` ${gem.cut}` : ''}`;
            let gemSubtext = '';
            if (gem.weight) {
                const rate = Math.round((gem.cost / 100 / gem.weight) || 0);
                gemSubtext = `${gem.weight}ct × ₹${rate.toLocaleString()}/ct`;
            }
            else if (gem.pieces) {
                const rate = Math.round((gem.cost / 100 / gem.pieces) || 0);
                gemSubtext = `${gem.pieces} pcs × ₹${rate.toLocaleString()}/pc`;
            }
            html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        ${gemName}
                        ${gem.hasDiscount ? `<span style="margin-left:8px; font-size:12px; color:#d93025; background:#fee2e2; padding:2px 6px; border-radius:4px;">Sale</span>` : ''}
                        ${gemSubtext ? `<div style="font-size: 12px; color: #6b7280;">${gemSubtext}</div>` : ''}
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500;">
                        ${gem.hasDiscount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 12px;">₹${fmt(gem.cost)}</div>` : ''}
                        ₹${fmt(gem.finalCost)}
                    </td>
                </tr>`;
        }
        // Total gemstones row
        if (breakdown.gemstone_details.gemstones.length > 1) {
            html += `
                <tr style="border-bottom: 1px solid #f1f2f3; background-color: #f9fafb;">
                    <td style="padding: 10px 16px; color: #374151; font-weight: 600;">Total Gemstones</td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 600;">₹${fmt(breakdown.gemstone_price)}</td>
                </tr>`;
        }
    }
    // Fallback to old single gemstone display - only show if price > 0
    else if ((breakdown.gemstone_price > 0 || breakdown.gemstone_price_original > 0) && breakdown.gemstone_details) {
        html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        ${breakdown.gemstone_name || 'Gemstone'}
                        ${breakdown.has_gemstone_discount ? `<span style="margin-left:8px; font-size:12px; color:#d93025; background:#fee2e2; padding:2px 6px; border-radius:4px;">Sale</span>` : ''}
                        ${(breakdown.gemstone_details && breakdown.gemstone_details.type === 'per_carat') ? `
                            <div style="font-size: 12px; color: #6b7280;">
                                ${breakdown.gemstone_details.weight}ct × ₹${(breakdown.gemstone_details.rate || 0).toLocaleString()}/ct
                            </div>` : ''}
                        ${(breakdown.gemstone_details && breakdown.gemstone_details.type === 'per_piece') ? `
                            <div style="font-size: 12px; color: #6b7280;">
                                ${breakdown.gemstone_details.pieces} pcs × ₹${(breakdown.gemstone_details.rate || 0).toLocaleString()}/pc
                            </div>` : ''}
                        ${(breakdown.gemstone_details && breakdown.gemstone_details.type === 'manual') ? `
                            <div style="font-size: 12px; color: #6b7280;">Manual Price</div>` : ''}
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500;">
                        ${breakdown.has_gemstone_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 12px;">₹${fmt(breakdown.gemstone_price_original)}</div>` : ''}
                        ₹${fmt(breakdown.gemstone_price)}
                    </td>
                </tr>`;
    }
    if (breakdown.enamel_price > 0 || breakdown.enamel_price_original > 0) {
        html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">
                        ${breakdown.enamel_name || 'Enamel'}
                        ${breakdown.has_enamel_discount ? `<span style="margin-left:8px; font-size:12px; color:#d93025; background:#fee2e2; padding:2px 6px; border-radius:4px;">Sale</span>` : ''}
                        ${(breakdown.enamel_details && breakdown.enamel_details.type === 'per_gram') ? `
                            <div style="font-size: 12px; color: #6b7280;">
                                ${breakdown.enamel_details.weight}g × ₹${(breakdown.enamel_details.rate || 0).toLocaleString()}/g
                            </div>` : ''}
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500;">
                        ${breakdown.has_enamel_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 12px;">₹${fmt(breakdown.enamel_price_original)}</div>` : ''}
                        ₹${fmt(breakdown.enamel_price)}
                    </td>
                </tr>`;
    }
    html += `
                <tr style="background-color: #fafbfb; border-top: 1px solid #e1e3e5;">
                    <td style="padding: 8px 16px; font-weight: 600; color: #374151;">Subtotal</td>
                    <td style="padding: 8px 16px; text-align: right; font-weight: 600; color: #374151;">₹${fmt(breakdown.subtotal)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #374151;">GST (${breakdown.gst_pct}%)</td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500;">₹${fmt(breakdown.gst_amount || breakdown.gst || 0)}</td>
                </tr>`;
    if (breakdown.discount > 0) {
        html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #d93025;">Discount</td>
                    <td style="padding: 10px 16px; text-align: right; color: #d93025;">-₹${fmt(breakdown.discount)}</td>
                </tr>`;
    }
    html += `
                <tr style="background-color: #f0fdf4;">
                    <td style="padding: 12px 16px; font-weight: 700; color: #166534;">Final Price</td>
                    <td style="padding: 12px 16px; text-align: right; font-weight: 700; color: #166534;">
                        ${breakdown.has_any_discount ? `<div style="text-decoration: line-through; color: #9ca3af; font-size: 12px; font-weight: 400;">₹${fmt(breakdown.total_original)}</div>` : ''}
                        ₹${fmt(breakdown.total)}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div style="margin-top: 8px; font-size: 12px; color: #6b7280; text-align: center;">
        Prices are subject to change based on market rates.
    </div>
    <!-- GEMS_PRICE_BREAKDOWN_END -->
    `;
    return html;
};
// Helper to push to Shopify & Log History
const pushToShopify = async (product, price, breakdown) => {
    try {
        const variantId = product.shopifyVariantId.replace('gid://shopify/ProductVariant/', '');
        const productId = product.shopifyProductId.replace('gid://shopify/Product/', '');
        console.log(`\n🔄 Pushing ${product.sku} to Shopify...`);
        console.log(`   Variant ID: ${variantId}`);
        console.log(`   Product ID: ${productId}`);
        console.log(`   New Price: ₹${price.toFixed(2)}`);
        // 1. Update Variant Price & Metafields
        console.log(`   Step 1: Updating variant price and metafield...`);
        const variantUpdateResponse = await axios_1.default.put(`https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}.json`, {
            variant: {
                id: parseInt(variantId),
                price: price.toFixed(2),
                metafields: [
                    {
                        namespace: 'custom',
                        key: 'code_form',
                        value: JSON.stringify(breakdown),
                        type: 'json'
                    },
                    {
                        namespace: 'gemini',
                        key: 'price_breakdown',
                        value: JSON.stringify(breakdown),
                        type: 'json'
                    }
                ]
            }
        }, {
            headers: {
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                'Content-Type': 'application/json',
            },
        });
        console.log(`   ✅ Variant updated successfully`);
        // Verify metafield was set
        try {
            const verifyResponse = await axios_1.default.get(`https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}/metafields.json`, {
                headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
            });
            const customMetafield = verifyResponse.data.metafields.find((m) => m.namespace === 'custom' && m.key === 'code_form');
            const geminiMetafield = verifyResponse.data.metafields.find((m) => m.namespace === 'gemini' && m.key === 'price_breakdown');
            if (customMetafield && geminiMetafield) {
                console.log(`   ✅ Both metafields verified: custom.code_form + gemini.price_breakdown`);
            }
            else {
                console.log(`   ⚠️  Warning: Metafield not found after update!`);
            }
        }
        catch (verifyError) {
            console.log(`   ⚠️  Could not verify metafield (non-critical)`);
        }
        // 2. Fetch Product to get current Description
        console.log(`   Step 2: Fetching product description...`);
        const productRes = await axios_1.default.get(`https://${SHOPIFY_STORE}/admin/api/2024-01/products/${productId}.json`, {
            headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
        });
        const currentHtml = productRes.data.product.body_html || '';
        const newTableHtml = generateBreakdownHtml(breakdown);
        let newBodyHtml = currentHtml;
        // Replace or Append
        const regex = /<!-- GEMS_PRICE_BREAKDOWN_START -->[\s\S]*?<!-- GEMS_PRICE_BREAKDOWN_END -->/;
        if (regex.test(currentHtml)) {
            newBodyHtml = currentHtml.replace(regex, newTableHtml);
            console.log(`   📝 Replacing existing price breakdown in description`);
        }
        else {
            newBodyHtml = currentHtml + newTableHtml;
            console.log(`   📝 Appending price breakdown to description`);
        }
        // 3. Update Product Description
        if (newBodyHtml !== currentHtml) {
            console.log(`   Step 3: Updating product description...`);
            await axios_1.default.put(`https://${SHOPIFY_STORE}/admin/api/2024-01/products/${productId}.json`, {
                product: {
                    id: parseInt(productId),
                    body_html: newBodyHtml
                }
            }, {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                    'Content-Type': 'application/json',
                },
            });
            console.log(`   ✅ Description updated successfully`);
        }
        else {
            console.log(`   ℹ️  Description unchanged, skipping update`);
        }
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
        console.log(`✅ Successfully pushed ${product.sku} to Shopify\n`);
        return true;
    }
    catch (error) {
        console.error(`\n❌ Failed to push ${product.sku} to Shopify`);
        console.error(`   Error Message: ${error.message}`);
        // Log detailed error information
        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Response Data:`, JSON.stringify(error.response.data, null, 2));
        }
        else if (error.request) {
            console.error(`   No response received from Shopify`);
            console.error(`   Request details:`, error.request);
        }
        else {
            console.error(`   Error details:`, error);
        }
        // Log Price History (Failure)
        await prisma.priceHistory.create({
            data: {
                productId: product.id,
                oldPrice: product.currentPrice || 0,
                newPrice: price,
                status: 'failed',
                errorMessage: error.response ? JSON.stringify(error.response.data) : error.message,
                triggeredBy: 'system'
            }
        });
        console.error(`\n`);
        return false;
    }
};
// Middleware
app.use((0, compression_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
// Database status check
app.get('/api/db-status', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        const productsCount = shop ? await prisma.product.count({ where: { shopId: shop.id } }) : 0;
        const ratesCount = shop ? await prisma.metalRate.count({ where: { shopId: shop.id } }) : 0;
        res.json({
            database: 'connected',
            shopConfigured: !!shop,
            shopDomain: shop?.domain || null,
            productsCount,
            metalRatesCount: ratesCount,
            isDesktopMode: IS_DESKTOP_MODE,
            hasShopifyCredentials: !!SHOPIFY_ACCESS_TOKEN
        });
    }
    catch (error) {
        res.status(500).json({
            database: 'error',
            error: error.message
        });
    }
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
        const enamelRates = await prisma.enamelRate.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: 'desc' },
        });
        const metalRatesWithChange = metalRates.map((rate) => ({
            ...rate,
            ratePer10g: rate.ratePerGram * 10,
            change24h: 0,
        }));
        res.json({ metalRates: metalRatesWithChange, stoneRates, enamelRates });
    }
    catch (error) {
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
        // Note: Product prices are NOT automatically updated
        // Users must manually trigger price updates via the "Update All Prices" button
        console.log(`ℹ️  Rate updated. Use "Update All Prices" to recalculate product prices.`);
        res.json({
            success: true,
            rate: newRate,
            message: 'Rate updated successfully. Click "Update All Prices" to recalculate product prices.'
        });
    }
    catch (error) {
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
        const { id, stoneType, naturalOrLabgrown, quality, shape, cut, color, clarity, caratRange, ratePerCarat, ratePerPiece, reason } = req.body;
        // If id is provided, update existing rate; otherwise create new
        if (id) {
            // Update existing rate
            const updatedRate = await prisma.stoneRate.update({
                where: { id },
                data: {
                    stoneType,
                    naturalOrLabgrown: naturalOrLabgrown || null,
                    quality: quality || null,
                    shape: shape || null,
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
            res.json({ success: true, rate: updatedRate });
        }
        else {
            // Create new rate
            const newRate = await prisma.stoneRate.create({
                data: {
                    shopId: shop.id,
                    stoneType,
                    naturalOrLabgrown: naturalOrLabgrown || null,
                    quality: quality || null,
                    shape: shape || null,
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
            console.log(`✅ Created ${stoneType} rate: ${ratePerCarat ? `₹${ratePerCarat}/carat` : `₹${ratePerPiece}/piece`}`);
            res.json({ success: true, rate: newRate });
        }
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update stone rate' });
    }
});
// Update enamel rate
app.post('/api/enamel-rates/update', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const { enamelColor, ratePerGram, reason } = req.body;
        const newRate = await prisma.enamelRate.create({
            data: {
                shopId: shop.id,
                enamelColor,
                ratePerGram: parseFloat(ratePerGram),
                updatedBy: 'manual',
                reason,
            },
        });
        console.log(`✅ Updated ${enamelColor} enamel rate: ₹${ratePerGram}/g`);
        res.json({ success: true, rate: newRate });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update enamel rate' });
    }
});
// Delete metal rate
app.delete('/api/rates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify rate belongs to shop before deleting
        const rate = await prisma.metalRate.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!rate) {
            return res.status(404).json({ error: 'Metal rate not found' });
        }
        await prisma.metalRate.delete({ where: { id } });
        console.log(`✅ Deleted ${rate.metal} ${rate.karat ? rate.karat + 'K' : ''} rate`);
        // Log audit
        await logAudit(shop.id, 'rate_delete', 'metal_rate', id, { oldValue: rate }, 'Manual deletion');
        res.json({ success: true, message: 'Rate deleted successfully' });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to delete metal rate' });
    }
});
// Delete stone rate
app.delete('/api/stone-rates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify rate belongs to shop before deleting
        const rate = await prisma.stoneRate.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!rate) {
            return res.status(404).json({ error: 'Stone rate not found' });
        }
        await prisma.stoneRate.delete({ where: { id } });
        console.log(`✅ Deleted ${rate.stoneType} rate`);
        // Log audit
        await logAudit(shop.id, 'rate_delete', 'stone_rate', id, { oldValue: rate }, 'Manual deletion');
        res.json({ success: true, message: 'Stone rate deleted successfully' });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to delete stone rate' });
    }
});
// Delete enamel rate
app.delete('/api/enamel-rates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        // Verify rate belongs to shop before deleting
        const rate = await prisma.enamelRate.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!rate) {
            return res.status(404).json({ error: 'Enamel rate not found' });
        }
        await prisma.enamelRate.delete({ where: { id } });
        console.log(`✅ Deleted ${rate.enamelColor} enamel rate`);
        // Log audit
        await logAudit(shop.id, 'rate_delete', 'enamel_rate', id, { oldValue: rate }, 'Manual deletion');
        res.json({ success: true, message: 'Enamel rate deleted successfully' });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to delete enamel rate' });
    }
});
// Get audit logs
app.get('/api/audit', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop)
            return res.status(404).json({ error: 'Shop not found' });
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: { shopId: shop.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.auditLog.count({ where: { shopId: shop.id } }),
        ]);
        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});
// Get price history
app.get('/api/audit/history', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [history, total] = await Promise.all([
            prisma.priceHistory.findMany({
                include: { product: { select: { sku: true, title: true } } },
                orderBy: { pushedAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.priceHistory.count(),
        ]);
        res.json({
            history,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            }
        });
    }
    catch (error) {
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
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = { shopId: shop.id };
        if (search) {
            // SQLite's LIKE operator (used by contains) is case-insensitive by default
            where.OR = [
                { sku: { contains: search } },
                { title: { contains: search } },
            ];
        }
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { updatedAt: 'desc' },
                include: { gemstones: true },
            }),
            prisma.product.count({ where }),
        ]);
        res.json({
            products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});
// Manual bulk price update endpoint
app.post('/api/products/update-all-prices', async (req, res) => {
    try {
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        console.log('🔄 Manual bulk price update triggered');
        // Trigger bulk update for all products
        const jobId = await bulkPriceUpdate_service_1.BulkPriceUpdateService.triggerUpdate({
            shopId: shop.id,
            triggeredBy: 'manual_update',
        });
        res.json({
            success: true,
            message: 'Bulk price update started. This may take a few minutes.',
            jobId,
        });
    }
    catch (error) {
        console.error('Error triggering bulk price update:', error);
        res.status(500).json({ error: 'Failed to trigger bulk price update' });
    }
});
// Sync products from Shopify
app.post('/api/products/sync', async (req, res) => {
    try {
        // Check if we have valid Shopify credentials
        if (!SHOPIFY_ACCESS_TOKEN) {
            return res.status(400).json({
                error: 'Shopify credentials not configured',
                message: 'Please set SHOPIFY_ACCESS_TOKEN in backend/.env to sync products'
            });
        }
        const shop = await prisma.shop.findFirst();
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        console.log(`Syncing products from ${SHOPIFY_STORE}...`);
        // Fetch products from Shopify REST API
        console.log('Making Shopify API request...');
        const response = await axios_1.default.get(`https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250`, {
            headers: {
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            },
            timeout: 60000, // Increased to 60 seconds
        });
        console.log('Received response from Shopify.');
        const shopifyProducts = response.data.products;
        console.log(`Fetched ${shopifyProducts.length} products to process.`);
        let syncedCount = 0;
        // Process products sequentially (reverted from batch processing)
        for (const product of shopifyProducts) {
            const imageUrl = product.image?.src || product.images?.[0]?.src || null;
            const status = product.status;
            console.log(`Processing product: ${product.title}`);
            for (const variant of product.variants) {
                try {
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
                    if (syncedCount % 10 === 0) {
                        console.log(`Processed ${syncedCount} variants so far...`);
                    }
                }
                catch (dbError) {
                    console.error(`Error upserting variant ${variant.id}:`, dbError.message);
                    throw dbError; // Re-throw to be caught by outer catch
                }
            }
        }
        console.log(`✅ Synced ${syncedCount} products from Shopify`);
        res.json({ success: true, syncedCount });
    }
    catch (error) {
        console.error('❌ Error syncing products:');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        if (error.response) {
            console.error('Shopify Response Status:', error.response.status);
            console.error('Shopify Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        res.status(500).json({
            error: 'Failed to sync products',
            message: error.message,
            details: error.response?.data || error.message
        });
    }
});
// Download sample template for import
app.get('/api/products/template', async (req, res) => {
    try {
        const format = req.query.format || 'xlsx';
        // Sample data with different product types
        const sampleData = [
            {
                SKU: 'GOLD-RING-001',
                Title: 'Sample Gold Ring with Diamond',
                weightGrams: 5.5,
                metal: 'gold',
                karat: 22,
                gemstones_json: JSON.stringify([{
                        gemstoneType: 'diamond',
                        gemstoneCut: 'Excellent',
                        gemstoneColor: 'D',
                        gemstoneClarity: 'VS1',
                        gemstoneWeight: 0.5,
                        gemstonePieces: 1
                    }]),
                makingChargeType: 'per_gram',
                makingChargeValue: 1500,
                CurrentPrice: ''
            },
            {
                SKU: 'GOLD-NECKLACE-002',
                Title: 'Sample Gold Necklace with Multiple Rubies',
                weightGrams: 25.0,
                metal: 'gold',
                karat: 18,
                gemstones_json: JSON.stringify([
                    {
                        gemstoneType: 'ruby',
                        gemstoneCut: 'Excellent',
                        gemstoneClarity: 'VS2',
                        gemstoneWeight: 1.0,
                        gemstonePieces: 3
                    },
                    {
                        gemstoneType: 'diamond',
                        gemstoneCut: 'Very Good',
                        gemstoneClarity: 'SI1',
                        gemstoneWeight: 0.25,
                        gemstonePieces: 5
                    }
                ]),
                makingChargeType: 'percent',
                makingChargeValue: 15,
                CurrentPrice: ''
            },
            {
                SKU: 'SILVER-BRACELET-003',
                Title: 'Sample Silver Bracelet (No Gemstones)',
                weightGrams: 15.0,
                metal: 'silver',
                karat: 925,
                gemstones_json: '',
                makingChargeType: 'flat',
                makingChargeValue: 500,
                CurrentPrice: ''
            }
        ];
        const worksheet = xlsx.utils.json_to_sheet(sampleData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Products Template');
        if (format === 'csv') {
            const csv = xlsx.utils.sheet_to_csv(worksheet);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="products_template.csv"');
            res.send(csv);
        }
        else {
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="products_template.xlsx"');
            res.send(buffer);
        }
    }
    catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});
// Export products
app.get('/api/products/export', async (req, res) => {
    try {
        const format = req.query.format;
        const shop = await prisma.shop.findFirst();
        if (!shop)
            return res.status(404).json({ error: 'Shop not found' });
        const products = await prisma.product.findMany({
            where: { shopId: shop.id },
            include: { gemstones: true },
            orderBy: { title: 'asc' },
        });
        const data = products.map(p => ({
            SKU: p.sku,
            Title: p.title,
            weightGrams: p.weightGrams,
            metal: p.metal,
            karat: p.karat,
            gemstones_json: p.gemstones && p.gemstones.length > 0
                ? JSON.stringify(p.gemstones.map(g => ({
                    gemstoneType: g.gemstoneType,
                    gemstoneCut: g.gemstoneCut,
                    gemstoneColor: g.gemstoneColor,
                    gemstoneClarity: g.gemstoneClarity,
                    gemstoneCaratRange: g.gemstoneCaratRange,
                    gemstoneWeight: g.gemstoneWeight,
                    gemstonePieces: g.gemstonePieces,
                    discountType: g.discountType,
                    discountValue: g.discountValue
                })))
                : '',
            gemstoneType: p.gemstoneType,
            gemstoneCut: p.gemstoneCut,
            gemstoneColor: p.gemstoneColor,
            gemstoneClarity: p.gemstoneClarity,
            gemstoneCaratRange: p.gemstoneCaratRange,
            manualGemstonePrice: p.manualGemstonePrice,
            isManualGemstonePrice: p.isManualGemstonePrice ? 'Yes' : 'No',
            makingChargeType: p.makingChargeType,
            makingChargeValue: p.makingChargeValue,
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
        }
        else {
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
            res.send(buffer);
        }
    }
    catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export products' });
    }
});
// Import products from CSV/Excel
app.post('/api/products/import', upload.single('file'), async (req, res) => {
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
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log(`📂 Processing import file: ${req.file.originalname} (${rows.length} rows)`);
        let updatedCount = 0;
        let errors = [];
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
            if (!sku)
                continue;
            try {
                // Find product by SKU
                const product = await prisma.product.findFirst({ where: { shopId: shop.id, sku: String(sku) } });
                if (!product) {
                    errors.push({ sku, error: 'Product not found' });
                    continue;
                }
                // Prepare update data
                const updateData = {};
                // Helper to normalize keys? simple check for now
                if (row.weightGrams !== undefined)
                    updateData.weightGrams = parseFloat(row.weightGrams);
                if (row.metal !== undefined)
                    updateData.metal = row.metal;
                if (row.karat !== undefined)
                    updateData.karat = parseInt(row.karat);
                if (row.gemstoneType !== undefined)
                    updateData.gemstoneType = row.gemstoneType;
                if (row.gemstoneCut !== undefined)
                    updateData.gemstoneCut = row.gemstoneCut;
                if (row.gemstoneColor !== undefined)
                    updateData.gemstoneColor = row.gemstoneColor;
                if (row.gemstoneClarity !== undefined)
                    updateData.gemstoneClarity = row.gemstoneClarity;
                if (row.gemstoneCaratRange !== undefined)
                    updateData.gemstoneCaratRange = row.gemstoneCaratRange;
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
                // Handle gemstones if gemstones_json column is present
                if (row.gemstones_json !== undefined) {
                    // Delete existing gemstones
                    await prisma.productGemstone.deleteMany({ where: { productId: product.id } });
                    // Clear legacy gemstone fields
                    await prisma.product.update({
                        where: { id: product.id },
                        data: {
                            gemstoneType: null,
                            gemstoneCut: null,
                            gemstoneColor: null,
                            gemstoneClarity: null,
                            gemstoneCaratRange: null,
                            stoneWeightCarat: null,
                            stonePieces: null,
                            isManualGemstonePrice: false,
                            manualGemstonePrice: null,
                            manualGemstoneWeight: null,
                        },
                    });
                    // Parse and create new gemstones if any
                    if (row.gemstones_json && row.gemstones_json.trim() !== '') {
                        try {
                            const gemstones = JSON.parse(row.gemstones_json);
                            if (Array.isArray(gemstones) && gemstones.length > 0) {
                                for (const gem of gemstones) {
                                    await prisma.productGemstone.create({
                                        data: {
                                            productId: product.id,
                                            gemstoneType: gem.gemstoneType,
                                            gemstoneCut: gem.gemstoneCut || null,
                                            gemstoneColor: gem.gemstoneColor || null,
                                            gemstoneClarity: gem.gemstoneClarity || null,
                                            gemstoneCaratRange: gem.gemstoneCaratRange || null,
                                            gemstoneWeight: gem.gemstoneWeight ? parseFloat(gem.gemstoneWeight) : null,
                                            gemstonePieces: gem.gemstonePieces ? parseInt(gem.gemstonePieces) : null,
                                            discountType: gem.discountType || null,
                                            discountValue: gem.discountValue ? parseFloat(gem.discountValue) : null
                                        }
                                    });
                                }
                            }
                        }
                        catch (parseError) {
                            console.error(`Error parsing gemstones_json for SKU ${sku}:`, parseError);
                        }
                    }
                }
                // Re-fetch product with gemstones for price calculation
                const productWithGemstones = await prisma.product.findUnique({
                    where: { id: product.id },
                    include: { gemstones: true },
                });
                // Calculate Price if needed
                let newPrice = productWithGemstones?.currentPrice || updatedProduct.currentPrice;
                if (productWithGemstones && productWithGemstones.weightGrams && productWithGemstones.metal) {
                    const rate = metalRates.find(r => r.metal === productWithGemstones.metal &&
                        (productWithGemstones.karat ? r.karat === productWithGemstones.karat : true));
                    if (rate) {
                        // Get stone rate ONLY for legacy single gemstone support
                        let stoneRate = null;
                        if (productWithGemstones.gemstones && productWithGemstones.gemstones.length > 0) {
                            // Using new gemstones system - don't fetch legacy stoneRate
                            stoneRate = null;
                        }
                        else if (productWithGemstones.gemstoneType && !productWithGemstones.isManualGemstonePrice) {
                            stoneRate = await prisma.stoneRate.findFirst({
                                where: {
                                    shopId: shop.id,
                                    stoneType: productWithGemstones.gemstoneType,
                                    cut: productWithGemstones.gemstoneCut || null,
                                    color: productWithGemstones.gemstoneColor || null,
                                    clarity: productWithGemstones.gemstoneClarity || null,
                                    caratRange: productWithGemstones.gemstoneCaratRange || null
                                },
                                orderBy: { updatedAt: 'desc' }
                            });
                        }
                        const { price, breakdown } = await calculateProductPrice(productWithGemstones, rate.ratePerGram, stoneRate, settings);
                        newPrice = price;
                        // Generate breakdown HTML
                        const breakdownHtml = generateBreakdownHtml(breakdown);
                        // Update DB Price and breakdown
                        await prisma.product.update({
                            where: { id: product.id },
                            data: {
                                currentPrice: newPrice,
                                priceBreakdownHtml: breakdownHtml
                            }
                        });
                        // Push to Shopify & Log History
                        await pushToShopify(productWithGemstones, newPrice, breakdown);
                    }
                }
                // Log Audit
                await logAudit(shop.id, 'bulk_import', 'product', product.id, { oldValue: {}, newValue: updateData }, 'Bulk Import via File');
                updatedCount++;
                if (updatedCount % 10 === 0)
                    await new Promise(r => setTimeout(r, 200));
            }
            catch (err) {
                console.error(`Error processing SKU ${sku}:`, err);
                errors.push({ sku, error: err.message });
            }
        }
        res.json({ success: true, updatedCount, errors });
    }
    catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to process import file' });
    }
});
// Update product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { weightGrams, metal, karat, gemstoneType, gemstoneCut, gemstoneColor, gemstoneClarity, gemstoneCaratRange, stonePieces, stoneWeightCarat, gemstoneOverridePricePerPiece, gemstoneOverridePieces, gemstoneOverrideColor, grossGoldWeight, autoGrossGoldWeight } = req.body;
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
                stonePieces: stonePieces ? parseInt(stonePieces) : null,
                stoneWeightCarat: stoneWeightCarat ? parseFloat(stoneWeightCarat) : null,
                isManualGemstonePrice: req.body.isManualGemstonePrice || false,
                manualGemstoneWeight: req.body.manualGemstoneWeight ? parseFloat(req.body.manualGemstoneWeight) : null,
                manualGemstonePrice: req.body.manualGemstonePrice ? parseFloat(req.body.manualGemstonePrice) : null,
                makingChargeValue: req.body.makingChargeValue !== undefined ? parseFloat(req.body.makingChargeValue) : null,
                metalDiscountType: req.body.metalDiscountType || null,
                metalDiscountValue: req.body.metalDiscountValue !== undefined ? parseFloat(req.body.metalDiscountValue) : null,
                makingDiscountType: req.body.makingDiscountType || null,
                makingDiscountValue: req.body.makingDiscountValue !== undefined ? parseFloat(req.body.makingDiscountValue) : null,
                gemstoneDiscountType: req.body.gemstoneDiscountType || null,
                gemstoneDiscountValue: req.body.gemstoneDiscountValue !== undefined ? parseFloat(req.body.gemstoneDiscountValue) : null,
                gemstoneOverridePricePerPiece: req.body.gemstoneOverridePricePerPiece !== undefined ? parseFloat(req.body.gemstoneOverridePricePerPiece) : null,
                gemstoneOverridePieces: req.body.gemstoneOverridePieces !== undefined ? parseInt(req.body.gemstoneOverridePieces) : null,
                gemstoneOverrideColor: req.body.gemstoneOverrideColor || null,
                grossGoldWeight: req.body.grossGoldWeight !== undefined ? parseFloat(req.body.grossGoldWeight) : null,
                autoGrossGoldWeight: req.body.autoGrossGoldWeight === true || req.body.autoGrossGoldWeight === 'true',
            },
        });
        // Handle gemstones separately if provided
        if (req.body.gemstones !== undefined) {
            // Delete all existing gemstones for this product
            await prisma.productGemstone.deleteMany({
                where: { productId: id },
            });
            // Clear legacy gemstone fields when using new gemstones array system
            // This prevents fallback to old single-gemstone logic
            await prisma.product.update({
                where: { id },
                data: {
                    gemstoneType: null,
                    gemstoneCut: null,
                    gemstoneColor: null,
                    gemstoneClarity: null,
                    gemstoneCaratRange: null,
                    stoneWeightCarat: null,
                    stonePieces: null,
                    isManualGemstonePrice: false,
                    manualGemstonePrice: null,
                    manualGemstoneWeight: null,
                },
            });
            // Create new gemstones if any
            if (Array.isArray(req.body.gemstones) && req.body.gemstones.length > 0) {
                await prisma.productGemstone.createMany({
                    data: req.body.gemstones.map((gem) => ({
                        productId: id,
                        gemstoneType: gem.gemstoneType,
                        gemstoneCut: gem.gemstoneCut || null,
                        gemstoneColor: gem.gemstoneColor || null,
                        gemstoneClarity: gem.gemstoneClarity || null,
                        gemstoneCaratRange: gem.gemstoneCaratRange || null,
                        gemstoneWeight: gem.gemstoneWeight || null,
                        gemstonePieces: gem.gemstonePieces || null,
                        isCustom: gem.isCustom === true || gem.isCustom === 'true',
                        pricePerPiece: gem.pricePerPiece !== undefined ? parseFloat(gem.pricePerPiece) : null,
                        discountType: gem.discountType || null,
                        discountValue: gem.discountValue || null,
                    })),
                });
            }
        }
        // Re-fetch product with gemstones to ensure price calculation includes all gemstones
        const productWithGemstones = await prisma.product.findUnique({
            where: { id },
            include: { gemstones: true },
        });
        // Calculate new price if we have weight and metal
        let newPrice = productWithGemstones?.currentPrice || product.currentPrice;
        if (productWithGemstones && productWithGemstones.weightGrams && productWithGemstones.metal) {
            // Get current metal rate
            const metalRate = await prisma.metalRate.findFirst({
                where: {
                    shopId: shop.id,
                    metal: productWithGemstones.metal,
                    karat: productWithGemstones.karat || null,
                },
                orderBy: { updatedAt: 'desc' },
            });
            if (metalRate) {
                // Get settings for making charge, wastage, GST
                const settings = shop.settings || {
                    defaultMakingChargeType: 'per_gram',
                    defaultMakingChargeValue: 1500,
                    defaultWastagePct: 2,
                    defaultGstPct: 3,
                    defaultDiscount: 0,
                };
                // Get stone rate ONLY for legacy single gemstone support
                // Don't fetch if product uses new gemstones array system
                let stoneRate = null;
                if (productWithGemstones.gemstones && productWithGemstones.gemstones.length > 0) {
                    // Using new gemstones system - don't fetch legacy stoneRate
                    // This prevents fallback to old single-gemstone logic
                    stoneRate = null;
                }
                else if (productWithGemstones.gemstoneType && !req.body.isManualGemstonePrice) {
                    // Legacy single gemstone - fetch rate for backward compatibility
                    stoneRate = await prisma.stoneRate.findFirst({
                        where: {
                            shopId: shop.id,
                            stoneType: productWithGemstones.gemstoneType || gemstoneType,
                            cut: productWithGemstones.gemstoneCut || gemstoneCut || null,
                            color: productWithGemstones.gemstoneColor || gemstoneColor || null,
                            clarity: productWithGemstones.gemstoneClarity || gemstoneClarity || null,
                            caratRange: productWithGemstones.gemstoneCaratRange || gemstoneCaratRange || null
                        },
                        orderBy: { updatedAt: 'desc' }
                    });
                }
                // Calculate price with all gemstones included
                const { price: calculatedPrice, breakdown } = await calculateProductPrice(productWithGemstones, metalRate.ratePerGram, stoneRate, settings);
                newPrice = calculatedPrice;
                // Generate breakdown HTML
                const breakdownHtml = generateBreakdownHtml(breakdown);
                // Update product with new price and breakdown HTML
                await prisma.product.update({
                    where: { id },
                    data: {
                        currentPrice: newPrice,
                        priceBreakdownHtml: breakdownHtml
                    },
                });
                console.log(`✅ Calculated price for ${product.sku}: ₹${newPrice.toFixed(2)}`);
                // Push updated price to Shopify & Log History
                await pushToShopify(product, newPrice, breakdown);
                // Log audit
                await logAudit(shop.id, 'product_update', 'product', id, { oldValue: {}, newValue: { ...req.body, price: newPrice } }, 'Manual Update');
                res.json({ success: true, product: { ...product, currentPrice: newPrice } });
            }
            else {
                // Metal rate not found
                res.json({ success: true, product });
            }
        }
        else {
            // Not enough info to calc price
            res.json({ success: true, product });
        }
    }
    catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});
// Calculate price (preview) without saving
app.post('/api/products/calculate-price', async (req, res) => {
    try {
        const { weightGrams, metal, karat, gemstoneType, gemstoneCut, gemstoneColor, gemstoneClarity, gemstoneCaratRange, stonePieces, stoneWeightCarat, isManualGemstonePrice, manualGemstoneWeight, manualGemstonePrice, makingChargeType, makingChargeValue, gemstones } = req.body;
        console.log('🔍 req.body.gemstones:', req.body.gemstones);
        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop)
            return res.status(404).json({ error: 'Shop not found' });
        // Build temporary product object for calculation
        const tempProduct = {
            shopId: shop.id,
            weightGrams: weightGrams ? parseFloat(weightGrams) : 0,
            metal: metal || null,
            karat: karat ? parseInt(karat) : null,
            gemstoneType: gemstoneType || null,
            gemstoneCut: gemstoneCut || null,
            gemstoneColor: gemstoneColor || null,
            gemstoneClarity: gemstoneClarity || null,
            gemstoneCaratRange: gemstoneCaratRange || null,
            stonePieces: stonePieces ? parseInt(stonePieces) : null,
            stoneWeightCarat: stoneWeightCarat ? parseFloat(stoneWeightCarat) : null,
            isManualGemstonePrice: isManualGemstonePrice || false,
            manualGemstoneWeight: manualGemstoneWeight ? parseFloat(manualGemstoneWeight) : 0,
            manualGemstonePrice: manualGemstonePrice ? parseFloat(manualGemstonePrice) : 0,
            makingChargeType: makingChargeType || null,
            makingChargeValue: (makingChargeValue !== undefined && makingChargeValue !== null && makingChargeValue !== '')
                ? parseFloat(makingChargeValue)
                : null,
            gemstones: gemstones || [],
        };
        if (!tempProduct.weightGrams || !tempProduct.metal) {
            return res.json({ breakdown: null });
        }
        const metalRate = await prisma.metalRate.findFirst({
            where: {
                shopId: shop.id,
                metal: tempProduct.metal,
                karat: tempProduct.karat || null,
            },
            orderBy: { updatedAt: 'desc' },
        });
        if (!metalRate) {
            return res.json({ breakdown: null, error: 'Rate not found' });
        }
        const settings = shop.settings || {
            defaultMakingChargeType: 'per_gram',
            defaultMakingChargeValue: 1500,
            defaultWastagePct: 2,
            defaultGstPct: 3,
            defaultDiscount: 0,
        };
        let stoneRate = null;
        if (tempProduct.gemstoneType && !tempProduct.isManualGemstonePrice) {
            stoneRate = await prisma.stoneRate.findFirst({
                where: {
                    shopId: shop.id,
                    stoneType: tempProduct.gemstoneType,
                    cut: tempProduct.gemstoneCut || null,
                    color: tempProduct.gemstoneColor || null,
                    clarity: tempProduct.gemstoneClarity || null,
                    caratRange: tempProduct.gemstoneCaratRange || null
                },
                orderBy: { updatedAt: 'desc' }
            });
        }
        const { breakdown } = await calculateProductPrice(tempProduct, metalRate.ratePerGram, stoneRate, settings);
        res.json({ breakdown });
    }
    catch (error) {
        console.error('Calculation error:', error);
        res.status(500).json({ error: 'Failed to calculate price' });
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
            defaultMakingChargeType: 'per_gram',
            defaultMakingChargeValue: 1500,
            defaultWastagePct: 2,
            defaultGstPct: 3,
            defaultDiscount: 0,
        };
        let stoneRate = null;
        if (product.gemstoneType && !product.isManualGemstonePrice) {
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
        const { breakdown } = await calculateProductPrice(product, metalRate.ratePerGram, stoneRate, settings);
        res.json({ breakdown });
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
        const jobId = await bulkPriceUpdate_service_1.BulkPriceUpdateService.triggerUpdate({
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
    }
    catch (error) {
        console.error('Error triggering bulk update:', error);
        res.status(500).json({ error: 'Failed to trigger bulk update' });
    }
});
// Get job status
app.get('/api/bulk/job-status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await bulkPriceUpdate_service_1.BulkPriceUpdateService.getJobStatus(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json(job);
    }
    catch (error) {
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
        const jobs = await bulkPriceUpdate_service_1.BulkPriceUpdateService.getActiveJobs(shop.id);
        res.json({ jobs });
    }
    catch (error) {
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
        const limit = parseInt(req.query.limit) || 10;
        const jobs = await bulkPriceUpdate_service_1.BulkPriceUpdateService.getRecentJobs(shop.id, limit);
        res.json({ jobs });
    }
    catch (error) {
        console.error('Error fetching recent jobs:', error);
        res.status(500).json({ error: 'Failed to fetch recent jobs' });
    }
});
// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// Initialize Shop for Desktop Mode
const initializeShop = async () => {
    try {
        console.log('Initializing shop data...');
        const shop = await prisma.shop.upsert({
            where: { domain: SHOPIFY_STORE },
            update: {
                accessToken: SHOPIFY_ACCESS_TOKEN,
                isActive: true,
                scope: process.env.SCOPES || 'read_products,write_products'
            },
            create: {
                domain: SHOPIFY_STORE,
                accessToken: SHOPIFY_ACCESS_TOKEN,
                scope: process.env.SCOPES || 'read_products,write_products',
                isActive: true,
                installedAt: new Date()
            }
        });
        // Ensure Settings exist
        await prisma.shopSettings.upsert({
            where: { shopId: shop.id },
            update: {},
            create: {
                shopId: shop.id,
                rateSource: 'manual',
                defaultMakingChargeType: 'per_gram',
                defaultMakingChargeValue: 1500,
                defaultWastagePct: 2,
                defaultGstPct: 3,
                defaultDiscount: 0
            }
        });
        console.log('✅ Shop data initialized for:', SHOPIFY_STORE);
        if (IS_DESKTOP_MODE) {
            console.log('💡 TIP: Set metal rates in the Rates page to get started');
        }
    }
    catch (error) {
        console.error('Failed to initialize shop:', error);
        throw error; // Re-throw to prevent server from starting with bad DB
    }
};
// Start
app.listen(PORT, async () => {
    await initializeShop();
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Connected to: ${SHOPIFY_STORE}`);
    console.log(`✅ Ready for manual price entry!`);
});
//# sourceMappingURL=server-simple-new.js.map