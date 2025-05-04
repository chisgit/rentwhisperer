# set-db-url.ps1
# Script to get Supabase DB URL using Supabase CLI

# Check if supabase CLI is installed
$supabaseCli = Get-Command supabase -ErrorAction SilentlyContinue

if (-not $supabaseCli) {
  Write-Error "Supabase CLI not found. Please install it first: https://supabase.com/docs/guides/cli/getting-started"
  exit 1
}

Write-Host "Getting Supabase DB URL..."

# Try to get the database URL from supabase CLI
try {
  $dbUrl = supabase db connect --uri
    
  # Set this as an environment variable
  $env:DATABASE_URL = $dbUrl
    
  Write-Host "Database URL set as environment variable: $dbUrl"

  # Now run the reset-database script
  Write-Host "Running reset-database script..."
  node reset-database.js
}
catch {
  Write-Error "Failed to get database URL from Supabase CLI: $_"
    
  # Try to construct the URL manually
  $supabaseUrl = $env:SUPABASE_URL
  $supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY
    
  if ($supabaseUrl -and $supabaseServiceKey) {
    Write-Host "Constructing database URL from SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY..."
        
    # Extract the hostname from the SUPABASE_URL
    $hostname = $supabaseUrl -replace "https://", ""
        
    # Standard Supabase DB connection format
    $dbUrl = "postgresql://postgres:$supabaseServiceKey@db.$hostname:5432/postgres"
    $env:DATABASE_URL = $dbUrl
        
    Write-Host "Database URL set as environment variable (manually constructed)"
        
    # Now run the reset-database script
    Write-Host "Running reset-database script..."
    node reset-database.js
  }
  else {
    Write-Error "Could not construct database URL. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    exit 1
  }
}
