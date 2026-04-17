declare global {
    namespace Express {
        interface Request {
            context: {
                shop: any | null;
            };
            rawBody?: Buffer;
        }
    }
}

export { };
