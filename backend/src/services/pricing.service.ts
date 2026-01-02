import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PricingVariables {
    metal_rate: number;
    karat?: number;
    wt_g: number;
    making_flat?: number;
    making_pct?: number;
    wastage_pct?: number;
    gst_pct?: number;
    stone_rate?: number;
    stone_wt?: number;
    stone_pieces?: number;
    discount?: number;
}

export class PricingService {
    /**
     * Calculate karat-adjusted price per gram
     * Formula: base_24K_per_gram * (karat / 24)
     */
    static calculateKaratPrice(base24KPerGram: number, karat: number): number {
        if (karat < 1 || karat > 24) {
            throw new Error('Karat must be between 1 and 24');
        }
        return base24KPerGram * (karat / 24);
    }

    /**
     * Get current metal rate for a shop
     */
    static async getMetalRate(
        shopId: string,
        metal: string,
        karat?: number
    ): Promise<number> {
        // For gold, get the base 24K rate and calculate for the specific karat
        if (metal === 'gold' && karat) {
            const base24K = await prisma.metalRate.findFirst({
                where: { shopId, metal: 'gold', karat: 24 },
                orderBy: { updatedAt: 'desc' },
            });

            if (!base24K) {
                throw new Error('Base 24K gold rate not found');
            }

            return this.calculateKaratPrice(base24K.ratePerGram, karat);
        }

        // For silver, platinum, or specific karat rates
        const rate = await prisma.metalRate.findFirst({
            where: { shopId, metal, karat: karat || null },
            orderBy: { updatedAt: 'desc' },
        });

        if (!rate) {
            throw new Error(`Rate not found for ${metal}${karat ? ` ${karat}K` : ''}`);
        }

        return rate.ratePerGram;
    }

    /**
     * Get current stone rate
     */
    static async getStoneRate(
        shopId: string,
        stoneType: string,
        options?: {
            cut?: string;
            color?: string;
            clarity?: string;
            caratRange?: string;
        }
    ): Promise<{ perCarat?: number; perPiece?: number }> {
        const query: any = { shopId, stoneType };

        if (options?.cut) query.cut = options.cut;
        // COLOR REMOVED PER GUARDRAIL 2: Never used in rate lookup
        if (options?.clarity) query.clarity = options.clarity;
        if (options?.caratRange) query.caratRange = options.caratRange;

        const rate = await prisma.stoneRate.findFirst({
            where: query,
            orderBy: { updatedAt: 'desc' },
        });

        if (!rate) {
            // Try to find a default rate without grading
            const defaultRate = await prisma.stoneRate.findFirst({
                where: { shopId, stoneType },
                orderBy: { updatedAt: 'desc' },
            });

            if (!defaultRate) {
                throw new Error(`Rate not found for ${stoneType}`);
            }

            return {
                perCarat: defaultRate.ratePerCarat || undefined,
                perPiece: defaultRate.ratePerPiece || undefined,
            };
        }

        return {
            perCarat: rate.ratePerCarat || undefined,
            perPiece: rate.ratePerPiece || undefined,
        };
    }

