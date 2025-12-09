# Live Metal & Gem Price Editor - Shopify App

A comprehensive Shopify App for jewelry shop owners to manage live metal and gemstone prices, automatically calculate product prices based on karat/grade, and update their Shopify store products in real-time.

## Features

### 🏆 Core Features
- **Live Rate Management**: Update gold (all karats), silver, platinum, diamond, and gemstone rates
- **Automatic Karat Conversion**: Set base 24K gold rate, automatically calculates 22K, 18K, 14K prices
- **Smart Pricing Engine**: Customizable formulas with making charges, wastage, GST, and discounts
- **Bulk Operations**: Preview and push prices for thousands of products efficiently
- **Audit Trail**: Complete history of rate changes and price updates with reasons
- **Automation**: Trigger automatic price updates when rates change by threshold
- **Multi-Merchant**: Automatic tenant isolation - each Shopify store has independent data

### 💎 Pricing Formula
Default formula (customizable per product):
```
metal_value = metal_rate * weight_g * (1 + wastage_pct/100)
making_charge = making_flat + (metal_value * making_pct/100)
stone_value = stone_rate * (stone_weight_ct || stone_pieces)
subtotal = metal_value + making_charge + stone_value
total = subtotal * (1 + gst_pct/100) - discount
```

## Technology Stack

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL (Prisma ORM)
- Shopify API (@shopify/shopify-api)
- Redis (sessions & job queues)
- Bull (background jobs)

**Frontend:**
- React 18 + TypeScript
- Shopify Polaris (design system)
- Shopify App Bridge (embedded app)
- Vite (build tool)

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Shopify Partner account
- ngrok or similar tunnel for local development

### 1. Create Shopify App

1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Create a new app
3. Set App URL: `https://your-ngrok-url.ngrok.io`
4. Set Redirect URL: `https://your-ngrok-url.ngrok.io/api/auth/callback`
5. Set scopes: `write_products`, `read_products`
6. Note your API Key and API Secret

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your values:
# - SHOPIFY_API_KEY and SHOPIFY_API_SECRET
# - DATABASE_URL (PostgreSQL connection string)
# - REDIS_URL
# - HOST (your ngrok URL)

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# (Optional) Seed sample data
npm run db:seed

# Start development server
npm run dev
```

Backend will run on `http://localhost:3000`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_SHOPIFY_API_KEY=your_api_key_here" > .env

# Start development server
npm run dev
```

Frontend will run on `http://localhost:3001`

### 4. ngrok Setup

```bash
# Start ngrok tunnel
ngrok http 3000

# Copy the HTTPS URL and update:
# - backend/.env (HOST variable)
# - Shopify Partner dashboard (App URL and Redirect URL)
```

### 5. Install App

1. In Shopify Partners, click "Test on development store"
2. Select a store and install
3. App will open in Shopify admin

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
HOST=https://your-app-url.ngrok.io

# Shopify
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=write_products,read_products

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/metal_gem_price_editor

# Redis
REDIS_URL=redis://localhost:6379

# Security
SESSION_SECRET=your_random_secret_here
ENCRYPTION_KEY=your_32_character_key_here
```

### Frontend (.env)
```env
VITE_SHOPIFY_API_KEY=your_api_key
```

## Usage Guide

### 1. Sync Products from Shopify
- Navigate to **Products** page
- Click "Sync from Shopify"
- All products and variants will be imported

### 2. Update Metal Rates
- Navigate to **Rates** page
- Click "Update Rate"
- Select metal (Gold/Silver/Platinum) and karat (for gold)
- Enter new rate per gram
- Provide reason for update
- Click "Update"

### 3. Map Product Properties
- Go to **Products** page
- Click on a product to edit
- Set: weight (grams), metal type, karat, stone weight, etc.
- Save changes

### 4. Preview & Push Prices
- Select products using checkboxes
- Click "Preview Prices"
- Review old vs new prices and delta
- Click "Push to Shopify" to update

### 5. Configure Defaults
- Go to **Settings** page
- Set default making charges, wastage %, GST %, etc.
- These apply to all products unless overridden

### 6. View History
- Navigate to **History** page
- View price push history and audit logs
- Filter by date, status, action type

## API Endpoints

### Rates
- `GET /api/rates` - Get current rates
- `POST /api/rates/update` - Update metal rate
- `POST /api/rates/update-stone` - Update stone rate
- `GET /api/rates/history` - Get rate history

### Products
- `GET /api/products` - List products (paginated)
- `POST /api/products/sync` - Sync from Shopify
- `POST /api/products/import` - Bulk CSV import
- `POST /api/products/preview-prices` - Preview price changes
- `POST /api/products/push` - Push prices to Shopify
- `PUT /api/products/:id` - Update product mapping

### Settings
- `GET /api/settings` - Get shop settings
- `PUT /api/settings` - Update settings

### Audit
- `GET /api/audit` - Get audit logs
- `GET /api/audit/history` - Get price history
- `GET /api/audit/export` - Export audit CSV

## Deployment

### Production Deployment (Docker)

```bash
# Build and start all services
docker-compose up -d

# Run migrations
docker-compose exec backend npm run db:migrate

# View logs
docker-compose logs -f
```

### Manual Deployment

1. Set up PostgreSQL and Redis on your server
2. Build backend: `cd backend && npm run build`
3. Build frontend: `cd frontend && npm run build`
4. Serve frontend build with nginx or similar
5. Run backend: `node dist/server.js`
6. Update Shopify app URLs to production domain

## Pricing Examples

### Gold 22K Example
```
Base 24K rate: ₹7,200/g
22K per gram: 7200 × (22/24) = ₹6,600/g
Product weight: 5g
Metal value: 6600 × 5 = ₹33,000
Making charge (flat): ₹500
Subtotal: ₹33,500
GST (3%): ₹1,005
Final price: ₹34,505
```

### Diamond Example
```
Diamond base rate: ₹250,000/carat
Stone weight: 0.25ct
Stone value: 250,000 × 0.25 = ₹62,500
```

## Troubleshooting

### App won't install
- Check that ngrok is running and HOST in .env matches
- Verify Shopify app URLs are correct
- Check API key and secret

### Products not syncing
- Verify Shopify API scopes include `read_products`
- Check access token is valid
- Review backend logs for errors

### Prices not updating
- Ensure product has weight and metal type set
- Check that rates exist for the metal/karat
- Review preview for calculation errors

## Support

For issues or questions, please check:
- [Shopify API Documentation](https://shopify.dev/docs/api)
- [Prisma Documentation](https://www.prisma.io/docs)
- Backend logs: `docker-compose logs backend`

## License

MIT
