# RunApplySchema.ps1
# Script to apply schema with environment variables set

# Load environment variables from .env file
$envFile = Join-Path -Path $PSScriptRoot -ChildPath ".env"
Write-Host "Looking for .env file at: $envFile"

if (Test-Path $envFile) {
  Write-Host ".env file found, loading environment variables..." -ForegroundColor Green
  $envVars = @{}
  
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim()
      $envVars[$name] = $value
      Write-Host "Loaded $name environment variable"
    }
  }
  
  # Set environment variables for Node.js process
  $env:SUPABASE_URL = $envVars["SUPABASE_URL"]
  $env:SUPABASE_SERVICE_ROLE_KEY = $envVars["SUPABASE_SERVICE_ROLE_KEY"]
  
  Write-Host "Environment variables set:"
  Write-Host "SUPABASE_URL = $env:SUPABASE_URL"
  Write-Host "SUPABASE_SERVICE_ROLE_KEY = [MASKED]"
  
  # Run the Node.js script
  Write-Host "Running apply-master-schema.js..." -ForegroundColor Green
  node src/scripts/apply-master-schema.js
}
else {
  Write-Host "No .env file found at $envFile" -ForegroundColor Yellow
  Write-Host "Looking for .env in parent directory..."
  
  $envFile = Join-Path -Path (Split-Path -Parent $PSScriptRoot) -ChildPath ".env"
  if (Test-Path $envFile) {
    Write-Host ".env file found in parent directory, loading environment variables..." -ForegroundColor Green
    $envVars = @{}
    
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$name] = $value
        Write-Host "Loaded $name environment variable"
      }
    }
    
    # Set environment variables for Node.js process
    $env:SUPABASE_URL = $envVars["SUPABASE_URL"]
    $env:SUPABASE_SERVICE_ROLE_KEY = $envVars["SUPABASE_SERVICE_ROLE_KEY"]
    
    Write-Host "Environment variables set:"
    Write-Host "SUPABASE_URL = $env:SUPABASE_URL"
    Write-Host "SUPABASE_SERVICE_ROLE_KEY = [MASKED]"
    
    # Run the Node.js script
    Write-Host "Running apply-master-schema.js..." -ForegroundColor Green
    node src/scripts/apply-master-schema.js
  }
  else {
    Write-Host "No .env file found in parent directory either" -ForegroundColor Red
    exit 1
  }
}
