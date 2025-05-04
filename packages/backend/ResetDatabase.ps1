# ResetDatabase.ps1
# A direct script to reset the database

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
} else {
    Write-Host "No .env file found at $envFile" -ForegroundColor Yellow
    
    # Try parent directory
    $envFile = Join-Path -Path $PSScriptRoot -ChildPath "..\..\.env"
    Write-Host "Looking for .env file at: $envFile"
    
    if (Test-Path $envFile) {
        Write-Host ".env file found in parent directory, loading environment variables..." -ForegroundColor Green
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
                Write-Host "Set $name environment variable"
            }
        }
    } else {
        Write-Host "No .env file found in parent directory either" -ForegroundColor Yellow
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

# Construct the database URL from Supabase credentials
if ($supabaseUrl -and $supabaseServiceKey) {
    Write-Host "Constructing database URL from SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY..." -ForegroundColor Green
    
    # Extract the hostname from the SUPABASE_URL
    $hostname = $supabaseUrl -replace "https://", ""
    
    # Construct the database URL (Supabase format)
    $dbUrl = "postgresql://postgres:${supabaseServiceKey}@db.${hostname}:5432/postgres"
    
    # Set as environment variable
    [System.Environment]::SetEnvironmentVariable("DATABASE_URL", $dbUrl, "Process")
      Write-Host "Database URL constructed and set as environment variable: $dbUrl" -ForegroundColor Green
    
    # Path to schema file - for backend directory
    $schemaPath = Join-Path -Path $PSScriptRoot -ChildPath "..\..\config\supabase_schema.sql"
    
    # If not found, try relative to the workspace root
    if (-not (Test-Path $schemaPath)) {
        $schemaPath = Join-Path -Path $PSScriptRoot -ChildPath "config\supabase_schema.sql"
    }
    
    Write-Host "Using schema file: $schemaPath" -ForegroundColor Cyan

    # Check if file exists
    if (-not (Test-Path $schemaPath)) {
        Write-Host "Schema file not found at $schemaPath" -ForegroundColor Red
        exit 1
    }

    # Drop tables query
    $dropTablesQuery = @"
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

    # Execute the drop tables query
    Write-Host "Dropping all existing tables..." -ForegroundColor Yellow
    $dropTablesCommand = "psql $dbUrl -c `"$dropTablesQuery`""
    
    Write-Host "Executing command: $dropTablesCommand"
    
    try {
        Invoke-Expression $dropTablesCommand
        Write-Host "Tables dropped successfully." -ForegroundColor Green
        
        # Apply the schema file
        Write-Host "Applying schema..." -ForegroundColor Yellow
        $applySchemaCommand = "psql $dbUrl -f `"$schemaPath`""
        
        Write-Host "Executing command: $applySchemaCommand"
        
        Invoke-Expression $applySchemaCommand
        Write-Host "Database reset and schema applied successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "Error executing SQL: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Missing Supabase credentials. Please ensure your .env file contains:" -ForegroundColor Red
    Write-Host "SUPABASE_URL=<your-supabase-url>" -ForegroundColor Yellow
    Write-Host "SUPABASE_SERVICE_ROLE_KEY=<your-service-key>" -ForegroundColor Yellow
}
