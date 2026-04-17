import { Request, Response, NextFunction } from 'express';
export interface RequestContext {
    shop: any;
}
declare global {
    namespace Express {
        interface Request {
            context?: RequestContext;
        }
    }
}
export declare const contextMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=context.middleware.d.ts.map