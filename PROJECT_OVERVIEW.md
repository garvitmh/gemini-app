# Project Overview

## Project Architecture & Tech Stack
The workspace represents a Shopify application named **Metal & Gem Price Editor**. It features a decoupled architecture with a Node.js backend and a React frontend to manage live metal and gem prices for jewelry stores.

### **Tech Stack**
- **Backend:** Node.js, Express, Shopify App Express API (`@shopify/shopify-app-express`), GraphQL, Bull (for job queues).
- **Database / ORM:** Prisma ORM, SQLite (`dev.db` locally by default, but configured for Postgres in `docker-compose.yml`), Redis (via `ioredis` for Bull queue management).
- **Frontend:** React, Vite, Shopify App Bridge (`@shopify/app-bridge-react`), Shopify Polaris (`@shopify/polaris`) for UI components, Recharts for data visualizations.

---

## Folder Structure
- `backend/`: Contains the monolithic Node.js Express server handling the App's core logic.
  - `dist/`: The compiled JavaScript source files encompassing the live backend API code.
  - `prisma/`: Prisma schema (`schema.prisma`) defining core structures like `Shop`, `Product`, `MetalRate`, `StoneRate`, scaling data and interactions.
  - `src/`: Application source directory designed for middleware (`middleware/`), routing logic (`routes/`), and type declarations.
  - Scripts: Contains numerous root-level `.js` helper scripts like `check-database.js` or `update_product.js` functioning as database migrations, diagnostic tests, or manual push scripts.
- `frontend/`: The frontend Single-Page Application (Vite).
  - `src/`: Houses `components/` (React building blocks), `pages/` (Application view modules), `utils/` (Helper logic), and `context/` (React App Context Providers).
- Root Configs: Features automated installation batches (`INSTALL.bat`, `setup-desktop.ps1`), Docker configs (`docker-compose.yml`) for local testing environments, and liquid Shopify templates `*.liquid` to render assets cleanly within actual storefronts.

---

## Entry Points
- **Backend Entry File:** `backend/dist/server-simple.js` (As configured via the `"main"` and `"dev"` scripts mapping dynamically in `package.json`). This instantiates Express, attaches Shopify middleware authentication plugins, and binds routing controllers to endpoints.
- **Frontend Entry File:** `frontend/index.html` loads up `frontend/src/main.tsx`. The Vite process bundles and renders the core `App.tsx` view inside the `<div id="root">`.

---

## API Flow & Frontend-Backend Setup
1. **Frontend Calls Initiation**: The React interface runs via the Shopify Admin view natively utilizing App Bridge. Client actions trigger `axios` requests routed natively to relative `/api/*` structures. Secure Shopify session tokens are automatically appended to API payloads using App Bridge's request utilities.
2. **Backend Parsing**: The backend Express APIs (e.g., in `server-simple.js` or `routes/`) intercept tasks. Using Shopify App Express middlewares, it maps the provided session token to a unique authenticated `shopId`.
3. **Database Operations**: Business rules interface with the DB utilizing `PrismaClient` to retrieve rulesets, default metal pricing mechanisms, and product data caches cleanly.
4. **Shopify Integration Logic (GraphQL)**: If values calculate into required live storefront price updates, the backend leverages `@shopify/shopify-api` to push modifications straight back up to the user's Shopify system using REST/GraphQL payloads, queuing any extensive recalculations via Bull/Redis to avoid timeout issues.

---

## Dependencies & Installation

### Core Dependencies
- **Backend**: `@prisma/client` (Database Engine), `@shopify/shopify-app-express` (Shopify Node Auth Engine), `express` (Server Pipeline), `bull` & `ioredis` (Background Web-Queue Processing), `csv-parse` & `xlsx` (For sheet ingestion).
- **Frontend**: `@shopify/app-bridge-react` (Client verification engine for Shopify Admins), `@shopify/polaris` (Theming / Admin Elements), `react-router-dom` (URL mapping), `axios` (API Networking).

### Setup and Running Locally
To install the dependencies manually and start the project:
1. Generate `backend` files:
   ```bash
   cd backend
   npm install
   npm run db:generate
   ```
2. Setup `frontend` environments:
   ```bash
   cd frontend
   npm install
   ```
3. Boot the environments side-by-side using:
   ```bash
   cd backend && npm run dev
   # Separately
   cd frontend && npm run dev
   ```
Alternatively, automated scripts like `INSTALL.bat` and `GeminiDesktop.bat` are uniquely structured in the application root to automate fetching and booting local dependencies on Windows directly.
