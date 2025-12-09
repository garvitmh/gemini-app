# Setup Without Docker - Quick Guide

Since Docker is not installed, here are your options:

## ✅ Option 1: Simplified Setup (Recommended for Testing)

Use **SQLite** instead of PostgreSQL for quick testing:

### Step 1: Update Backend Database

Edit `backend\.env` and change the DATABASE_URL:

```env
DATABASE_URL=file:./dev.db
```

### Step 2: Install Dependencies

```powershell
# Backend
cd backend
npm install

# Frontend
cd ..\frontend
npm install
```

### Step 3: Setup Database

```powershell
cd ..\backend
npx prisma db push
npx prisma db seed
```

### Step 4: Start Backend

```powershell
npm run dev
```

Keep this terminal open. Backend runs on http://localhost:3000

### Step 5: Start Frontend (New Terminal)

```powershell
cd ..\frontend
npm run dev
```

Frontend runs on http://localhost:3001

### Step 6: Open App

Go to: **http://localhost:3001**

---

## ⚠️ Important Notes

**Without Redis:**
- Sessions will use memory storage (works fine for single user)
- Background jobs won't persist across restarts
- This is perfect for testing and development

**Without PostgreSQL:**
- SQLite works great for development
- All features work the same
- For production, you'll want PostgreSQL

---

## 🔧 Option 2: Install Docker Desktop (For Production)

1. Download: https://www.docker.com/products/docker-desktop/
2. Install Docker Desktop
3. Restart computer
4. Run: `docker-compose up -d`

---

## 🎯 Option 3: Use Cloud Databases

If you want to use PostgreSQL without Docker:

### Free PostgreSQL Options:
- **Neon** (https://neon.tech) - Free PostgreSQL
- **Supabase** (https://supabase.com) - Free PostgreSQL
- **ElephantSQL** (https://www.elephantsql.com) - Free tier

### Free Redis Options:
- **Upstash** (https://upstash.com) - Free Redis
- **Redis Cloud** (https://redis.com/try-free) - Free tier

Then update `backend\.env` with the connection strings.

---

## 📝 Quick Commands Summary

```powershell
# One-time setup
cd backend
npm install
npx prisma db push
npx prisma db seed

cd ..\frontend  
npm install

# Every time you start working
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Then open: http://localhost:3001

---

## ✅ What Works Without Docker

✅ All manual price entry features
✅ Product sync from Shopify
✅ Price calculations
✅ Preview and push to Shopify
✅ Audit logs and history
✅ Settings management

The only difference is you need to run backend and frontend in separate terminals instead of using Docker.
