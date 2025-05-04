# PowerShell script to apply the tenant rent schema updates
param (
  [string]$DbUrl = $env:DATABASE_URL
)

$scriptPath = "C:\Users\User\RentWhisperer\config\update_schema_for_tenant_rent.sql"

# Check if the SQL file exists
if (-not (Test-Path $scriptPath)) {
  Write-Error "SQL script not found at $scriptPath"
  exit 1
}

Write-Output "Found SQL script at $scriptPath"

# Check if database connection is provided
if (-not $DbUrl) {
  $DbUrl = $env:SUPABASE_DB_URL
}

if (-not $DbUrl) {
  Write-Error "No database connection URL found. Please provide a connection URL as parameter or set DATABASE_URL environment variable."
  exit 1
}

# Run the SQL against the database
Write-Output "Running database schema update..."
psql $DbUrl -f $scriptPath

if ($LASTEXITCODE -eq 0) {
  Write-Output "Schema update completed successfully!"
}
else {
  Write-Error "Schema update failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}
