# Quick Start - Metal & Gem Price Editor

This app is **ready to use** for manual price entry! No external APIs needed.

## 🚀 Quick Start (3 Steps)

### Step 1: Create Environment Files

**Windows:**
```bash
setup.bat
```

**Or manually create these files:**

`backend/.env`:
```env
NODE_ENV=development
PORT=3000
HOST=http://localhost:3000
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SCOPES=write_products,read_products,write_inventory,read_inventory
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/metal_gem_price_editor
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your_session_secret
ENCRYPTION_KEY=your_encryption_key
```

`frontend/.env`:
```env
VITE_SHOPIFY_API_KEY=your_api_key_here
```

### Step 2: Start the App

```bash
docker-compose up -d
```

Wait 30 seconds for services to start.

### Step 3: Access the App

Open: **http://localhost:3001**

## 📝 How to Use - Manual Price Entry

### 1. Update Gold Rates

1. Go to **Rates** page
2. Click **"Update Rate"**
3. Select:
   - Metal: **Gold**
   - Karat: **24K** (or 22K, 18K, 14K)
   - Rate per Gram: **₹7200** (your current rate)
   - Reason: "Market rate update"
4. Click **"Update"**

**Important:** If you update 24K rate, the app automatically calculates:
- 22K = base × (22/24)
- 18K = base × (18/24)
- 14K = base × (14/24)

Or you can set each karat rate manually!

### 2. Update Silver/Platinum Rates

Same process, just select Silver or Platinum (no karat needed).

### 3. Sync Your Products

1. Go to **Products** page
2. Click **"Sync from Shopify"**
3. All products from daginawala11.myshopify.com will import

### 4. Map Product Details

For each product, set:
- Weight (grams)
- Metal type (Gold/Silver/Platinum)
- Karat (for gold)
- Stone weight (if applicable)

### 5. Preview & Push Prices

1. Select products (checkboxes)
2. Click **"Preview Prices"**
3. Review old vs new prices
4. Click **"Push to Shopify"**

Done! Prices updated in your Shopify store.

## 🎯 Key Features

✅ **Manual Rate Entry** - You control all prices, no external APIs
✅ **Automatic Karat Calculation** - Set 24K, get others automatically
✅ **Bulk Updates** - Update hundreds of products at once
✅ **Audit Trail** - Every change is logged with reason
✅ **Custom Formulas** - Set making charges, wastage, GST per product

## ⚙️ Default Settings

Go to **Settings** page to configure:
- Making Charge (Flat): ₹500
- Making Charge (%): 10%
- Wastage (%): 2%
- GST (%): 3%

These apply to all products unless overridden.

## 🔧 Troubleshooting

**Can't access app?**
- Check Docker is running: `docker-compose ps`
- Check logs: `docker-compose logs backend`

**Products not syncing?**
- Verify Shopify credentials in backend/.env
- Check backend logs for errors

**Prices not calculating?**
- Ensure products have weight and metal type set
- Check that rates exist for the metal/karat

## 📚 Full Documentation

See [README.md](README.md) and [SETUP_GUIDE.md](SETUP_GUIDE.md) for complete details.

---

**Your Store:** https://daginawala11.myshopify.com/
**App URL:** http://localhost:3001