    /**
     * Parse and evaluate a custom formula
     * Example: "{metal_rate} * {wt_g} * (1 + {making_pct}/100) + {stone_rate} * {stone_wt}"
     */
    static parseFormula(formula: string, variables: PricingVariables): number {
        let expression = formula;

        // Replace all variables with their values
        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            expression = expression.replace(regex, String(value || 0));
        });

        try {
            // Safely evaluate the expression
            // Note: In production, use a proper expression parser like mathjs
            const result = eval(expression);
            return Math.round(result * 100) / 100; // Round to 2 decimal places
        } catch (error) {
            throw new Error(`Invalid formula: ${formula}`);
        }
    }

    /**
     * Calculate product price using default formula or custom formula
     */
    static async calculateProductPrice(
        shopId: string,
        product: {
            weightGrams?: number;
            metal?: string;
            karat?: number;
            stoneWeightCarat?: number;
            stoneType?: string;
            stonePieces?: number;
            useCustomFormula?: boolean;
            customFormula?: string;
            makingChargeFlat?: number;
            makingChargePct?: number;
            wastagePct?: number;
            gstPct?: number;
            discount?: number;
            discountType?: string;
            gemstoneOverridePricePerPiece?: number;
            gemstoneOverridePieces?: number;
            gemstoneOverrideColor?: string;
            grossGoldWeight?: number;
            autoGrossGoldWeight?: boolean;
            gemstones?: any[]; // For auto calculation
            enamelWeightGrams?: number; // For auto calculation
        }

    ): Promise<number> {
        // Get shop settings for defaults
        const settings = await prisma.shopSettings.findUnique({
            where: { shopId },
        });

        // Resolve Gross Gold Weight
        let resolvedWeight = product.weightGrams || 0;
        if (product.autoGrossGoldWeight) {
            let stonesWeight = 0;
            if (product.gemstones && product.gemstones.length > 0) {
                stonesWeight = product.gemstones.reduce((sum, g) => sum + (g.gemstoneWeight || 0), 0);
            } else if (product.stoneWeightCarat) {
                stonesWeight = product.stoneWeightCarat;
            }
            resolvedWeight = (product.weightGrams || 0) + stonesWeight + (product.enamelWeightGrams || 0);
        } else if (product.grossGoldWeight != null && product.grossGoldWeight > 0) {
            resolvedWeight = product.grossGoldWeight;
        }

        // Get metal rate
        let metalRate = 0;
        if (product.metal && resolvedWeight > 0) {
            metalRate = await this.getMetalRate(shopId, product.metal, product.karat);
        }

        // Get stone rate
        let stoneValue = 0;

        // 1. Multiple Gemstones (New Approach)
        if (product.gemstones && product.gemstones.length > 0) {
            for (const gemstone of product.gemstones) {
                let gemCost = 0;
                if (gemstone.isCustom) {
                    // GUARDRAIL 1 & 3: Mandatory Validation & No Implicit Defaults
                    if (
                        gemstone.pricePerPiece == null ||
                        gemstone.pricePerPiece <= 0 ||
                        gemstone.gemstonePieces == null ||
                        gemstone.gemstonePieces <= 0
                    ) {
                        // SAFETY: Ignore invalid custom gemstone entirely
                        continue;
                    }
                    gemCost = gemstone.pricePerPiece * gemstone.gemstonePieces;
                } else {
                    const rate = await this.getStoneRate(shopId, gemstone.gemstoneType);
                    const stoneRate = rate.perCarat || rate.perPiece || 0;
                    gemCost = stoneRate * (gemstone.gemstoneWeight || gemstone.gemstonePieces || 0);
                }
                stoneValue += gemCost;
            }
        }
        // 3. Single Legacy Gemstone
        else if (product.stoneType && (product.stoneWeightCarat || product.stonePieces)) {
            const rate = await this.getStoneRate(shopId, product.stoneType);
            const stoneRate = rate.perCarat || rate.perPiece || 0;
            stoneValue = stoneRate * (product.stoneWeightCarat || product.stonePieces || 0);
        }

        // Prepare variables
        const variables: PricingVariables = {
            metal_rate: metalRate,
            karat: product.karat,
            wt_g: resolvedWeight,
            making_flat: product.makingChargeFlat ?? 0,
            making_pct: product.makingChargePct ?? 0,
            wastage_pct: product.wastagePct ?? settings?.defaultWastagePct ?? 0,
            gst_pct: product.gstPct ?? settings?.defaultGstPct ?? 3,
            stone_pieces: product.stonePieces,
            discount: product.discount ?? settings?.defaultDiscount ?? 0,
        };

        // Use custom formula if provided
        if (product.useCustomFormula && product.customFormula) {
            return this.parseFormula(product.customFormula, variables);
        }

        // Default formula:
        // metal_value = metal_rate * wt_g * (1 + wastage_pct/100)
        // making_charge = making_flat + (metal_value * making_pct/100)
        // stone_value = stone_rate * (stone_wt || stone_pieces)
        // subtotal = metal_value + making_charge + stone_value
        // total = subtotal * (1 + gst_pct/100) - discount

        const metalValue = variables.metal_rate * variables.wt_g * (1 + variables.wastage_pct! / 100);
        const makingCharge = variables.making_flat! + (metalValue * variables.making_pct! / 100);
        const subtotal = metalValue + makingCharge + stoneValue;
        const gstAmount = subtotal * (variables.gst_pct! / 100);
        const subtotalPlusGst = subtotal + gstAmount;

        // 2. Per-Product Discount
        let productDiscountAmount = 0;
        const pDiscValue = product.discount ?? 0;
        const pDiscType = product.discountType || 'flat';

        // 1. Global Default Discount
        let globalDiscountAmount = 0;
        const gDiscValue = settings?.defaultDiscount ?? 0;
        const gDiscType = (settings as any)?.defaultDiscountType || 'flat';

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

        return Math.round(finalPrice * 100) / 100;

    }

    /**
     * Calculate prices for multiple products
     */
    static async calculateBulkPrices(
        shopId: string,
        productIds: string[]
    ): Promise<Array<{
        productId: string;
        sku?: string | null;
        title?: string;
        oldPrice: number | null;
        newPrice: number;
        delta: number;
        deltaPct: number;
        error?: string;
    }>> {
        const products = await prisma.product.findMany({
            where: { shopId, id: { in: productIds } },
        });

        const results = await Promise.all(
            products.map(async (product) => {
                try {
                    // Map Prisma product to Pricing interface (handling nulls)
                    const pricingProduct = {
                        weightGrams: product.weightGrams || undefined,
                        metal: product.metal || undefined,
                        karat: product.karat || undefined,
                        stoneWeightCarat: product.stoneWeightCarat || undefined,
                        stoneType: product.stoneType || undefined,
                        stonePieces: product.stonePieces || undefined,
                        useCustomFormula: product.useCustomFormula || false,
                        customFormula: product.customFormula || undefined,
                        makingChargeFlat: product.makingChargeFlat || undefined,
                        makingChargePct: product.makingChargePct || undefined,
                        wastagePct: product.wastagePct || undefined,
                        gstPct: product.gstPct || undefined,
                        discount: (product as any).discount || undefined,
                        discountType: (product as any).discountType || undefined,
                        gemstoneOverridePricePerPiece: product.gemstoneOverridePricePerPiece || undefined,
                        gemstoneOverridePieces: product.gemstoneOverridePieces || undefined,
                        gemstoneOverrideColor: product.gemstoneOverrideColor || undefined,
                        grossGoldWeight: (product as any).grossGoldWeight || undefined,
                        autoGrossGoldWeight: (product as any).autoGrossGoldWeight || false,
                        gemstones: (product as any).gemstones || undefined,
                        enamelWeightGrams: (product as any).enamelWeightGrams || undefined,
                    };


                    const newPrice = await this.calculateProductPrice(shopId, pricingProduct);
                    const oldPrice = product.currentPrice;
                    const delta = oldPrice ? newPrice - oldPrice : 0;
                    const deltaPct = oldPrice ? (delta / oldPrice) * 100 : 0;

                    return {
                        productId: product.id,
                        sku: product.sku,
                        title: product.title,
                        oldPrice,
                        newPrice,
                        delta: Math.round(delta * 100) / 100,
                        deltaPct: Math.round(deltaPct * 100) / 100,
                    };
                } catch (error) {
                    console.error(`Error calculating price for product ${product.id}:`, error);
                    return {
                        productId: product.id,
                        sku: product.sku,
                        title: product.title,
                        oldPrice: product.currentPrice,
                        newPrice: product.currentPrice || 0,
                        delta: 0,
                        deltaPct: 0,
                        error: (error as Error).message,
                    };
                }
            })
        );

        return results;
    }
}
