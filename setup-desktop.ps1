# Setup Desktop Environment
$EnvContent = @"
PORT=3000
NODE_ENV=development
SHOPIFY_API_KEY=2fa3c430bd367ddb0ffbbf23fbce5950
SHOPIFY_API_SECRET=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
SHOPIFY_ACCESS_TOKEN=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
SHOPIFY_STORE=daginawala11.myshopify.com
SCOPES=read_products,write_products,read_inventory,write_inventory
DATABASE_URL="file:./dev.db"
SESSION_SECRET=desktop_session_secret
"@

$FrontendEnvContent = @"
VITE_SHOPIFY_API_KEY=2fa3c430bd367ddb0ffbbf23fbce5950
VITE_API_URL=http://localhost:3000
"@

Write-Host "Creating local configuration..."
Set-Content -Path "backend\.env" -Value $EnvContent
Set-Content -Path "frontend\.env" -Value $FrontendEnvContent

Write-Host "Initializing Database..."
cd backend
npx prisma generate
npx prisma migrate dev --name init_desktop

Write-Host "✅ Desktop Setup Complete!"
Write-Host "Run 'GeminiDesktop.bat' to start the app."
