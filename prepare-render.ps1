# Gemini App - Render.com Deployment Script
# Run this before deploying to Render

Write-Host "🚀 Preparing Gemini App for Render.com Deployment..." -ForegroundColor Cyan

# Check if git is initialized
if (-not (Test-Path ".git")) {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
    git add .
    git commit -m "Initial commit for Render deployment"
} else {
    Write-Host "✅ Git repository already initialized" -ForegroundColor Green
}

# Add changes
Write-Host "📝 Adding render.yaml and health check..." -ForegroundColor Yellow
git add render.yaml
git add backend/src/server-simple.ts
git commit -m "Add Render.com deployment configuration" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Preparation Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Create GitHub repository at: https://github.com/new" -ForegroundColor White
Write-Host "2. Run these commands:" -ForegroundColor White
Write-Host "   git remote add origin https://github.com/YOUR-USERNAME/gemini-app.git" -ForegroundColor Yellow
Write-Host "   git branch -M main" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Go to Render.com and deploy from GitHub" -ForegroundColor White
Write-Host ""
Write-Host "📖 Full guide: See render_deployment_guide.md" -ForegroundColor Cyan
