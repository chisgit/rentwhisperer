# Check the database schema structure
$env:NODE_ENV = "development"

# Find the .env file and load it
$envFile = Join-Path -Path (Get-Location) -ChildPath ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
      $name = $matches[1]
      $value = $matches[2]
      # Remove surrounding quotes if present
      if ($value -match '^"(.*)"$') { $value = $matches[1] }
      if ($value -match "^'(.*)'$") { $value = $matches[1] }
      # Set environment variable
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
      Write-Host "Loaded $name from .env file"
    }
  }
}
else {
  Write-Warning ".env file not found. Make sure environment variables are set."
}

Write-Host "Running schema verification..."
node src/scripts/check-schema.js
