interface BulkUpdateOptions {
    shopId: string;
    metal?: string;
    karat?: number;
    triggeredBy?: string;
}
export declare class BulkPriceUpdateService {
    private static readonly BATCH_SIZE;
    private static readonly RATE_LIMIT_DELAY_MS;
    /**
     * Trigger bulk price update for products matching criteria
     * Returns immediately with job ID, processes asynchronously
     */
    static triggerUpdate(options: BulkUpdateOptions): Promise<string>;
    /**
     * Process the bulk update (runs asynchronously)
     */
    private static processUpdate;
    /**
     * Get job status
     */
    static getJobStatus(jobId: string): Promise<{
        error: string | null;
        result: string | null;
        id: string;
        shopId: string;
        status: string;
        createdAt: Date;
        jobType: string;
        totalItems: number | null;
        processedItems: number | null;
        failedItems: number | null;
        startedAt: Date | null;
        completedAt: Date | null;
    } | null>;
    /**
     * Get active jobs for a shop
     */
    static getActiveJobs(shopId: string): Promise<{
        error: string | null;
        result: string | null;
        id: string;
        shopId: string;
        status: string;
        createdAt: Date;
        jobType: string;
        totalItems: number | null;
        processedItems: number | null;
        failedItems: number | null;
        startedAt: Date | null;
        completedAt: Date | null;
    }[]>;
    /**
     * Get recent jobs for a shop
     */
    static getRecentJobs(shopId: string, limit?: number): Promise<{
        error: string | null;
        result: string | null;
        id: string;
        shopId: string;
        status: string;
        createdAt: Date;
        jobType: string;
        totalItems: number | null;
        processedItems: number | null;
        failedItems: number | null;
        startedAt: Date | null;
        completedAt: Date | null;
    }[]>;
}
export {};
//# sourceMappingURL=bulkPriceUpdate.service.d.ts.map