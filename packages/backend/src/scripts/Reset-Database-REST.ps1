# Reset-Database-REST.ps1
# A script to reset the database using Supabase REST API instead of psql
# This approach works without needing PostgreSQL client tools installed

# Get the directory of this script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptDir))
$rootDir = Split-Path -Parent $rootDir
$schemaPath = Join-Path $rootDir "config\supabase_schema.sql"

# Load environment variables from .env file
$envPaths = @(
  # Check in the script directory first
    (Join-Path $scriptDir ".env"),
  # Then check in the backend folder
    (Join-Path $scriptDir "..\.env"),
  # Then check in the project root
    (Join-Path $rootDir ".env")
)

$envLoaded = $false
foreach ($envPath in $envPaths) {
  if (Test-Path $envPath) {
    Write-Host ".env file found at: $envPath" -ForegroundColor Green
    Get-Content $envPath | ForEach-Object {
      if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
        Write-Host "Set $name environment variable"
      }
    }
    $envLoaded = $true
    break
  }
}

if (-not $envLoaded) {
  Write-Host "No .env file found in any of the checked locations." -ForegroundColor Yellow
}

# Check if schema file exists
if (-Not (Test-Path $schemaPath)) {
  Write-Error "Schema file not found at $schemaPath"
  exit 1
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
  Write-Error "Supabase credentials missing. Please check your .env file contains SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  exit 1
}

# Create headers for REST API calls
$headers = @{
  "apikey"        = $supabaseServiceKey
  "Authorization" = "Bearer $supabaseServiceKey"
  "Content-Type"  = "application/json"
  "Prefer"        = "params=single-object"
}

# Read the schema file
$schemaContent = Get-Content -Path $schemaPath -Raw
Write-Host "Schema file loaded: $($schemaContent.Length) characters" -ForegroundColor Green

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

# Function to create the execute_sql function in Supabase
function Create-ExecuteSqlFunction {
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

  try {
    $body = @{
      "query" = $createFunctionSQL
    } | ConvertTo-Json

    Write-Host "Creating execute_sql function..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/sql" -Method POST -Headers $headers -Body $body
    Write-Host "Function created successfully" -ForegroundColor Green
    return $true
  }
  catch {
    Write-Host "Error creating function: $_" -ForegroundColor Red
    return $false
  }
}

# Function to execute SQL using the execute_sql function
function Execute-SQL {
  param(
    [string]$sql
  )

  try {
    $body = @{
      "query" = $sql
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/sql" -Method POST -Headers $headers -Body $body
    return $response
  }
  catch {
    Write-Host "Error executing SQL: $_" -ForegroundColor Red
        
    # Try the alternative approach with execute_sql function
    try {
      $functionCreated = Create-ExecuteSqlFunction
      if ($functionCreated) {
        $body = @{
          "sql_query" = $sql
        } | ConvertTo-Json
                
        $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/execute_sql" -Method POST -Headers $headers -Body $body
        return $response
      }
    }
    catch {
      Write-Host "Alternative approach failed too: $_" -ForegroundColor Red
    }
        
    return $null
  }
}

# Function to split SQL into chunks to avoid timeouts
function Split-SqlIntoChunks {
  param(
    [string]$sql,
    [int]$maxChunkSize = 50000
  )
    
  $chunks = @()
  $statements = $sql -split ";"
  $currentChunk = ""
    
  foreach ($stmt in $statements) {
    $trimmedStmt = $stmt.Trim()
    if ($trimmedStmt -eq "") {
      continue
    }
        
    # If adding this statement would exceed chunk size, start a new chunk
    if ($currentChunk.Length + $trimmedStmt.Length + 1 -gt $maxChunkSize -and $currentChunk.Length -gt 0) {
      $chunks += "$currentChunk;"
      $currentChunk = ""
    }
        
    $currentChunk += "$trimmedStmt;"
  }
    
  if ($currentChunk.Length -gt 0) {
    $chunks += $currentChunk
  }
    
  return $chunks
}

# Main execution
try {
  # Step 1: Drop all tables
  Write-Host "1. Dropping all tables..." -ForegroundColor Cyan
  $dropResult = Execute-SQL -sql $dropTablesSQL
  if ($dropResult -eq $null) {
    Write-Error "Failed to drop tables. Stopping."
    exit 1
  }
  Write-Host "Tables dropped successfully!" -ForegroundColor Green

  # Step 2: Split schema into manageable chunks
  $schemaChunks = Split-SqlIntoChunks -sql $schemaContent -maxChunkSize 50000
  Write-Host "Schema will be applied in $($schemaChunks.Count) chunks" -ForegroundColor Cyan

  # Step 3: Apply schema in chunks
  Write-Host "2. Applying schema..." -ForegroundColor Cyan
  $chunkNumber = 1
  foreach ($chunk in $schemaChunks) {
    Write-Host "Applying schema chunk $chunkNumber/$($schemaChunks.Count) ($(($chunk.Length / 1KB).ToString("F0"))KB)..." -ForegroundColor Cyan
    $schemaResult = Execute-SQL -sql $chunk
        
    if ($schemaResult -eq $null) {
      Write-Error "Failed to apply schema chunk $chunkNumber. You may need to retry."
      exit 1
    }
        
    $chunkNumber++
  }

  Write-Host "Database reset completed successfully!" -ForegroundColor Green
}
catch {
  Write-Error "An error occurred: $_"
  exit 1
}
