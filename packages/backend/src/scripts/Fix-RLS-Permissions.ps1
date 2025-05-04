# Script to fix RLS permissions in Supabase
# This will disable Row Level Security (RLS) for all tables in the database

Write-Host "Fixing RLS permissions in Supabase database..." -ForegroundColor Green

# Set working directory to the script directory
$scriptDirectory = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
Set-Location -Path $scriptDirectory

# Run the Node.js script to fix RLS permissions
Write-Host "Running fix-rls-permissions.js..." -ForegroundColor Cyan
node fix-rls-permissions.js

# If successful, display completion message
if ($LASTEXITCODE -eq 0) {
    Write-Host "`nRLS permissions fixed successfully. Tenant updates should now work properly." -ForegroundColor Green
} else {
    Write-Host "`nError fixing RLS permissions. Please check the error messages above." -ForegroundColor Red
}
