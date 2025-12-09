# Quick Setup Guide for Daginawala Store

## Your Shopify Credentials

**Store URL:** https://daginawala11.myshopify.com/
**API Key:** your_api_key_here
**API Secret:** your_api_secret_here
**Access Token:** `your_access_token_here` (get from Shopify Admin)

## Setup Steps

### 1. Backend Configuration

Create `backend/.env` file with:

```env
NODE_ENV=development
PORT=3000
HOST=http://localhost:3000

# Your Shopify Credentials
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SCOPES=write_products,read_products,write_inventory,read_inventory

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/metal_gem_price_editor

# Redis
REDIS_URL=redis://localhost:6379

# Session & Encryption
SESSION_SECRET=your_session_secret
ENCRYPTION_KEY=your_encryption_key
```

### 2. Frontend Configuration

Create `frontend/.env` file with:

```env
VITE_SHOPIFY_API_KEY=your_api_key_here
```

### 3. Start the Application

**Option A: Using Docker (Recommended)**

```bash
# From the gemini-app directory
docker-compose up -d
```

**Option B: Manual Setup**

```bash
# Terminal 1 - Start PostgreSQL & Redis
docker-compose up postgres redis -d

# Terminal 2 - Backend
cd backend
npm install
npm run db:push
npm run db:seed
npm run dev

# Terminal 3 - Frontend
cd frontend
npm install
npm run dev
```

### 4. Access the App

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000

## Manual Price Entry - How It Works

The app is **already configured for manual price entry**. Here's how to use it:

### Update Metal Rates

1. Go to **Rates** page in the app
2. Click **"Update Rate"** button
3. Select metal type:
   - **Gold** - Choose karat (24K, 22K, 18K, 14K)
   - **Silver** - No karat needed
   - **Platinum** - No karat needed
4. Enter **Rate per Gram** (in ₹)
5. Add a **Reason** (e.g., "Market rate update")
6. Click **"Update"**

### Example: Setting Gold Rates

**For 24K Gold:**
- Metal: Gold
- Karat: 24K
- Rate: ₹7,200/gram
- Reason: "Current market rate"

**The app automatically calculates:**
- 22K = ₹6,600/gram (7200 × 22/24)
- 18K = ₹5,400/gram (7200 × 18/24)
- 14K = ₹4,200/gram (7200 × 14/24)

**OR you can set each karat manually:**
- Update 22K separately with your custom rate
- Update 18K separately with your custom rate
- etc.

### Update Stone Rates

1. Click **"Update Rate"**
2. For stones, you'll need to use the API directly or we can add a UI
3. Current implementation supports:
   - Diamond (per carat)
   - Ruby (per carat)
   - Sapphire (per carat)
   - Emerald (per carat)
   - Generic Gemstone (per carat or per piece)

## Workflow

1. **Sync Products** from Shopify (Products page → "Sync from Shopify")
2. **Update Rates** manually (Rates page)
3. **Map Products** - Set weight, metal type, karat for each product
4. **Preview Prices** - Select products and preview calculated prices
5. **Push to Shopify** - Update prices in your store

## Default Pricing Formula

```
Metal Value = rate_per_gram × weight_grams × (1 + wastage_pct/100)
Making Charge = making_flat + (metal_value × making_pct/100)
Stone Value = stone_rate × stone_weight_carat
Subtotal = metal_value + making_charge + stone_value
Final Price = subtotal × (1 + gst_pct/100) - discount
```

You can customize these defaults in **Settings** page:
- Making Charge (Flat): ₹500
- Making Charge (%): 10%
- Wastage (%): 2%
- GST (%): 3%
- Discount: ₹0

## Important Notes

- **No external API needed** - All rates are entered manually by you
- **Automatic karat calculation** - Set 24K, get 22K/18K/14K automatically
- **Complete control** - Override any calculated rate manually
- **Audit trail** - Every rate change is logged with reason
- **Bulk updates** - Update hundreds of products at once

## Next Steps

1. Create the `.env` files as shown above
2. Run `docker-compose up -d` or follow manual setup
3. Access http://localhost:3001
4. Start updating your metal rates!

Need help? Check the main README.md for detailed documentation.
