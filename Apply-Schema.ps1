# Apply Schema to Supabase using JavaScript client
Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "  RentWhisperer - Apply Database Schema with JS Client" -ForegroundColor Cyan
Write-Host "======================================================`n" -ForegroundColor Cyan

# Change to the scripts directory
$scriptsDir = Join-Path -Path $PSScriptRoot -ChildPath "packages\backend\src\scripts"
Set-Location -Path $scriptsDir

Write-Host "Running script from: $scriptsDir`n" -ForegroundColor Yellow

# Run the update-schema-js script
Write-Host "Applying schema with JavaScript client...`n" -ForegroundColor Yellow
node apply-schema-js.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Schema update completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Schema update failed!" -ForegroundColor Red
}

Write-Host "`nIf successful, please restart your backend server."
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
