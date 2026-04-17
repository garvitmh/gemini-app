export declare class PricingService {
    /**
     * Optimized calculation that avoids N+1 queries for gemstones
     */
    static calculateProductPrice(product: any, ratePerGram: number, stoneRate: any | null, settings: any, enamelRate?: any | null): Promise<{
        price: number;
        breakdown: {
            metal: any;
            karat: any;
            weight: any;
            metal_name: string;
            metal_rate: number;
            metal_value_original: number;
            making_charges_original: number;
            gemstone_price_original: number;
            enamel_price_original: number;
            metal_value: number;
            making_charges: number;
            gemstone_price: number;
            enamel_price: number;
            wastage_amount: number;
            wastage_pct: any;
            making_charge_type: string;
            making_charge_rate: number;
            gemstone_details: any;
            enamel_name: string;
            enamel_details: any;
            subtotal: number;
            gst_amount: number;
            gst_pct: any;
            discount: number;
            product_discount: number;
            total: number;
            total_original: number;
            has_metal_discount: boolean;
            has_making_discount: boolean;
            has_gemstone_discount: boolean;
            has_enamel_discount: boolean;
            has_any_discount: boolean;
        };
    }>;
    /**
     * Calculate prices for multiple products in bulk
     */
    static calculateBulkPrices(shopId: string, productIds: string[]): Promise<{
        productId: string;
        oldPrice: number;
        newPrice: number;
        breakdown: {
            metal: any;
            karat: any;
            weight: any;
            metal_name: string;
            metal_rate: number;
            metal_value_original: number;
            making_charges_original: number;
            gemstone_price_original: number;
            enamel_price_original: number;
            metal_value: number;
            making_charges: number;
            gemstone_price: number;
            enamel_price: number;
            wastage_amount: number;
            wastage_pct: any;
            making_charge_type: string;
            making_charge_rate: number;
            gemstone_details: any;
            enamel_name: string;
            enamel_details: any;
            subtotal: number;
            gst_amount: number;
            gst_pct: any;
            discount: number;
            product_discount: number;
            total: number;
            total_original: number;
            has_metal_discount: boolean;
            has_making_discount: boolean;
            has_gemstone_discount: boolean;
            has_enamel_discount: boolean;
            has_any_discount: boolean;
        };
    }[]>;
}
//# sourceMappingURL=pricing.service.d.ts.map