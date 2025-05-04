# Smart-Reset-Database.ps1
# This script will automatically select the best method to reset the database
# based on what tools are available on the system

# Get the directory of this script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# First, try to determine if PostgreSQL client is installed
$psqlAvailable = $false
try {
    $psqlVersion = & psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $psqlAvailable = $true
        Write-Host "PostgreSQL client detected: $psqlVersion" -ForegroundColor Green
    }
}
catch {
    Write-Host "PostgreSQL client (psql) not detected" -ForegroundColor Yellow
}

# Decide which approach to use
if ($psqlAvailable) {
    Write-Host "Using PostgreSQL client for database reset..." -ForegroundColor Green
    & "$scriptDir\Reset-Database.ps1"
}
else {
    Write-Host "Using REST API approach for database reset (no PostgreSQL client needed)..." -ForegroundColor Green
    & "$scriptDir\Reset-Database-REST.ps1"
}

# Check if the script executed successfully
if ($LASTEXITCODE -eq 0) {
    Write-Host "Database reset completed successfully!" -ForegroundColor Green
}
else {
    Write-Host "Database reset failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
