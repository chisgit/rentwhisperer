# Test-AITools.ps1
# This script tests the AI tools functionality

Write-Host "Testing AI Tools..." -ForegroundColor Cyan

# Set the NODE_ENV to development
$env:NODE_ENV = "development"

# Check if the VECTOR.md file exists
if (-not (Test-Path -Path "../../VECTOR.md")) {
  Write-Host "VECTOR.md file not found. Please create it first." -ForegroundColor Red
  exit 1
}

# Run the test script
try {
  Write-Host "Running AI tools test script..." -ForegroundColor Yellow
  node -r ts-node/register src/scripts/test-ai-tools.js
    
  if ($LASTEXITCODE -eq 0) {
    Write-Host "AI tools test completed successfully!" -ForegroundColor Green
  }
  else {
    Write-Host "AI tools test failed with exit code $LASTEXITCODE" -ForegroundColor Red
  }
}
catch {
  Write-Host "Error running AI tools test: $_" -ForegroundColor Red
  exit 1
}
