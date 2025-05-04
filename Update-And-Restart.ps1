# Update Database Schema and Restart Backend Server
Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "  RentWhisperer - Database Update and Server Restart" -ForegroundColor Cyan
Write-Host "======================================================`n" -ForegroundColor Cyan

# Change to the scripts directory
$scriptsDir = Join-Path -Path $PSScriptRoot -ChildPath "packages\backend\src\scripts"
Set-Location -Path $scriptsDir

# Step 1: Apply schema updates
Write-Host "[1/3] Applying database schema with JavaScript client...`n" -ForegroundColor Yellow
node apply-schema-js.js

if ($LASTEXITCODE -ne 0) {
  Write-Host "`n❌ Schema update failed! Fix any errors before continuing." -ForegroundColor Red
  Write-Host "Press any key to exit..." -ForegroundColor Gray
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
  exit 1
}

# Step 2: Test the connection
Write-Host "`n[2/3] Testing Supabase connection...`n" -ForegroundColor Yellow
node enhanced-connection-test.js

if ($LASTEXITCODE -ne 0) {
  Write-Host "`n❌ Connection test failed! Fix any errors before continuing." -ForegroundColor Red
  Write-Host "Press any key to exit..." -ForegroundColor Gray
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
  exit 1
}

# Step 3: Restart backend server
Write-Host "`n[3/3] Restarting backend server...`n" -ForegroundColor Yellow

# Kill any existing node processes running the backend server 
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match "RentWhisperer Backend" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Change to the backend directory
$backendDir = Join-Path -Path $PSScriptRoot -ChildPath "packages\backend"
Set-Location -Path $backendDir

# Start the backend server in a new window
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" -WindowStyle Normal -WorkingDirectory $backendDir

Write-Host "`n✅ Database updated and backend server restarted successfully!" -ForegroundColor Green

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
