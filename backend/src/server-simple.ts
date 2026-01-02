import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import multer from 'multer';
import * as xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { BulkPriceUpdateService } from './services/bulkPriceUpdate.service';

const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'daginawala11.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const IS_DESKTOP_MODE = process.env.NODE_ENV === 'development' && !process.env.SHOPIFY_ACCESS_TOKEN;

if (!SHOPIFY_ACCESS_TOKEN) {
    console.warn('⚠️  WARNING: SHOPIFY_ACCESS_TOKEN not set in environment variables');
    console.warn('⚠️  Running in DESKTOP MODE - Shopify sync features will be limited');
    console.warn('⚠️  Set SHOPIFY_ACCESS_TOKEN in backend/.env to enable full functionality');
}


const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to calculate price and breakdown
const calculateProductPrice = async (product: any, ratePerGram: number, stoneRate: any | null, settings: any, enamelRate: any | null = null) => {

    // NEW: Auto Gross Weight Calculation
    let resolvedWeight = product.weightGrams || 0;
    if (product.autoGrossGoldWeight) {
        let stonesWeight = 0;
        if (product.gemstones && product.gemstones.length > 0) {
            stonesWeight = product.gemstones.reduce((sum: number, g: any) => sum + (g.gemstoneWeight || 0), 0);
        } else if (product.stoneWeightCarat) {
            stonesWeight = product.stoneWeightCarat;
        }
        resolvedWeight = (product.weightGrams || 0) + stonesWeight + (product.enamelWeightGrams || 0);
    } else if (product.grossGoldWeight != null && product.grossGoldWeight > 0) {
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

    const gstPct = settings?.defaultGstPct ?? 3;
    const discount = settings?.defaultDiscount ?? 0; // Explicitly default to 0
    const pDisc = product.discount ?? 0; // Explicitly default to 0

    const wastageAmount = metalValueRaw * (wastagePct / 100);
    const metalValue = metalValueRaw + wastageAmount;

    // --- DISCOUNT LOGIC ---
    const applyDiscount = (original: number, type: string, value: number) => {
        if (!type || type === 'none') return original;
        if (type === 'percent') return original * (1 - value / 100);
        if (type === 'flat') return Math.max(0, original - value);
        return original;
    };

    // 1. Metal Discount
    const metalDiscType = product.metalDiscountType || settings.defaultMetalDiscountType;
    const metalDiscValue = product.metalDiscountValue ?? settings.defaultMetalDiscountValue;

    forensicLog(`[CALC] Metal Discount: Type=${metalDiscType}, Value=${metalDiscValue}`);
    const finalMetalValue = applyDiscount(metalValue, metalDiscType, metalDiscValue);

    // Calculate Making Charge based on Type
    let makingCharge = 0;
    if (makingChargeType === 'per_gram') {
        makingCharge = makingChargeValue * weight;
    } else if (makingChargeType === 'percent') {
        // Percentage of (Metal Value + Wastage) - typically undiscounted
        makingCharge = metalValue * (makingChargeValue / 100);
    } else if (makingChargeType === 'flat') {
        makingCharge = makingChargeValue;
    } else {
        makingCharge = 1500 * weight;
    }

    // 2. Making Charge Discount
    const makingDiscType = product.makingDiscountType || settings.defaultMakingDiscountType;
    const makingDiscValue = product.makingDiscountValue ?? settings.defaultMakingDiscountValue;

    forensicLog(`[CALC] Making Charge: Base=${makingCharge}, Type=${makingChargeType}, Rate=${makingChargeValue}`);
    forensicLog(`[CALC] Making Discount: Type=${makingDiscType}, Value=${makingDiscValue}`);

    const finalMakingCharge = applyDiscount(makingCharge, makingDiscType, makingDiscValue);
    forensicLog(`[CALC] Final Making: ${finalMakingCharge} (Original: ${makingCharge})`);

    let gemstoneCost = 0;
    let stoneDetails: any = null;
    const gemstonesArray: any[] = [];

    // Handle multiple gemstones (new approach)
    if (product.gemstones && product.gemstones.length > 0) {
        console.log(`🔍 Processing ${product.gemstones.length} gemstones for product`);
        for (const gemstone of product.gemstones) {
            console.log(`  - Gemstone: ${gemstone.gemstoneType} (isCustom: ${gemstone.isCustom})`);
            let gemCost = 0;
            let rateNotSet = false;

            if (gemstone.isCustom) {
                // GUARDRAIL 1 & 3: Mandatory Validation & No Implicit Defaults
                // Support both Weight-based (Price/Carat) AND Piece-based (Price/Piece)

                let isWeightBased = gemstone.pricePerCarat > 0 && gemstone.gemstoneWeight > 0;
                let isPieceBased = gemstone.pricePerPiece > 0 && gemstone.gemstonePieces > 0;

                if (isWeightBased) {
                    gemCost = gemstone.pricePerCarat * gemstone.gemstoneWeight;
                } else if (isPieceBased) {
                    gemCost = gemstone.pricePerPiece * gemstone.gemstonePieces;
                } else {
                    // SAFETY: If neither valid weight-based nor piece-based data is present
                    // This allows the UI to show the "Rate not set" warning instead of skipping
                    rateNotSet = true;
                }
            } else {
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

                if (gemStoneRate) {
                    if (gemStoneRate.ratePerCarat && gemstone.gemstoneWeight) {
                        gemCost = gemStoneRate.ratePerCarat * gemstone.gemstoneWeight;
                    } else if (gemStoneRate.ratePerPiece && gemstone.gemstonePieces) {
                        gemCost = gemStoneRate.ratePerPiece * gemstone.gemstonePieces;
                    } else if (gemStoneRate.ratePerPiece) {
                        // If no pieces specified, assume 1 piece
                        gemCost = gemStoneRate.ratePerPiece;
                    }
                } else {
                    // No rate found for this gemstone
                    rateNotSet = true;
                }
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
            forensicLog(`[CALC] Gem ${gemstone.gemstoneType}: Original=${gemCost}, Final=${finalGemCost}, DiscType=${gemDiscType}`);
        }
        stoneDetails = { type: 'multiple', gemstones: gemstonesArray, totalCost: gemstoneCost };
    }

    // Fallback to old single gemstone approach for backward compatibility
    else if (product.isManualGemstonePrice) {
        gemstoneCost = product.manualGemstonePrice || 0;
        stoneDetails = { type: 'manual', cost: gemstoneCost };
    } else if (stoneRate) {
        if (stoneRate.ratePerCarat) {
            const stoneWeight = product.stoneWeightCarat || 0;
            gemstoneCost = stoneRate.ratePerCarat * stoneWeight;
            stoneDetails = { type: 'per_carat', rate: stoneRate.ratePerCarat, weight: stoneWeight, cost: gemstoneCost };
        } else if (stoneRate.ratePerPiece) {
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
    let enamelDetails: any = null;

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
    const subtotalPlusGst = subtotal + gstAmount;

    // 2. Per-Product Discount (Applied AFTER GST, according to specification)
    let productDiscountAmount = 0;
    const pDiscValue = product.discount ?? 0;
    const pDiscType = product.discountType || 'flat';

    // 1. Global Default Discount (Applied BEFORE per-product)
    let globalDiscountAmount = 0;
    const gDiscValue = settings?.defaultDiscount ?? 0;
    const gDiscType = settings?.defaultDiscountType || 'flat';

    if (pDiscValue > 0) {
        // OVERRIDE: If product discount is set, skip global discount
        if (pDiscType === 'percent') {
            productDiscountAmount = subtotalPlusGst * (pDiscValue / 100);
        } else {
            productDiscountAmount = pDiscValue;
        }
    } else if (gDiscValue > 0) {
        // Only apply global discount if no product discount is set
        if (gDiscType === 'percent') {
            globalDiscountAmount = subtotalPlusGst * (gDiscValue / 100);
        } else {
            globalDiscountAmount = gDiscValue;
        }
    }


    const finalPrice = Math.max(0, subtotalPlusGst - globalDiscountAmount - productDiscountAmount);



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
            discount: Math.round(globalDiscountAmount * 100), // Global discount
            global_discount_value: gDiscValue,
            global_discount_type: gDiscType,
            product_discount: Math.round(productDiscountAmount * 100), // Per-product discount
            product_discount_value: pDiscValue,
            product_discount_type: pDiscType,

            total: Math.round(finalPrice * 100),
            total_original: Math.round((subtotalPlusGst) * 100), // Subtotal + GST BEFORE any shop discounts applied


            // Discount Flags
            has_metal_discount: finalMetalValue < metalValue,
            has_making_discount: finalMakingCharge < makingCharge,
            has_gemstone_discount: finalGemstoneCost < gemstoneCost,
            has_enamel_discount: finalEnamelCost < enamelCost,
            has_any_discount: finalPrice < subtotalPlusGst
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

// Helper to generate HTML table for breakdown
const generateBreakdownHtml = (breakdown: any) => {
    // Format helper
    const fmt = (n: number) => (n / 100).toFixed(2);

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
            } else if (gem.pieces) {
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
                    <td style="padding: 10px 16px; color: #d93025;">Shop Discount</td>
                    <td style="padding: 10px 16px; text-align: right; color: #d93025;">-₹${fmt(breakdown.discount)}</td>
                </tr>`;
    }

    if (breakdown.product_discount > 0) {
        html += `
                <tr style="border-bottom: 1px solid #f1f2f3;">
                    <td style="padding: 10px 16px; color: #d93025;">Product Discount</td>
                    <td style="padding: 10px 16px; text-align: right; color: #d93025;">-₹${fmt(breakdown.product_discount)}</td>
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
const LOG_FILE = 'd:\\Kshitiz\\Sandeep sir plugin\\gemini-app\\gemini-app\\backend\\forensic_diagnostic.log';
const forensicLog = (msg: string) => {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] ${msg}\n`;
    console.log(msg);
    try {
        fs.appendFileSync(LOG_FILE, formattedMsg);
    } catch (e) {
        console.error('Failed to write to forensic log:', e);
    }
};

// Helper to push to Shopify & Log History
// Refactored to remove internal DB logging and accept oldPrice explicitly
const pushToShopify = async (shopDomain: string, accessToken: string, product: any, price: number, breakdown: any, oldPrice: number | null) => {
    try {
        // Objective 2: Verify Shopify IDs before update
        if (!product.shopifyProductId || !product.shopifyVariantId) {
            console.error(`❌ [SYNC AUDIT] Missing IDs for ${product.sku || 'Unknown Product'}`);
            return { success: false, error: "Missing Shopify Product/Variant ID - cannot sync price" };
        }

        const variantId = product.shopifyVariantId.replace('gid://shopify/ProductVariant/', '');
        const productId = product.shopifyProductId.replace('gid://shopify/Product/', '');

        const variantPutUrl = `https://${shopDomain}/admin/api/2024-01/variants/${variantId}.json`;
        const productGetUrl = `https://${shopDomain}/admin/api/2024-01/products/${productId}.json`;

        forensicLog(`\n🔍 [FORENSIC SYNC AUDIT] Starting verification for ${product.sku || 'Unknown'}`);
        forensicLog(`   Target Shop: ${shopDomain}`);
        forensicLog(`   Product ID: ${productId}`);
        forensicLog(`   Variant ID: ${variantId}`);
        forensicLog(`   Price to send: ₹${price.toFixed(2)}`);
        forensicLog(`   PUT URL: ${variantPutUrl}`);

        // Objective 2: Verify Variant Belongs to Product
        forensicLog(`   [FORENSIC] Step 0: Cross-verifying variant ownership...`);
        const ownershipCheckRes = await axios.get(productGetUrl, {
            headers: { 'X-Shopify-Access-Token': accessToken }
        });

        const remoteVariants = ownershipCheckRes.data.product.variants || [];
        const variantExists = remoteVariants.some((v: any) => v.id.toString() === variantId);

        if (!variantExists) {
            console.error(`   ❌ [FORENSIC] ALARM: Variant ${variantId} NOT FOUND in Product ${productId}`);
            const availableIds = remoteVariants.map((v: any) => v.id).join(', ');
            console.error(`      Available IDs for this product: ${availableIds}`);
            return { success: false, error: "Variant ID does not belong to this product" };
        }
        forensicLog(`   ✅ [FORENSIC] Ownership confirmed.`);

        // 1. Update Variant Price & Metafields
        forensicLog(`   [FORENSIC] Step 1: Updating variant price and metafields...`);
        const variantRes = await axios.put(
            variantPutUrl,
            {
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
            },
            {
                headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json',
                },
            }
        );
        forensicLog(`   [FORENSIC] ✅ Step 1 Success: HTTP ${variantRes.status}`);

        // Objective 3: Confirm Shopify Response Effect
        const updatedVariant = variantRes.data.variant;
        forensicLog(`   [FORENSIC] Shopify Sync Result:`);
        forensicLog(`      Final Variant ID: ${updatedVariant.id}`);
        forensicLog(`      Final Price: ${updatedVariant.price}`);
        forensicLog(`      Final Compare At Price: ${updatedVariant.compare_at_price}`);

        // 2. Fetch Product to get current Description
        forensicLog(`   [FORENSIC] Step 2: Fetching product description...`);
        const productRes = await axios.get(
            productGetUrl,
            {
                headers: { 'X-Shopify-Access-Token': accessToken }
            }
        );

        const currentHtml = productRes.data.product.body_html || '';
        const newTableHtml = generateBreakdownHtml(breakdown);

        let newBodyHtml = currentHtml;

        // Replace or Append
        const regex = /<!-- GEMS_PRICE_BREAKDOWN_START -->[\s\S]*?<!-- GEMS_PRICE_BREAKDOWN_END -->/;
        if (regex.test(currentHtml)) {
            newBodyHtml = currentHtml.replace(regex, newTableHtml);
            forensicLog(`   📝 Replacing existing price breakdown in description`);
        } else {
            newBodyHtml = currentHtml + newTableHtml;
            forensicLog(`   📝 Appending price breakdown to description`);
        }

        // 3. Update Product Description
        if (newBodyHtml !== currentHtml) {
            forensicLog(`   [FORENSIC] Step 3: Updating product description...`);
            const descRes = await axios.put(
                productGetUrl,
                {
                    product: {
                        id: parseInt(productId),
                        body_html: newBodyHtml
                    }
                },
                {
                    headers: {
                        'X-Shopify-Access-Token': accessToken,
                        'Content-Type': 'application/json',
                    },
                }
            );
            forensicLog(`   [FORENSIC] ✅ Step 3 Success: HTTP ${descRes.status}`);
        } else {
            forensicLog(`   [FORENSIC] Step 3: Skipped (Description unchanged)`);
        }

        console.log(`✅ Successfully pushed ${product.sku} to Shopify\n`);
        return { success: true };
    } catch (error: any) {
        console.error(`\n❌ Failed to push ${product.sku} to Shopify`);
        console.error(`   Error Message: ${error.message}`);

        let errorMessage = error.message;
        if (error.response) {
            errorMessage = JSON.stringify(error.response.data);
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Response Data:`, errorMessage);
        }

        return { success: false, error: errorMessage };
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
    } catch (error: any) {
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

        // Note: Product prices are NOT automatically updated
        // Users must manually trigger price updates via the "Update All Prices" button
        console.log(`ℹ️  Rate updated. Use "Update All Prices" to recalculate product prices.`);

        res.json({
            success: true,
            rate: newRate,
            message: 'Rate updated successfully. Click "Update All Prices" to recalculate product prices.'
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
        } else {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to delete enamel rate' });
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
            // SQLite's LIKE operator (used by contains) is case-insensitive by default
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
        const jobId = await BulkPriceUpdateService.triggerUpdate({
            shopId: shop.id,
            triggeredBy: 'manual_update',
        });

        res.json({
            success: true,
            message: 'Bulk price update started. This may take a few minutes.',
            jobId,
        });
    } catch (error) {
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
        const response = await axios.get(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250`,
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                },
                timeout: 60000, // Increased to 60 seconds
            }
        );

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
                } catch (dbError: any) {
                    console.error(`Error upserting variant ${variant.id}:`, dbError.message);
                    throw dbError; // Re-throw to be caught by outer catch
                }
            }
        }

        console.log(`✅ Synced ${syncedCount} products from Shopify`);
        res.json({ success: true, syncedCount });
    } catch (error: any) {
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
        const format = (req.query.format as string) || 'xlsx';

        // Headers for the template
        const headers = {
            SKU: 'Example: GOLD-RING-001',
            Title: 'Example: Gold Ring with Diamond',
            weightGrams: 'Example: 5.5',
            metal: 'Example: gold',
            karat: 'Example: 22',
            makingChargeType: 'per_gram/percent/flat',
            makingChargeValue: 'Example: 1500',
            CurrentPrice: '(Read-only)',
            gemstone_1_type: 'diamond',
            gemstone_1_cut: 'Excellent',
            gemstone_1_color: 'D',
            gemstone_1_clarity: 'VS1',
            gemstone_1_weight: 0.5,
            gemstone_1_pieces: 1,
            gemstone_1_isCustom: 'FALSE',
            gemstone_1_pricePerCarat: '',
            gemstone_1_pricePerPiece: '',
            gemstone_2_type: '',
            gemstone_2_cut: '',
            gemstone_2_color: '',
            gemstone_2_clarity: '',
            gemstone_2_weight: '',
            gemstone_2_pieces: '',
            gemstone_2_isCustom: '',
            gemstone_2_pricePerCarat: '',
            gemstone_2_pricePerPiece: '',
            gemstone_3_type: '',
            gemstone_3_cut: '',
            gemstone_3_color: '',
            gemstone_3_clarity: '',
            gemstone_3_weight: '',
            gemstone_3_pieces: '',
            gemstone_3_isCustom: '',
            gemstone_3_pricePerCarat: '',
            gemstone_3_pricePerPiece: '',
            gemstones_json: '(Optional: Only if you need more than 3 gemstones)'
        };

        // Note row for merchants
        const note = {
            SKU: 'NOTE:',
            Title: 'Fill gemstone columns directly. Supports up to 3 gemstones. Leave blank if not applicable.',
            weightGrams: '',
            metal: '',
            karat: '',
            makingChargeType: '',
            makingChargeValue: '',
            CurrentPrice: 'Auto-calculated. Do not edit.',
            gemstone_1_type: '',
            gemstone_1_cut: '',
            gemstone_1_color: '',
            gemstone_1_clarity: '',
            gemstone_1_weight: '',
            gemstone_1_pieces: '',
            gemstone_1_isCustom: 'TRUE/FALSE',
            gemstone_1_pricePerCarat: 'If weight-based',
            gemstone_1_pricePerPiece: 'Priority override',
            gemstone_2_type: '',
            gemstone_2_cut: '',
            gemstone_2_color: '',
            gemstone_2_clarity: '',
            gemstone_2_weight: '',
            gemstone_2_pieces: '',
            gemstone_2_isCustom: '',
            gemstone_2_pricePerCarat: '',
            gemstone_2_pricePerPiece: '',
            gemstone_3_type: '',
            gemstone_3_cut: '',
            gemstone_3_color: '',
            gemstone_3_clarity: '',
            gemstone_3_weight: '',
            gemstone_3_pieces: '',
            gemstone_3_isCustom: '',
            gemstone_3_pricePerCarat: '',
            gemstone_3_pricePerPiece: '',
            gemstones_json: ''
        };

        // Real Sample Row 1: Gold Ring
        const sampleGold = {
            SKU: 'GOLD-RING-001',
            Title: 'Sample 22K Gold Ring',
            weightGrams: 5.5,
            metal: 'gold',
            karat: 22,
            makingChargeType: 'per_gram',
            makingChargeValue: 1500,
            CurrentPrice: '',
            gemstone_1_type: 'diamond',
            gemstone_1_cut: 'Excellent',
            gemstone_1_color: 'D',
            gemstone_1_clarity: 'VS1',
            gemstone_1_weight: 0.5,
            gemstone_1_pieces: 1,
            gemstone_1_isCustom: '',
            gemstone_1_pricePerCarat: '',
            gemstone_1_pricePerPiece: '',
            gemstone_2_type: '',
            gemstone_2_cut: '',
            gemstone_2_color: '',
            gemstone_2_clarity: '',
            gemstone_2_weight: '',
            gemstone_2_pieces: '',
            gemstone_2_isCustom: '',
            gemstone_2_pricePerCarat: '',
            gemstone_2_pricePerPiece: '',
            gemstone_3_type: '',
            gemstone_3_cut: '',
            gemstone_3_color: '',
            gemstone_3_clarity: '',
            gemstone_3_weight: '',
            gemstone_3_pieces: '',
            gemstone_3_isCustom: '',
            gemstone_3_pricePerCarat: '',
            gemstone_3_pricePerPiece: '',
            gemstones_json: ''
        };

        // Real Sample Row 2: Silver Bracelet
        const sampleSilver = {
            SKU: 'SILVER-BRACE-001',
            Title: 'Sample 925 Silver Bracelet',
            weightGrams: 15.0,
            metal: 'silver',
            karat: 925,
            makingChargeType: 'flat',
            makingChargeValue: 500,
            CurrentPrice: '',
            gemstone_1_type: '',
            gemstone_1_cut: '',
            gemstone_1_color: '',
            gemstone_1_clarity: '',
            gemstone_1_weight: '',
            gemstone_1_pieces: '',
            gemstone_1_isCustom: '',
            gemstone_1_pricePerCarat: '',
            gemstone_1_pricePerPiece: '',
            gemstone_2_type: '',
            gemstone_2_cut: '',
            gemstone_2_color: '',
            gemstone_2_clarity: '',
            gemstone_2_weight: '',
            gemstone_2_pieces: '',
            gemstone_2_isCustom: '',
            gemstone_2_pricePerCarat: '',
            gemstone_2_pricePerPiece: '',
            gemstone_3_type: '',
            gemstone_3_cut: '',
            gemstone_3_color: '',
            gemstone_3_clarity: '',
            gemstone_3_weight: '',
            gemstone_3_pieces: '',
            gemstone_3_isCustom: '',
            gemstone_3_pricePerCarat: '',
            gemstone_3_pricePerPiece: '',
            gemstones_json: ''
        };

        // Actual Headers (Column Names)
        const columnNames = {
            SKU: 'SKU',
            Title: 'Title',
            weightGrams: 'weightGrams',
            metal: 'metal',
            karat: 'karat',
            makingChargeType: 'makingChargeType',
            makingChargeValue: 'makingChargeValue',
            CurrentPrice: 'CurrentPrice',
            gemstone_1_type: 'gemstone_1_type',
            gemstone_1_cut: 'gemstone_1_cut',
            gemstone_1_color: 'gemstone_1_color',
            gemstone_1_clarity: 'gemstone_1_clarity',
            gemstone_1_weight: 'gemstone_1_weight',
            gemstone_1_pieces: 'gemstone_1_pieces',
            gemstone_1_isCustom: 'gemstone_1_isCustom',
            gemstone_1_pricePerCarat: 'gemstone_1_pricePerCarat',
            gemstone_1_pricePerPiece: 'gemstone_1_pricePerPiece',
            gemstone_2_type: 'gemstone_2_type',
            gemstone_2_cut: 'gemstone_2_cut',
            gemstone_2_color: 'gemstone_2_color',
            gemstone_2_clarity: 'gemstone_2_clarity',
            gemstone_2_weight: 'gemstone_2_weight',
            gemstone_2_pieces: 'gemstone_2_pieces',
            gemstone_2_isCustom: 'gemstone_2_isCustom',
            gemstone_2_pricePerCarat: 'gemstone_2_pricePerCarat',
            gemstone_2_pricePerPiece: 'gemstone_2_pricePerPiece',
            gemstone_3_type: 'gemstone_3_type',
            gemstone_3_cut: 'gemstone_3_cut',
            gemstone_3_color: 'gemstone_3_color',
            gemstone_3_clarity: 'gemstone_3_clarity',
            gemstone_3_weight: 'gemstone_3_weight',
            gemstone_3_pieces: 'gemstone_3_pieces',
            gemstone_3_isCustom: 'gemstone_3_isCustom',
            gemstone_3_pricePerCarat: 'gemstone_3_pricePerCarat',
            gemstone_3_pricePerPiece: 'gemstone_3_pricePerPiece',
            gemstones_json: 'gemstones_json'
        };

        const combinedData = [columnNames, headers, note, sampleGold, sampleSilver];
        const worksheet = xlsx.utils.json_to_sheet(combinedData, { skipHeader: true });

        // UX Improvement: Freeze panes (Header + 2 instructional rows = 3 rows total)
        worksheet['!freeze'] = { xSplit: 0, ySplit: 3 };

        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Products Template');

        if (format === 'csv') {
            const csv = xlsx.utils.sheet_to_csv(worksheet);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="products_template.csv"');
            res.send(csv);
        } else {
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="products_template.xlsx"');
            res.send(buffer);
        }
    } catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
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
            include: { gemstones: true },
            orderBy: { title: 'asc' },
        });

        const data = products.map(p => {
            const exportRow: any = {
                SKU: p.sku,
                Title: p.title,
                weightGrams: p.weightGrams,
                metal: p.metal,
                karat: p.karat,
                makingChargeType: p.makingChargeType,
                makingChargeValue: p.makingChargeValue,
                CurrentPrice: p.currentPrice
            };

            // Expand up to 3 gemstones
            for (let i = 0; i < 3; i++) {
                const gem = p.gemstones && p.gemstones[i];
                exportRow[`gemstone_${i + 1}_type`] = gem?.gemstoneType || '';
                exportRow[`gemstone_${i + 1}_cut`] = gem?.gemstoneCut || '';
                exportRow[`gemstone_${i + 1}_color`] = gem?.gemstoneColor || '';
                exportRow[`gemstone_${i + 1}_clarity`] = gem?.gemstoneClarity || '';
                exportRow[`gemstone_${i + 1}_weight`] = gem?.gemstoneWeight || '';
                exportRow[`gemstone_${i + 1}_pieces`] = gem?.gemstonePieces || '';
            }

            // Hidden JSON for safety/extended data
            exportRow.gemstones_json = p.gemstones && p.gemstones.length > 0
                ? JSON.stringify(p.gemstones)
                : '';

            return exportRow;
        });

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
    let rowIndex = 0;
    let currentRow: any = null;
    let normalizedRow: any = null;

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
        const sheet = workbook.Sheets[sheetName];

        // PHASE 2: Header Contract Assertion
        const rawRows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const actualHeaders = rawRows[0] || [];
        const expectedHeaders = [
            'SKU', 'Title', 'weightGrams', 'metal', 'karat',
            'makingChargeType', 'makingChargeValue', 'CurrentPrice',
            'gemstone_1_type', 'gemstone_1_cut', 'gemstone_1_color', 'gemstone_1_clarity', 'gemstone_1_weight', 'gemstone_1_pieces',
            'gemstone_2_type', 'gemstone_2_cut', 'gemstone_2_color', 'gemstone_2_clarity', 'gemstone_2_weight', 'gemstone_2_pieces',
            'gemstone_3_type', 'gemstone_3_cut', 'gemstone_3_color', 'gemstone_3_clarity', 'gemstone_3_weight', 'gemstone_3_pieces',
            'gemstones_json'
        ];



        for (const expected of expectedHeaders) {
            if (!actualHeaders.includes(expected)) {
                throw new Error(`Header mismatch: Missing expected column "${expected}". Received: ${JSON.stringify(actualHeaders)}`);
            }
        }

        const rows: any[] = xlsx.utils.sheet_to_json(sheet);
        let updatedCount = 0;
        let errors: any[] = [];
        let firstDataRowProcessed = false;

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

        // Helper for safe numeric conversion
        const toNum = (val: any) => {
            if (val === undefined || val === null || String(val).trim() === '') return null;
            const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
            return isNaN(n) ? null : n;
        };

        const toInt = (val: any) => {
            if (val === undefined || val === null || String(val).trim() === '') return null;
            const n = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
            return isNaN(n) ? null : n;
        };

        for (const row of rows) {
            rowIndex++;
            currentRow = row;
            const sku = row.sku || row.SKU || row.Sku;

            if (!sku) continue;

            // SAFETY CHECK: Skip instructional rows
            const skuStr = String(sku);
            if (skuStr.startsWith('Example:') || skuStr === 'NOTE:' || skuStr === 'SKU' || skuStr.includes('(Read-only)')) {
                continue;
            }

            // PHASE 3: Required Field Assertions (First Data Row)
            if (!firstDataRowProcessed) {

                if (!row.metal) throw new Error(`PHASE 3: Missing required field "metal" in row ${rowIndex}`);
                if (row.karat === undefined || row.karat === null) throw new Error(`PHASE 3: Missing required field "karat" in row ${rowIndex}`);
                if (row.weightGrams === undefined || row.weightGrams === null) throw new Error(`PHASE 3: Missing required field "weightGrams" in row ${rowIndex}`);

                const kVal = toInt(row.karat);
                if (kVal === null) throw new Error(`PHASE 3: Invalid "karat" value "${row.karat}" in row ${rowIndex} (expected valid number)`);

                const wVal = toNum(row.weightGrams);
                if (wVal === null) throw new Error(`PHASE 3: Invalid "weightGrams" value "${row.weightGrams}" in row ${rowIndex} (expected valid number)`);

                firstDataRowProcessed = true;
            }

            try {
                // Find product by SKU
                const product = await prisma.product.findFirst({ where: { shopId: shop.id, sku: skuStr } });

                if (!product) {
                    errors.push({ sku, error: 'Product not found' });
                    continue;
                }

                // Prepare update data
                const updateData: any = {};
                normalizedRow = updateData;

                // Numeric Normalization
                if (row.weightGrams !== undefined) updateData.weightGrams = toNum(row.weightGrams);
                if (row.metal !== undefined) updateData.metal = String(row.metal).trim().toLowerCase();
                if (row.karat !== undefined) updateData.karat = toInt(row.karat);
                if (row.Title || row.title) updateData.title = String(row.Title || row.title).trim();

                // Making charge handling
                if (row.makingChargeType !== undefined) updateData.makingChargeType = row.makingChargeType;
                if (row.makingChargeValue !== undefined) updateData.makingChargeValue = toNum(row.makingChargeValue);

                // Gemstone fields (legacy support)
                if (row.gemstoneType !== undefined) updateData.gemstoneType = row.gemstoneType;
                if (row.gemstoneCut !== undefined) updateData.gemstoneCut = row.gemstoneCut;
                if (row.gemstoneColor !== undefined) updateData.gemstoneColor = row.gemstoneColor;
                if (row.gemstoneClarity !== undefined) updateData.gemstoneClarity = row.gemstoneClarity;
                if (row.gemstoneCaratRange !== undefined) updateData.gemstoneCaratRange = row.gemstoneCaratRange;

                // Manual overrides
                if (row.manualGemstonePrice !== undefined) {
                    const price = toNum(row.manualGemstonePrice);
                    if (price !== null) {
                        updateData.manualGemstonePrice = price;
                        updateData.isManualGemstonePrice = true;
                    }
                }

                // Update product in DB
                const updatedProduct = await prisma.product.update({
                    where: { id: product.id },
                    data: updateData,
                    include: { shop: true }
                });

                // Handle gemstones (Expanded Columns + JSON Fallback)
                // PHASE 3: Gemstone Column Handling Fix
                const hasExpandedColumns = Object.keys(row).some(k => k.startsWith('gemstone_') && k.endsWith('_type'));
                const hasJsonColumn = row.gemstones_json !== undefined;

                if (rowIndex === 4) { // Log for a sample row

                }

                const reconstructedGemstones: any[] = [];
                if (hasExpandedColumns) {
                    for (let i = 1; i <= 3; i++) {
                        const type = row[`gemstone_${i}_type`];
                        if (type && String(type).trim() !== '' && !String(type).startsWith('Example:')) {
                            reconstructedGemstones.push({
                                gemstoneType: String(type).trim(),
                                gemstoneCut: row[`gemstone_${i}_cut`] ? String(row[`gemstone_${i}_cut`]).trim() : null,
                                gemstoneColor: row[`gemstone_${i}_color`] ? String(row[`gemstone_${i}_color`]).trim() : null,
                                gemstoneClarity: row[`gemstone_${i}_clarity`] ? String(row[`gemstone_${i}_clarity`]).trim() : null,
                                gemstoneWeight: toNum(row[`gemstone_${i}_weight`]),
                                gemstonePieces: toInt(row[`gemstone_${i}_pieces`]),
                            });
                        }
                    }
                }

                // Resolve final gemstones array
                let finalGemstones = reconstructedGemstones;

                // If NOT using expanded columns OR expanded were empty, check gemstones_json
                if (!hasExpandedColumns || reconstructedGemstones.length === 0) {
                    if (row.gemstones_json && String(row.gemstones_json).trim() !== '' && !String(row.gemstones_json).startsWith('(Optional')) {
                        try {
                            const parsed = JSON.parse(row.gemstones_json);
                            if (Array.isArray(parsed)) {
                                finalGemstones = parsed;
                            }
                        } catch (e: any) {
                        }
                    }
                }

                // Gating: Only update gemstones if at least one gemstone column was present
                const shouldUpdateGemstones = hasExpandedColumns || hasJsonColumn;

                if (shouldUpdateGemstones && !Array.isArray(finalGemstones)) {
                    throw new Error(`PHASE 4: finalGemstones is not an array for SKU ${skuStr}`);
                }

                // 3. Process the resolved gemstones
                if (shouldUpdateGemstones && finalGemstones && Array.isArray(finalGemstones)) {
                    // Delete existing gemstones
                    await prisma.productGemstone.deleteMany({ where: { productId: product.id } });

                    // Clear legacy gemstone fields on the product itself
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

                    // Create new gemstones
                    for (const gem of finalGemstones) {
                        if (!gem.gemstoneType) continue; // Skip if no type

                        await prisma.productGemstone.create({
                            data: {
                                productId: product.id,
                                gemstoneType: gem.gemstoneType,
                                gemstoneCut: gem.gemstoneCut || null,
                                gemstoneColor: gem.gemstoneColor || null,
                                gemstoneClarity: gem.gemstoneClarity || null,
                                gemstoneCaratRange: gem.gemstoneCaratRange || null,
                                gemstoneWeight: toNum(gem.gemstoneWeight),
                                gemstonePieces: toInt(gem.gemstonePieces),
                                discountType: gem.discountType || null,
                                discountValue: toNum(gem.discountValue),
                            }
                        });
                    }
                }

                // Re-fetch product with gemstones for price calculation
                const productWithGemstones = await prisma.product.findUnique({
                    where: { id: product.id },
                    include: { gemstones: true, shop: true },
                });

                if (productWithGemstones && productWithGemstones.weightGrams && productWithGemstones.metal) {
                    const rate = metalRates.find(r =>
                        r.metal === productWithGemstones.metal &&
                        (productWithGemstones.karat ? r.karat === productWithGemstones.karat : true)
                    );

                    if (rate) {
                        // Get stone rate ONLY for legacy single gemstone support
                        let stoneRate = null;
                        if (!(productWithGemstones.gemstones && productWithGemstones.gemstones.length > 0) && productWithGemstones.gemstoneType && !productWithGemstones.isManualGemstonePrice) {
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

                        const oldPrice = productWithGemstones.currentPrice || 0;
                        const { price: newPrice, breakdown } = await calculateProductPrice(productWithGemstones, rate.ratePerGram, stoneRate, settings);
                        const breakdownHtml = generateBreakdownHtml(breakdown);

                        // Update DB Price and breakdown along with History in a transaction
                        await prisma.$transaction(async (tx) => {
                            await tx.product.update({
                                where: { id: product.id },
                                data: {
                                    currentPrice: newPrice,
                                    priceBreakdownHtml: breakdownHtml
                                }
                            });

                            await tx.priceHistory.create({
                                data: {
                                    productId: product.id,
                                    oldPrice: oldPrice,
                                    newPrice: newPrice,
                                    status: 'success',
                                    triggeredBy: 'bulk_import'
                                }
                            });
                        });

                        // Push to Shopify (async sync)
                        const shopifyResult = await pushToShopify(shop.domain, shop.accessToken || SHOPIFY_ACCESS_TOKEN, productWithGemstones, newPrice, breakdown, oldPrice);
                        if (!shopifyResult.success) {
                            await prisma.priceHistory.create({
                                data: {
                                    productId: product.id,
                                    oldPrice: oldPrice,
                                    newPrice: newPrice,
                                    status: 'failed',
                                    errorMessage: `Shopify sync failed: ${shopifyResult.error}`,
                                    triggeredBy: 'bulk_import'
                                }
                            });
                        }
                    }
                }

                // Log Audit
                await logAudit(shop.id, 'bulk_import', 'product', product.id, { oldValue: {}, newValue: updateData }, 'Bulk Import via File');

                updatedCount++;
            } catch (rowError: any) {
                console.error(`❌ [DIAGNOSTIC] Row ${rowIndex} individual error for SKU ${skuStr}:`, rowError);
                errors.push({ sku: skuStr, error: rowError.message });
                throw rowError; // Bubble up to master catch for Phase 1
            }
        }

        res.json({ success: true, updatedCount, errors });

    } catch (masterError: any) {
        // PHASE 1: HARD FAIL WITH EXPLICIT ERROR
        console.error('🛑 [FORENSIC HARD FAIL] Master Error Stack:', masterError.stack);
        console.error('🛑 [FORENSIC HARD FAIL] At Row Index:', rowIndex);
        console.error('🛑 [FORENSIC HARD FAIL] Raw Row:', JSON.stringify(currentRow, null, 2));
        console.error('🛑 [FORENSIC HARD FAIL] Normalized Row:', JSON.stringify(normalizedRow, null, 2));

        res.status(500).json({
            success: false,
            error: {
                message: masterError.message,
                row: rowIndex,
                stack: masterError.stack
            }
        });
    }
});

