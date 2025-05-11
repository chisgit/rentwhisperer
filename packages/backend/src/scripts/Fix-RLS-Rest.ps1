# Script to fix RLS permissions in Supabase using REST API
# This avoids needing psql installed locally

Write-Host "Fixing RLS permissions using REST API..." -ForegroundColor Cyan

# Set working directory to the script directory
$scriptDirectory = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
Set-Location -Path $scriptDirectory

# Load .env file 
$envFile = Join-Path $scriptDirectory "../../.env"
Write-Host "Loading environment variables from: $envFile" -ForegroundColor Yellow

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      $key = $matches[1].Trim()
      $value = $matches[2].Trim()
      # Remove quotes if present
      if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
        $value = $matches[1]
      }
      Set-Item -Path "env:$key" -Value $value
      Write-Host "Set env:$key" -ForegroundColor DarkGray
    }
  }
}

# Get Supabase credentials
$supabaseUrl = $env:SUPABASE_URL
$supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseUrl -or -not $supabaseServiceKey) {
  Write-Host "Error: Missing Supabase credentials. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set." -ForegroundColor Red
  exit 1
}

Write-Host "Using Supabase URL: $supabaseUrl" -ForegroundColor Green

# Define SQL statements to fix permissions
$sqlStatements = @(
  "ALTER TABLE IF EXISTS public.tenants DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.properties DISABLE ROW LEVEL SECURITY;", 
  "ALTER TABLE IF EXISTS public.units DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.tenant_units DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.rent_payments DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.incoming_messages DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.landlords DISABLE ROW LEVEL SECURITY;",
  "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;",
  "GRANT USAGE ON SCHEMA public TO anon, authenticated;",
  "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;"
)

# Use REST API to execute SQL
$apiEndpoint = "$supabaseUrl/rest/v1/rpc/execute_sql"
$headers = @{
  "apikey"        = $supabaseServiceKey
  "Authorization" = "Bearer $supabaseServiceKey"
  "Content-Type"  = "application/json"
}

# Create function to execute SQL
function Create-ExecuteFunction {
  $createFunctionSQL = @"
CREATE OR REPLACE FUNCTION public.execute_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS `$`$
BEGIN
  EXECUTE sql_query;
END;
`$`$;
"@

  try {
    # Try to create function through REST API (may fail if no existing function)
    $body = @{
      "sql_query" = $createFunctionSQL
    } | ConvertTo-Json

    Write-Host "Creating execute_sql function..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $apiEndpoint -Method Post -Headers $headers -Body $body -ErrorAction SilentlyContinue
    Write-Host "Function created successfully" -ForegroundColor Green
    return $true
  }
  catch {
    # Check if this is just because the function doesn't exist yet
    if ($_.ErrorDetails.Message -match "function.*does not exist") {
      # We need to create the function first
      Write-Host "Function doesn't exist. Please create it manually via the Supabase SQL Editor:" -ForegroundColor Yellow
      Write-Host $createFunctionSQL -ForegroundColor DarkCyan
      Write-Host "`nAfter creating the function, run this script again." -ForegroundColor Yellow
      return $false
    }
    else {
      Write-Host "Error creating function: $_" -ForegroundColor Red
      return $false
    }
  }
}

# Create the function first
$functionCreated = Create-ExecuteFunction

# If function created or already exists, execute the SQL statements
if ($functionCreated) {
  $errorCount = 0
  $successCount = 0
    
  # Execute each SQL statement
  foreach ($sql in $sqlStatements) {
    try {
      $body = @{
        "sql_query" = $sql
      } | ConvertTo-Json

      Write-Host "Executing: $sql" -ForegroundColor Cyan
      $response = Invoke-RestMethod -Uri $apiEndpoint -Method Post -Headers $headers -Body $body
      Write-Host "Success!" -ForegroundColor Green
      $successCount++
    }
    catch {
      Write-Host "Error executing SQL: $_" -ForegroundColor Red
      $errorCount++
    }
  }

  # Show summary
  Write-Host "`nPermission update complete!" -ForegroundColor Green
  Write-Host "Successful statements: $successCount" -ForegroundColor Green
  Write-Host "Failed statements: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
    
  if ($errorCount -gt 0) {
    Write-Host "Some statements failed, but permissions may still be fixed." -ForegroundColor Yellow
    exit 1
  }
  else {
    Write-Host "All permissions applied successfully. You should now have proper access." -ForegroundColor Green
    exit 0
  }
}
