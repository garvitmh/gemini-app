import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Routes
import ratesRoutes from './routes/rates.routes';
import productsRoutes from './routes/products.routes';
import automationRoutes from './routes/automation.routes';
import auditRoutes from './routes/audit.routes';
import settingsRoutes from './routes/settings.routes';

const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();

const app = express();

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple auth middleware for development
app.use('/api/*', (req: Request, res: Response, next: NextFunction) => {
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
app.use('/api/rates', ratesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);

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
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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

export { prisma };
