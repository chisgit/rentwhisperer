# TryRestAPI.ps1
# Quick test of Supabase REST API

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

# Get Supabase credentials
$supabaseUrl = $env:SUPABASE_URL
$supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

# Check if variables exist and display status
$supabaseUrlStatus = if ($supabaseUrl) { "Found" } else { "Not found" }
$supabaseKeyStatus = if ($supabaseServiceKey) { "Found" } else { "Not found" }

Write-Host "SUPABASE_URL: $supabaseUrlStatus"
Write-Host "SUPABASE_SERVICE_ROLE_KEY: $supabaseKeyStatus"

# Create headers for REST API calls
$headers = @{
    "apikey" = $supabaseServiceKey
    "Authorization" = "Bearer $supabaseServiceKey"
    "Content-Type" = "application/json"
    "Prefer" = "return=minimal"
}

# Simple SQL to test
$testSQL = "SELECT version();"

try {
    # Test SQL API
    $body = @{
        "query" = $testSQL
    } | ConvertTo-Json
    
    # First try with SQL tag endpoint
    Write-Host "Trying to connect to Supabase SQL endpoint..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/execute_sql" -Method POST -Headers $headers -Body $body -ErrorAction SilentlyContinue
    
    Write-Host "SQL executed via execute_sql function:" -ForegroundColor Green
    Write-Host $response -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    
    # Try to get more detailed error information
    try {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Error details: $($errorDetails.message)" -ForegroundColor Red
        
        # If the function doesn't exist, create it
        if ($errorDetails.message -match "function execute_sql.* does not exist") {
            Write-Host "The execute_sql function doesn't exist. Trying to create it..." -ForegroundColor Yellow
            
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
            
            # Try SQL API endpoint
            Write-Host "Trying Supabase SQL API endpoint..." -ForegroundColor Cyan
            $sqlEndpointResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/sql" -Method POST -Headers $headers -Body $createFunctionSQL
            Write-Host "Function created via SQL endpoint" -ForegroundColor Green
            
            # Try again with the function
            $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/execute_sql" -Method POST -Headers $headers -Body $body
            Write-Host "SQL executed via execute_sql function:" -ForegroundColor Green
            Write-Host $response -ForegroundColor Green
        }
    } catch {
        Write-Host "Could not create function or parse error details: $_" -ForegroundColor Red
    }
}
