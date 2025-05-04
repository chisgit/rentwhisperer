# PowerShell script to apply the master schema for RentWhisperer
# This will apply all schema changes to the database

# Load environment variables from .env file
$envFile = Join-Path -Path (Resolve-Path -Path "$PSScriptRoot\..\..").Path -ChildPath ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
      [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
  }
}

# Path to schema file
$schemaPath = Join-Path -Path (Resolve-Path -Path "$PSScriptRoot\..\..\..\..\").Path -ChildPath "config\supabase_schema.sql"

Write-Host "Applying master database schema..." -ForegroundColor Green
Write-Host "Using schema file: $schemaPath" -ForegroundColor Cyan

# Check if file exists
if (-not (Test-Path $schemaPath)) {
  Write-Host "Schema file not found at $schemaPath" -ForegroundColor Red
  exit 1
}

# Get Supabase credentials from environment variables
$supabaseUrl = $env:SUPABASE_URL
$supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

# Either use the Supabase credentials or fallback to direct database URL
$dbUrl = $null

if ($supabaseUrl -and $supabaseServiceKey) {
  Write-Host "Using Supabase credentials to construct database URL..." -ForegroundColor Green
    
  # Extract the hostname from the SUPABASE_URL
  $hostname = $supabaseUrl -replace "https://", ""
  
  # Construct the database URL (Supabase format)
  $dbUrl = "postgresql://postgres:${supabaseServiceKey}@db.${hostname}:5432/postgres"
  Write-Host "Database URL constructed from Supabase credentials"
}
else {
  # Fallback to direct database URL if Supabase credentials are not available
  $dbUrl = $env:DATABASE_URL
  if (-not $dbUrl) {
    $dbUrl = $env:SUPABASE_DB_URL
  }
  if (-not $dbUrl) {
    Write-Host "No database connection URL found in environment variables." -ForegroundColor Red
    Write-Host "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL as a fallback" -ForegroundColor Red
    exit 1
  }  
}

# Run the SQL script against the database
Write-Host "Applying schema to the database..." -ForegroundColor Green
$command = "psql $dbUrl -f `"$schemaPath`""

Write-Host "Executing command: $command" -ForegroundColor Yellow

try {
  Invoke-Expression $command
  Write-Host "Schema update completed successfully!" -ForegroundColor Green
}
catch {
  Write-Host "Error executing SQL: $_" -ForegroundColor Red
  exit 1
}
