@echo off
echo Setting up Metal & Gem Price Editor...
echo.

REM Create backend .env file
echo Creating backend/.env...
(
echo NODE_ENV=development
echo PORT=3000
echo HOST=http://localhost:3000
echo.
echo # Your Shopify Credentials
echo SHOPIFY_API_KEY=your_api_key_here
echo SHOPIFY_API_SECRET=your_api_secret_here
echo SCOPES=write_products,read_products,write_inventory,read_inventory
echo.
echo # Database
echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/metal_gem_price_editor
echo.
echo # Redis
echo REDIS_URL=redis://localhost:6379
echo.
echo # Session ^& Encryption
echo SESSION_SECRET=daginawala_session_secret_2024
echo ENCRYPTION_KEY=daginawala_encryption_key_32chars
) > backend\.env

REM Create frontend .env file
echo Creating frontend/.env...
(
echo VITE_SHOPIFY_API_KEY=your_api_key_here
) > frontend\.env

echo.
echo ✓ Environment files created!
echo.
echo Next steps:
echo 1. Make sure Docker Desktop is running
echo 2. Run: docker-compose up -d
echo 3. Wait for services to start
echo 4. Access the app at http://localhost:3001
echo.
pause
