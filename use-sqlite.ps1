# Update backend/.env to use SQLite
$envPath = "backend\.env"
$content = Get-Content $envPath -Raw
$content = $content -replace 'DATABASE_URL=postgresql://.*', 'DATABASE_URL="file:./dev.db"'
Set-Content -Path $envPath -Value $content -NoNewline

Write-Host "Updated backend/.env to use SQLite"
Write-Host ""
Write-Host "Now run:"
Write-Host "  cd backend"
Write-Host "  npx prisma db push"
Write-Host "  npm run dev"