// Update product
// Update product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            weightGrams, metal, karat,
            gemstoneType, gemstoneCut, gemstoneColor,
            gemstoneClarity, gemstoneCaratRange,
            stonePieces, stoneWeightCarat,
            gemstoneOverridePricePerPiece, gemstoneOverridePieces, gemstoneOverrideColor,
            grossGoldWeight, autoGrossGoldWeight
        } = req.body;

        forensicLog(`\n--- [FORENSIC ENDPOINT TRACE] Update attempt for product ${id} ---`);

        const existingProduct = await prisma.product.findUnique({
            where: { id },
            include: { gemstones: true }
        });

        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const shop = await prisma.shop.findUnique({
            where: { id: existingProduct.shopId },
            include: { settings: true }
        });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const oldPrice = existingProduct.currentPrice;

        // 2. Update product metadata (non-price fields) first
        // This is necessary because some fields affect the calculation
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
                gemstoneDiscountValue: req.body.gemstoneDiscountValue !== undefined ? parseFloat(req.body.gemstoneDiscountValue) : null,
                gemstoneOverridePricePerPiece: req.body.gemstoneOverridePricePerPiece !== undefined ? parseFloat(req.body.gemstoneOverridePricePerPiece) : null,
                gemstoneOverridePieces: req.body.gemstoneOverridePieces !== undefined ? parseInt(req.body.gemstoneOverridePieces) : null,
                gemstoneOverrideColor: req.body.gemstoneOverrideColor || null,
                grossGoldWeight: req.body.grossGoldWeight !== undefined ? parseFloat(req.body.grossGoldWeight) : null,
                autoGrossGoldWeight: req.body.autoGrossGoldWeight === true || req.body.autoGrossGoldWeight === 'true',
                discount: req.body.discount !== undefined ? parseFloat(req.body.discount) : undefined,
                discountType: req.body.discountType || undefined,
            } as any,
            include: { shop: { include: { settings: true } } }


        });

        // 3. Handle gemstones separately if provided
        if (req.body.gemstones !== undefined) {
            await prisma.productGemstone.deleteMany({ where: { productId: id } });

            await prisma.product.update({
                where: { id },
                data: {
                    gemstoneType: null, gemstoneCut: null, gemstoneColor: null, gemstoneClarity: null,
                    gemstoneCaratRange: null, stoneWeightCarat: null, stonePieces: null,
                    isManualGemstonePrice: false, manualGemstonePrice: null, manualGemstoneWeight: null,
                },
            });

            if (Array.isArray(req.body.gemstones) && req.body.gemstones.length > 0) {
                await prisma.productGemstone.createMany({
                    data: req.body.gemstones.map((gem: any) => ({
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

        // 4. Re-calculate price based on new parameters
        const productWithGemstones = await prisma.product.findUnique({
            where: { id },
            include: { gemstones: true },
        });

        forensicLog(`   Step 1: WeightGrams=${productWithGemstones?.weightGrams}, Metal=${productWithGemstones?.metal}`);

        let newPrice = oldPrice;
        let breakdown: any = null;

        if (productWithGemstones && productWithGemstones.weightGrams && productWithGemstones.metal) {
            const metalRate = await prisma.metalRate.findFirst({
                where: { shopId: shop.id, metal: productWithGemstones.metal, karat: productWithGemstones.karat || null },
                orderBy: { updatedAt: 'desc' },
            });

            if (metalRate) {
                forensicLog(`   Step 2: MetalRate found! Rate=${metalRate.ratePerGram}`);
                const settings = shop.settings || {
                    defaultMakingChargeType: 'per_gram', defaultMakingChargeValue: 1500,
                    defaultWastagePct: 2, defaultGstPct: 3, defaultDiscount: 0
                };

                let stoneRate = null;
                if (!(productWithGemstones.gemstones?.length > 0) && productWithGemstones.gemstoneType && !req.body.isManualGemstonePrice) {
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

                const result = await calculateProductPrice(productWithGemstones, metalRate.ratePerGram, stoneRate, settings);
                newPrice = result.price;
                breakdown = result.breakdown;

                // 5. Atomic Update and History Creation
                // We use a transaction to ensure either BOTH succeed or BOTH fail.
                await prisma.$transaction(async (tx) => {
                    await tx.product.update({
                        where: { id },
                        data: {
                            currentPrice: newPrice,
                            priceBreakdownHtml: generateBreakdownHtml(breakdown)
                        },
                    });

                    // Only create history if we have valid old and new prices
                    if (oldPrice !== undefined && newPrice !== undefined) {
                        await tx.priceHistory.create({
                            data: {
                                productId: id,
                                oldPrice: oldPrice,
                                newPrice: newPrice,
                                status: 'success',
                                triggeredBy: 'manual_update'
                            } as any
                        });
                    }
                });

                console.log(`✅ Calculated and logged price for ${product.sku}: ₹${newPrice.toFixed(2)}`);

                // 6. Push to Shopify (Async Sync)
                // Objective 1: Resolve shop domain dynamically
                const shopDomain = res.locals.shopify?.session?.shop || shop.domain;
                const dbShop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
                const accessToken = dbShop?.accessToken || SHOPIFY_ACCESS_TOKEN;

                const shopifyResult = await pushToShopify(shopDomain, accessToken, product, newPrice, breakdown, oldPrice);

                if (!shopifyResult.success) {
                    await prisma.priceHistory.create({
                        data: {
                            productId: id,
                            oldPrice: oldPrice,
                            newPrice: newPrice,
                            status: 'failed',
                            errorMessage: `Shopify sync failed: ${shopifyResult.error}`,
                            triggeredBy: 'manual_update'
                        } as any
                    });

                    // Objective 3: Surface Shopify sync errors to UI
                    return res.status(500).json({
                        success: false,
                        error: shopifyResult.error,
                        message: `Shopify sync failed: ${shopifyResult.error}`
                    });
                }

                res.json({
                    success: true,
                    product: { ...product, currentPrice: newPrice },
                    syncStatus: 'synced'
                });
            } else {
                res.json({ success: true, product, message: 'Metal rate missing, price not updated' });
            }
        } else {
            res.json({ success: true, product });
        }
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Calculate price (preview) without saving
app.post('/api/products/calculate-price', async (req, res) => {
    try {
        const {
            weightGrams, metal, karat, gemstoneType, gemstoneCut,
            gemstoneColor, gemstoneClarity, gemstoneCaratRange,
            stonePieces, stoneWeightCarat, isManualGemstonePrice,
            manualGemstoneWeight, manualGemstonePrice,
            makingChargeType, makingChargeValue,
            metalDiscountType, metalDiscountValue,
            makingDiscountType, makingDiscountValue,
            gemstoneDiscountType, gemstoneDiscountValue,
            discount, // NEW: Extract discount for per-product discount support
            discountType, // NEW: Phase B
            enamelColor, enamelWeightGrams, enamelDiscountType, enamelDiscountValue,
            gemstones
        } = req.body;

        const shop = await prisma.shop.findFirst({ include: { settings: true } });
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        // Build temporary product object for calculation
        const tempProduct: any = {
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
            metalDiscountType: metalDiscountType || null,
            metalDiscountValue: metalDiscountValue ? parseFloat(metalDiscountValue) : null,
            makingDiscountType: makingDiscountType || null,
            makingDiscountValue: makingDiscountValue ? parseFloat(makingDiscountValue) : null,
            gemstoneDiscountType: gemstoneDiscountType || null,
            gemstoneDiscountValue: gemstoneDiscountValue ? parseFloat(gemstoneDiscountValue) : null,
            discount: discount ? parseFloat(discount) : 0, // NEW: Include per-product discount
            discountType: discountType || 'flat', // NEW: Phase B
            enamelColor: enamelColor || null,
            enamelWeightGrams: enamelWeightGrams ? parseFloat(enamelWeightGrams) : null,
            enamelDiscountType: enamelDiscountType || null,
            enamelDiscountValue: enamelDiscountValue ? parseFloat(enamelDiscountValue) : null,
            gemstones: gemstones || [],
            gemstoneOverridePricePerPiece: req.body.gemstoneOverridePricePerPiece !== undefined ? parseFloat(req.body.gemstoneOverridePricePerPiece) : null,
            gemstoneOverridePieces: req.body.gemstoneOverridePieces !== undefined ? parseInt(req.body.gemstoneOverridePieces) : null,
            gemstoneOverrideColor: req.body.gemstoneOverrideColor || null,
            grossGoldWeight: req.body.grossGoldWeight !== undefined ? parseFloat(req.body.grossGoldWeight) : null,
            autoGrossGoldWeight: req.body.autoGrossGoldWeight === true || req.body.autoGrossGoldWeight === 'true',
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
    } catch (error) {
        console.error('Calculation error:', error);
        res.status(500).json({ error: 'Failed to calculate price' });
    }
});

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
            update: req.body,
            create: { ...req.body, shopId: shop.id }
        });

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});



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
                const oldPrice = product.currentPrice || 0;
                const { price: newPrice, breakdown } = await calculateProductPrice(
                    product,
                    metalRate.ratePerGram,
                    stoneRate,
                    settings
                );

                // Generate breakdown HTML
                const breakdownHtml = generateBreakdownHtml(breakdown);

                // Update product and history in a transaction
                await prisma.$transaction(async (tx) => {
                    await tx.product.update({
                        where: { id: product.id },
                        data: {
                            currentPrice: newPrice,
                            priceBreakdownHtml: breakdownHtml
                        }
                    });

                    await tx.priceHistory.create({
                        data: {
                            productId: product.id,
                            oldPrice: oldPrice,
                            newPrice: newPrice,
                            status: 'success',
                            triggeredBy: 'settings_apply_all'
                        }
                    });
                });

                // Push to Shopify
                const shopifyResult = await pushToShopify(shop.domain, shop.accessToken || SHOPIFY_ACCESS_TOKEN, product, newPrice, breakdown, oldPrice);
                if (!shopifyResult.success) {
                    await prisma.priceHistory.create({
                        data: {
                            productId: product.id,
                            oldPrice: oldPrice,
                            newPrice: newPrice,
                            status: 'failed',
                            errorMessage: `Shopify sync failed: ${shopifyResult.error}`,
                            triggeredBy: 'settings_apply_all'
                        }
                    });
                }

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
    } catch (error) {
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

export { prisma };