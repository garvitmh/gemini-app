# Gemini Desktop App - One-Click Installer
# This script will automatically set up and run the application

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Gemini Desktop App - Installer" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check for Node.js
Write-Host "[1/6] Checking for Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js NOT found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://nodejs.org/" -ForegroundColor White
    Write-Host "2. Choose LTS version (recommended)" -ForegroundColor White
    Write-Host "3. Run this installer again after installing" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Setup Environment Files
Write-Host ""
Write-Host "[2/6] Setting up environment files..." -ForegroundColor Yellow

# Prompt for Shopify credentials
Write-Host ""
Write-Host "Enter your Shopify credentials (or press Enter to use defaults):" -ForegroundColor Cyan
$shopifyStore = Read-Host "Shopify Store (e.g., yourstore.myshopify.com)"
if ([string]::IsNullOrWhiteSpace($shopifyStore)) {
    $shopifyStore = "yourstore.myshopify.com"
}

$shopifyKey = Read-Host "Shopify API Key (optional for now)"
if ([string]::IsNullOrWhiteSpace($shopifyKey)) {
    $shopifyKey = "your_api_key"
}

$shopifySecret = Read-Host "Shopify API Secret (optional for now)"
if ([string]::IsNullOrWhiteSpace($shopifySecret)) {
    $shopifySecret = "your_api_secret"
}

$shopifyToken = Read-Host "Shopify Access Token (optional for now)"
if ([string]::IsNullOrWhiteSpace($shopifyToken)) {
    $shopifyToken = "your_access_token"
}

# Create backend .env
$backendEnvLines = @(
    "SHOPIFY_API_KEY=$shopifyKey",
    "SHOPIFY_API_SECRET=$shopifySecret",
    "SHOPIFY_ACCESS_TOKEN=$shopifyToken",
    "SHOPIFY_STORE=$shopifyStore",
    "SCOPES=read_products,write_products",
    "DATABASE_URL=file:./dev.db",
    "PORT=3000",
    "NODE_ENV=development"
)
$backendEnv = $backendEnvLines -join [Environment]::NewLine

Set-Content -Path "backend\.env" -Value $backendEnv -Force
Write-Host "  ✓ Backend .env created" -ForegroundColor Green

# Create frontend .env
$frontendEnvLines = @(
    "VITE_API_URL=http://localhost:3000",
    "VITE_SHOPIFY_API_KEY=$shopifyKey"
)
$frontendEnv = $frontendEnvLines -join [Environment]::NewLine

Set-Content -Path "frontend\.env" -Value $frontendEnv -Force
Write-Host "  ✓ Frontend .env created" -ForegroundColor Green

# Step 3: Install Backend Dependencies
Write-Host ""
Write-Host "[3/6] Installing backend dependencies..." -ForegroundColor Yellow
Write-Host "  (This may take 2-3 minutes)" -ForegroundColor Gray
Set-Location backend
cmd /c "npm install --silent --no-progress"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend installation failed!" -ForegroundColor Red
    Write-Host "  Try running 'npm install' manually in the backend folder" -ForegroundColor Yellow
}
Set-Location ..

# Step 4: Install Frontend Dependencies
Write-Host ""
Write-Host "[4/6] Installing frontend dependencies..." -ForegroundColor Yellow
Write-Host "  (This may take 2-3 minutes)" -ForegroundColor Gray
Set-Location frontend
cmd /c "npm install --silent --no-progress"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Frontend installation failed!" -ForegroundColor Red
    Write-Host "  Try running 'npm install' manually in the frontend folder" -ForegroundColor Yellow
}
Set-Location ..

# Step 5: Initialize Database
Write-Host ""
Write-Host "[5/6] Initializing database..." -ForegroundColor Yellow
Set-Location backend
cmd /c "npx prisma generate"
cmd /c "npx prisma migrate dev --name init"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Database initialized" -ForegroundColor Green
} else {
    Write-Host "  ✓ Database already exists (skipped)" -ForegroundColor Green
}
Set-Location ..

# Step 6: Add default metal rates
Write-Host ""
Write-Host "[6/6] Adding default metal rates..." -ForegroundColor Yellow
Set-Location backend
if (Test-Path "add-rates.ts") {
    cmd /c "npx ts-node add-rates.ts"
    Write-Host "  ✓ Default rates added" -ForegroundColor Green
} else {
    Write-Host "  ⓘ Skipped (add-rates.ts not found)" -ForegroundColor Gray
}
Set-Location ..

# Installation Complete
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Installation Complete! ✓" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Ask if user wants to start the app now
Write-Host "Would you like to start the application now? (Y/N)" -ForegroundColor Cyan
$response = Read-Host
if ($response -eq 'Y' -or $response -eq 'y' -or $response -eq '') {
    Write-Host ""
    Write-Host "Starting Gemini Desktop App..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The app will open in your browser at: http://localhost:5173" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To stop the app, close this window or press Ctrl+C" -ForegroundColor Gray
    Write-Host ""
    
    # Start the app using the existing batch file
    if (Test-Path "GeminiDesktop.bat") {
        Start-Process "GeminiDesktop.bat"
    } else {
        # Manual start if batch file doesn't exist
        Write-Host "Starting backend..."
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; npm run dev"
        Start-Sleep -Seconds 3
        Write-Host "Starting frontend..."
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev"
        Start-Sleep -Seconds 2
        Start-Process "http://localhost:5173"
    }
} else {
    Write-Host ""
    Write-Host "You can start the app anytime by:" -ForegroundColor Yellow
    Write-Host "  • Double-clicking 'GeminiDesktop.bat'" -ForegroundColor White
    Write-Host "  OR running: .\GeminiDesktop.bat" -ForegroundColor White
    Write-Host ""
}
