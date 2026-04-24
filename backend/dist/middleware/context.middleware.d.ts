import { Request, Response, NextFunction } from 'express';
/**
 * Context middleware - attaches the Shop record to all API requests.
 *
 * Multi-tenant logic:
 *  1. Tries to resolve shop from the 'x-shopify-shop-domain' request header.
 *  2. Falls back to SHOPIFY_STORE env var (for single-tenant / desktop mode).
 */
export declare const contextMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=context.middleware.d.ts.map