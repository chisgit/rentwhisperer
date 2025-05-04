# ResetDatabaseAPI.ps1
# A script to reset the database using Supabase REST API instead of psql

# Load environment variables from .env file
$envFile = Join-Path -Path $PSScriptRoot -ChildPath ".env"
Write-Host "Looking for .env file at: $envFile"

if (Test-Path $envFile) {
  Write-Host ".env file found, loading environment variables..." -ForegroundColor Green
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim()
      [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
      Write-Host "Set $name environment variable"
    }
  }
}
else {
  Write-Host "No .env file found at $envFile" -ForegroundColor Yellow
}

# Get Supabase credentials
$supabaseUrl = $env:SUPABASE_URL
$supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

# Check if variables exist and display status
$supabaseUrlStatus = if ($supabaseUrl) { "Found" } else { "Not found" }
$supabaseKeyStatus = if ($supabaseServiceKey) { "Found" } else { "Not found" }

Write-Host "SUPABASE_URL: $supabaseUrlStatus"
Write-Host "SUPABASE_SERVICE_ROLE_KEY: $supabaseKeyStatus"

if (-not $supabaseUrl -or -not $supabaseServiceKey) {
  Write-Host "Missing Supabase credentials. Please ensure your .env file contains:" -ForegroundColor Red
  Write-Host "SUPABASE_URL=<your-supabase-url>" -ForegroundColor Yellow
  Write-Host "SUPABASE_SERVICE_ROLE_KEY=<your-service-key>" -ForegroundColor Yellow
  exit 1
}

# Path to schema file
$schemaPath = Join-Path -Path $PSScriptRoot -ChildPath "config\supabase_schema.sql"
Write-Host "Using schema file: $schemaPath" -ForegroundColor Cyan

# Check if file exists
if (-not (Test-Path $schemaPath)) {
  Write-Host "Schema file not found at $schemaPath" -ForegroundColor Red
  exit 1
}

# Read the schema file
$schemaContent = Get-Content -Path $schemaPath -Raw
Write-Host "Schema file loaded successfully ($(($schemaContent.Length)/1024) KB)" -ForegroundColor Green

# SQL to drop all tables
$dropTablesSQL = @"
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Disable all triggers
    EXECUTE 'SET session_replication_role = replica';
    
    -- Drop all tables in public schema
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Re-enable triggers
    EXECUTE 'SET session_replication_role = DEFAULT';
END $$;
"@

Write-Host "Resetting database via Supabase REST API..." -ForegroundColor Yellow
Write-Host "1. Dropping all tables..." -ForegroundColor Yellow

# Create headers for REST API calls
$headers = @{
  "apikey"        = $supabaseServiceKey
  "Authorization" = "Bearer $supabaseServiceKey"
  "Content-Type"  = "application/json"
  "Prefer"        = "return=minimal"
}

# First request - Drop all tables
try {
  $body = @{
    "query" = $dropTablesSQL
  } | ConvertTo-Json

  $dropTablesUrl = "$supabaseUrl/rest/v1/rpc/execute_sql"
    
  # Check if execute_sql function exists, if not we'll create it
    
  # Create the execute_sql function if it doesn't exist
  $createFunctionSQL = @"
    CREATE OR REPLACE FUNCTION execute_sql(sql_query text) 
    RETURNS text 
    LANGUAGE plpgsql 
    SECURITY DEFINER
    AS $$
    BEGIN
        EXECUTE sql_query;
        RETURN 'SQL executed successfully';
    EXCEPTION
        WHEN OTHERS THEN
            RETURN 'Error: ' || SQLERRM;
    END;
    $$;
"@

  $functionBody = @{
    "query" = $createFunctionSQL
  } | ConvertTo-Json

  $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/execute_sql" -Method POST -Headers $headers -Body $functionBody -ErrorAction SilentlyContinue
  Write-Host "Created or updated execute_sql function" -ForegroundColor Green
    
  # Now execute the drop tables SQL
  $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/execute_sql" -Method POST -Headers $headers -Body $body
  Write-Host "Tables dropped successfully" -ForegroundColor Green
    
  # Second request - Apply schema
  Write-Host "2. Applying schema..." -ForegroundColor Yellow
    
  $schemaBody = @{
    "query" = $schemaContent
  } | ConvertTo-Json
    
  $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/execute_sql" -Method POST -Headers $headers -Body $schemaBody
  Write-Host "Schema applied successfully!" -ForegroundColor Green
    
  Write-Host "`nDatabase reset complete. The database has been reset with the new schema." -ForegroundColor Cyan
    
}
catch {
  Write-Host "Error interacting with Supabase API: $_" -ForegroundColor Red
    
  Write-Host "Response: $($_.Exception.Response.StatusCode.value__) $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    
  # Try to get more detailed error information
  try {
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Error details: $($errorDetails.message)" -ForegroundColor Red
  }
  catch {
    Write-Host "Could not parse error details. Raw response: $($_.ErrorDetails.Message)" -ForegroundColor Red
  }
    
  exit 1
}
