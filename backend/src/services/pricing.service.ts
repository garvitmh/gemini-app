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
        if (options?.color) query.color = options.color;
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
        }
    ): Promise<number> {
        // Get shop settings for defaults
        const settings = await prisma.shopSettings.findUnique({
            where: { shopId },
        });

        // Get metal rate
        let metalRate = 0;
        if (product.metal && product.weightGrams) {
            metalRate = await this.getMetalRate(shopId, product.metal, product.karat);
        }

        // Get stone rate
        let stoneRate = 0;
        if (product.stoneType && (product.stoneWeightCarat || product.stonePieces)) {
            const rate = await this.getStoneRate(shopId, product.stoneType);
            stoneRate = rate.perCarat || rate.perPiece || 0;
        }

        // Prepare variables
        const variables: PricingVariables = {
            metal_rate: metalRate,
            karat: product.karat,
            wt_g: product.weightGrams || 0,
            making_flat: product.makingChargeFlat ?? settings?.defaultMakingFlat ?? 0,
            making_pct: product.makingChargePct ?? settings?.defaultMakingPct ?? 0,
            wastage_pct: product.wastagePct ?? settings?.defaultWastagePct ?? 0,
            gst_pct: product.gstPct ?? settings?.defaultGstPct ?? 3,
            stone_rate: stoneRate,
            stone_wt: product.stoneWeightCarat,
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
        const stoneValue = variables.stone_rate! * (variables.stone_wt || variables.stone_pieces || 0);
        const subtotal = metalValue + makingCharge + stoneValue;
        const total = subtotal * (1 + variables.gst_pct! / 100) - variables.discount!;

        return Math.round(total * 100) / 100;
    }

    /**
     * Calculate prices for multiple products
     */
    static async calculateBulkPrices(
        shopId: string,
        productIds: string[]
    ): Promise<Array<{ productId: string; oldPrice: number | null; newPrice: number; delta: number; deltaPct: number }>> {
        const products = await prisma.product.findMany({
            where: { shopId, id: { in: productIds } },
        });

        const results = await Promise.all(
            products.map(async (product) => {
                try {
                    const newPrice = await this.calculateProductPrice(shopId, product);
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
