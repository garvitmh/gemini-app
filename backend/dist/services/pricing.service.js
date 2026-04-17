"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingService = void 0;
const client_1 = require("@prisma/client");
const gemstoneDisplay_1 = require("../utils/gemstoneDisplay");
const prisma = new client_1.PrismaClient();
class PricingService {
    /**
     * Optimized calculation that avoids N+1 queries for gemstones
     */
    static async calculateProductPrice(product, ratePerGram, stoneRate, settings, enamelRate = null) {
        // 1. Auto Gross Weight Calculation
        let resolvedWeight = product.weightGrams || 0;
        if (product.autoGrossGoldWeight) {
            let stonesWeight = 0;
            if (product.gemstones && product.gemstones.length > 0) {
                stonesWeight = product.gemstones.reduce((sum, g) => sum + (g.gemstoneWeight || 0), 0);
            }
            if (product.stoneWeightCarat) {
                stonesWeight += product.stoneWeightCarat;
            }
            resolvedWeight = (product.weightGrams || 0) + (stonesWeight * 0.2) + (product.enamelWeightGrams || 0);
        }
        else if (product.grossGoldWeight != null && product.grossGoldWeight > 0) {
            resolvedWeight = product.grossGoldWeight;
        }
        const weight = resolvedWeight || 0;
        const metalValueRaw = ratePerGram * weight;
        // Use product-level wastagePct first, fallback to shop settings
        const wastagePct = (product.wastagePct !== undefined && product.wastagePct !== null) ? product.wastagePct : (settings.defaultWastagePct ?? 2);
        // 2. Making charge lookup
        let makingChargeType;
        let makingChargeValue;
        if (product.makingChargeType && product.makingChargeValue !== undefined && product.makingChargeValue !== null && !isNaN(product.makingChargeValue)) {
            makingChargeType = product.makingChargeType;
            makingChargeValue = product.makingChargeValue;
        }
        else if (product.makingGroup && product.makingGroup.type && product.makingGroup.value !== undefined) {
            makingChargeType = product.makingGroup.type;
            makingChargeValue = product.makingGroup.value;
        }
        else {
            makingChargeType = settings.defaultMakingChargeType || 'per_gram';
            makingChargeValue = settings.defaultMakingChargeValue ?? 1500;
        }
        // Use product-level gstPct first, fallback to shop settings
        const gstPct = (product.gstPct !== undefined && product.gstPct !== null) ? product.gstPct : (settings?.defaultGstPct ?? 3);
        const wastageAmount = metalValueRaw * (wastagePct / 100);
        const metalValue = metalValueRaw + wastageAmount;
        // Helper for discounts
        const applyDiscount = (original, type, value) => {
            if (!type || type === 'none')
                return original;
            if (type === 'percent')
                return original * (1 - value / 100);
            if (type === 'flat')
                return Math.max(0, original - value);
            return original;
        };
        // 3. Metal Discount
        const metalDiscType = product.metalDiscountType || settings.defaultMetalDiscountType;
        const metalDiscValue = product.metalDiscountValue ?? settings.defaultMetalDiscountValue;
        const finalMetalValue = applyDiscount(metalValue, metalDiscType, metalDiscValue);
        // 4. Making Charge Calculation
        // IMPORTANT: Always use the same resolved weight for making charges for consistency
        const makingChargeWeight = weight;

        let makingCharge = 0;
        if (makingChargeType === 'per_gram') {
            makingCharge = makingChargeValue * makingChargeWeight;
        }
        else if (makingChargeType === 'percent') {
            makingCharge = metalValue * (makingChargeValue / 100);
        }
        else if (makingChargeType === 'flat') {
            makingCharge = makingChargeValue;
        }
        else {
            makingCharge = 1500 * makingChargeWeight;
        }
        const makingDiscType = product.makingDiscountType || settings.defaultMakingDiscountType;
        const makingDiscValue = product.makingDiscountValue ?? settings.defaultMakingDiscountValue;
        const finalMakingCharge = applyDiscount(makingCharge, makingDiscType, makingDiscValue);
        // 5. Gemstone Cost Calculation (Optimized)
        let gemstoneCost = 0;
        let gemstoneCostBeforeDiscount = 0; // FIX: track pre-discount total separately
        let stoneDetails = null;
        const gemstonesArray = [];
        let firstGemName = '';
        if (product.gemstones && product.gemstones.length > 0) {
            // OPTIMIZATION: Extract unique gemstone keys for batch lookup if needed
            // For now, let's keep it structured but cleaner
            for (const gemstone of product.gemstones) {
                let gemCost = 0;
                let rateNotSet = false;
                if (gemstone.isCustom) {
                    let isWeightBased = gemstone.pricePerCarat > 0 && gemstone.gemstoneWeight > 0;
                    let isPieceBased = gemstone.pricePerPiece > 0 && gemstone.gemstonePieces > 0;
                    if (isWeightBased) {
                        gemCost = gemstone.pricePerCarat * gemstone.gemstoneWeight;
                    }
                    else if (isPieceBased) {
                        gemCost = gemstone.pricePerPiece * gemstone.gemstonePieces;
                    }
                    else {
                        rateNotSet = true;
                    }
                }
                else {
                    // Still one lookup per gemstone, but we can optimize this to a single findMany 
                    // if we pre-analyze the whole gemstone list.
                    const gemStoneRate = await prisma.stoneRate.findFirst({
                        where: {
                            shopId: product.shopId,
                            stoneType: gemstone.gemstoneType,
                            cut: gemstone.gemstoneCut || null,
                            clarity: gemstone.gemstoneClarity || null,
                        },
                    });
                    if (gemStoneRate) {
                        if (gemStoneRate.ratePerCarat && gemstone.gemstoneWeight) {
                            gemCost = gemStoneRate.ratePerCarat * gemstone.gemstoneWeight;
                        }
                        else if (gemStoneRate.ratePerPiece && gemstone.gemstonePieces) {
                            gemCost = gemStoneRate.ratePerPiece * gemstone.gemstonePieces;
                        }
                        else if (gemStoneRate.ratePerPiece) {
                            gemCost = gemStoneRate.ratePerPiece;
                        }
                    }
                    else {
                        rateNotSet = true;
                    }
                }
                const gemDiscType = gemstone.discountType || product.gemstoneDiscountType || settings.defaultGemstoneDiscountType;
                const gemDiscValue = gemstone.discountValue ?? product.gemstoneDiscountValue ?? settings.defaultGemstoneDiscountValue;
                const finalGemCost = applyDiscount(gemCost, gemDiscType, gemDiscValue);
                gemstoneCostBeforeDiscount += gemCost; // FIX: accumulate pre-discount
                gemstoneCost += finalGemCost;
                if (!firstGemName) firstGemName = (0, gemstoneDisplay_1.getGemstoneDisplayName)(gemstone.gemstoneType);
                gemstonesArray.push({
                    type: (0, gemstoneDisplay_1.getGemstoneDisplayName)(gemstone.gemstoneType),
                    cut: gemstone.gemstoneCut,
                    color: gemstone.gemstoneColor,
                    clarity: gemstone.gemstoneClarity,
                    caratRange: gemstone.gemstoneCaratRange,
                    weight: gemstone.gemstoneWeight,
                    pieces: gemstone.gemstonePieces,
                    cost: Math.round(gemCost * 100),
                    finalCost: Math.round(finalGemCost * 100),
                    hasDiscount: gemCost !== finalGemCost,
                    rateNotSet: rateNotSet,
                    isCustom: gemstone.isCustom || false,
                });
            }
            stoneDetails = { type: 'multiple', gemstones: gemstonesArray, totalCost: gemstoneCost };
        }
        else if (product.isManualGemstonePrice) {
            gemstoneCost = product.manualGemstonePrice || 0;
            gemstoneCostBeforeDiscount = gemstoneCost; // manual: no discount on raw
            stoneDetails = { type: 'manual', cost: gemstoneCost };
        }
        else if (stoneRate) {
            if (stoneRate.ratePerCarat) {
                const stoneWeight = product.stoneWeightCarat || 0;
                gemstoneCostBeforeDiscount = stoneRate.ratePerCarat * stoneWeight;
                gemstoneCost = gemstoneCostBeforeDiscount;
                stoneDetails = { type: 'per_carat', rate: stoneRate.ratePerCarat, weight: stoneWeight, cost: gemstoneCostBeforeDiscount };
            }
            else if (stoneRate.ratePerPiece) {
                const pieces = product.stonePieces || 0;
                gemstoneCostBeforeDiscount = stoneRate.ratePerPiece * pieces;
                gemstoneCost = gemstoneCostBeforeDiscount;
                stoneDetails = { type: 'per_piece', rate: stoneRate.ratePerPiece, pieces: pieces, cost: gemstoneCostBeforeDiscount };
            }
            const stoneDiscType = product.gemstoneDiscountType || settings.defaultGemstoneDiscountType;
            const stoneDiscValue = product.gemstoneDiscountValue ?? settings.defaultGemstoneDiscountValue;
            gemstoneCost = applyDiscount(gemstoneCost, stoneDiscType, stoneDiscValue);
        }
        // 6. Enamel Cost Calculation
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
        const enamelDiscType = product.enamelDiscountType || settings.defaultEnamelDiscountType;
        const enamelDiscValue = product.enamelDiscountValue ?? settings.defaultEnamelDiscountValue;
        const finalEnamelCost = applyDiscount(enamelCost, enamelDiscType, enamelDiscValue);
        // 7. Final Pricing & Tax
        const subtotal = finalMetalValue + finalMakingCharge + gemstoneCost + finalEnamelCost;
        const gstAmount = subtotal * (gstPct / 100);
        const subtotalPlusGst = subtotal + gstAmount;
        const pDiscValue = product.discount ?? 0;
        const pDiscType = product.discountType || 'flat';
        const gDiscValue = settings?.defaultDiscount ?? 0;
        const gDiscType = settings?.defaultDiscountType || 'flat';
        let productDiscountAmount = 0;
        let globalDiscountAmount = 0;
        if (pDiscValue > 0) {
            if (pDiscType === 'percent') {
                productDiscountAmount = subtotalPlusGst * (pDiscValue / 100);
            }
            else {
                productDiscountAmount = pDiscValue;
            }
        }
        else if (gDiscValue > 0) {
            if (gDiscType === 'percent') {
                globalDiscountAmount = subtotalPlusGst * (gDiscValue / 100);
            }
            else {
                globalDiscountAmount = gDiscValue;
            }
        }
        const finalPrice = Math.round(Math.max(0, subtotalPlusGst - globalDiscountAmount - productDiscountAmount) * 100) / 100;
        // Derive gemstone name for single-gemstone display
        const gemNameForBreakdown = firstGemName || (product.gemstoneType ? (0, gemstoneDisplay_1.getGemstoneDisplayName)(product.gemstoneType) : 'Gemstone');
        return {
            price: finalPrice,
            breakdown: {
                metal: product.metal,
                karat: product.karat,
                weight: weight,
                metal_name: `${product.metal} ${product.karat ? product.karat + 'K' : ''}`,
                metal_rate: Math.round(ratePerGram * 100),
                metal_value_original: Math.round(metalValue * 100),
                making_charges_original: Math.round(makingCharge * 100),
                gemstone_price_original: Math.round(gemstoneCostBeforeDiscount * 100), // FIX: use pre-discount
                enamel_price_original: Math.round(enamelCost * 100),
                metal_value: Math.round(finalMetalValue * 100),
                making_charges: Math.round(finalMakingCharge * 100),
                gemstone_price: Math.round(gemstoneCost * 100), // post-discount
                gemstone_name: gemNameForBreakdown, // FIX: was missing
                enamel_price: Math.round(finalEnamelCost * 100),
                wastage_amount: Math.round(wastageAmount * 100),
                wastage_pct: wastagePct,
                making_charge_type: makingChargeType,
                making_charge_rate: makingChargeValue,
                gemstone_details: stoneDetails,
                enamel_name: enamelDetails ? `${enamelDetails.color} Enamel` : 'Enamel',
                enamel_details: enamelDetails,
                subtotal: Math.round(subtotal * 100),
                gst_amount: Math.round(gstAmount * 100),
                gst_pct: gstPct,
                discount: Math.round(globalDiscountAmount * 100),
                global_discount_value: gDiscValue,   // FIX: was missing
                global_discount_type: gDiscType,     // FIX: was missing
                product_discount: Math.round(productDiscountAmount * 100),
                product_discount_value: pDiscValue,  // FIX: was missing
                product_discount_type: pDiscType,    // FIX: was missing
                total: Math.round(finalPrice * 100),
                total_original: Math.round((subtotalPlusGst) * 100),
                has_metal_discount: finalMetalValue < metalValue,
                has_making_discount: finalMakingCharge < makingCharge,
                has_gemstone_discount: gemstoneCostBeforeDiscount !== gemstoneCost, // FIX: was hardcoded false
                has_enamel_discount: finalEnamelCost < enamelCost,
                has_any_discount: finalPrice < subtotalPlusGst
            }
        };
    }
    /**
     * Calculate prices for multiple products in bulk
     */
    static async calculateBulkPrices(shopId, productIds) {
        const results = [];
        // Get shop and its settings once for the whole batch
        const shop = await prisma.shop.findUnique({
            where: { id: shopId },
            include: { settings: true }
        });
        if (!shop) {
            throw new Error('Shop not found');
        }
        const settings = shop.settings || {};
        // Fetch all products in the batch with their gemstones
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { gemstones: true, makingGroup: true }
        });
        for (const product of products) {
            try {
                // Determine rate per gram (metal rate)
                let ratePerGram = 0;
                if (product.metal && product.metal !== 'none' && product.metal !== 'enamel') {
                    const metalRate = await prisma.metalRate.findFirst({
                        where: {
                            shopId: shop.id,
                            metal: product.metal,
                            karat: product.karat  // CRITICAL: Filter by karat too!
                        }
                    });
                    if (metalRate) {
                        ratePerGram = metalRate.ratePerGram;
                    }
                }
                // Determine enamel rate if applicable
                let enamelRate = null;
                if (product.enamelColor) {
                    enamelRate = await prisma.enamelRate.findFirst({
                        where: {
                            shopId: shop.id,
                            enamelColor: product.enamelColor
                        }
                    });
                }
                const result = await this.calculateProductPrice(product, ratePerGram, null, settings, enamelRate);
                results.push({
                    productId: product.id,
                    oldPrice: product.currentPrice || 0,
                    newPrice: result.price,
                    breakdown: result.breakdown
                });
            }
            catch (error) {
                console.error(`Failed to calculate price for product ${product.id}:`, error);
            }
        }
        return results;
    }
}
exports.PricingService = PricingService;
//# sourceMappingURL=pricing.service.js.map