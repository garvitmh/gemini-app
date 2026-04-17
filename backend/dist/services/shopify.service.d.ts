export declare class ShopifyService {
    private static shopDomainEnv;
    private domain;
    private accessToken;
    constructor(domain: string, accessToken: string);
    static forShop(domain: string): Promise<ShopifyService>;
    updateVariantPricesBatch(updates: {
        variantId: string;
        price: number;
    }[]): Promise<{
        success: boolean;
        result?: any;
    }[]>;
    updateVariantPricesBulk(updates: {
        variantId: string;
        price: number;
    }[]): Promise<string>;
    private static getHeaders;
    static getAllCollections(accessToken: string): Promise<any[]>;
    static getCollectionProductIds(accessToken: string, collectionId: string): Promise<string[]>;
    syncProducts(shopId: string): Promise<void>;
    private fetchAllProducts;
}
//# sourceMappingURL=shopify.service.d.ts.map