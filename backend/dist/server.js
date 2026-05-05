"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
// Routes
const rates_routes_1 = __importDefault(require("./routes/rates.routes"));
const products_routes_1 = __importDefault(require("./routes/products.routes"));
const automation_routes_1 = __importDefault(require("./routes/automation.routes"));
const audit_routes_1 = __importDefault(require("./routes/audit.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const PORT = process.env.PORT || 3000;
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
const app = (0, express_1.default)();
// Middleware
app.use((0, compression_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
// Simple auth middleware for development
app.use('/api/*', (req, res, next) => {
    // Mock Shopify session for local development
    res.locals.shopify = {
        session: {
            shop: 'daginawala11.myshopify.com',
            accessToken: process.env.SHOPIFY_API_SECRET,
        },
    };
    next();
});
// API Routes
app.use('/api/rates', rates_routes_1.default);
app.use('/api/products', products_routes_1.default);
app.use('/api/automation', automation_routes_1.default);
app.use('/api/audit', audit_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'Metal & Gem Price Editor API',
        status: 'running',
        endpoints: [
            '/api/health',
            '/api/rates',
            '/api/products',
            '/api/automation',
            '/api/audit',
            '/api/settings'
        ]
    });
});
// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 API URL: http://localhost:${PORT}`);
    console.log(`✅ Ready for manual price entry!`);
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=server.js.map