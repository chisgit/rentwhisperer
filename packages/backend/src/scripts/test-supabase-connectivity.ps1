#Requires -Version 5.1

param (
  [string]$EnvPath = "packages/backend/.env"
)

try {
  Write-Host "Attempting to read Supabase URL from $EnvPath..."

  if (-not (Test-Path $EnvPath)) {
    Write-Error "Error: .env file not found at $EnvPath"
    exit 1
  }

  $envContent = Get-Content $EnvPath
  $supabaseUrlLine = $envContent | Where-Object { $_ -match "^SUPABASE_URL=" }

  if (-not $supabaseUrlLine) {
    Write-Error "Error: SUPABASE_URL not found in $EnvPath"
    exit 1
  }

  $supabaseUrl = ($supabaseUrlLine -split "=")[1].Trim()

  if ([string]::IsNullOrWhiteSpace($supabaseUrl)) {
    Write-Error "Error: SUPABASE_URL is empty in $EnvPath"
    exit 1
  }

  Write-Host "Found SUPABASE_URL: $supabaseUrl"
  
  $healthCheckUrl = "$($supabaseUrl.TrimEnd('/'))/auth/v1/health"
  Write-Host "Testing connectivity to Supabase auth health endpoint: $healthCheckUrl with a GET request..."

  # Try a GET request to the auth health endpoint
  $response = Invoke-WebRequest -Uri $healthCheckUrl -Method Get -ErrorAction SilentlyContinue -TimeoutSec 10

  if ($response) {
    # Successful 2xx response
    Write-Host "Successfully received a response from Supabase auth health endpoint."
    Write-Host "Status Code: $($response.StatusCode)"
    Write-Host "Status Description: $($response.StatusDescription)"
    # Consider dumping raw content if it's JSON and small, e.g., $response.Content
  }
  else {
    # Check the specific error from Invoke-WebRequest
    if ($Error.Count -gt 0 -and $Error[0].Exception -is [System.Net.WebException]) {
      $webException = $Error[0].Exception
      $statusCode = $null
      if ($webException.Response -is [System.Net.HttpWebResponse]) {
        $statusCode = [int]$webException.Response.StatusCode
      }

      if ($statusCode -eq 401) {
        Write-Host "Supabase auth health endpoint is reachable but returned a 401 Unauthorized."
        Write-Host "This indicates the service is online but this specific endpoint may require an API key for a full health status."
        Write-Host "Basic connectivity to the Supabase project is likely OK."
        # Optionally, you could try with an anon key if you want to go further
        # $headers = @{ "apikey" = "YOUR_ANON_KEY" }
        # Invoke-WebRequest -Uri $healthCheckUrl -Headers $headers ...
      }
      else {
        Write-Warning "Failed to connect to Supabase auth health endpoint: $healthCheckUrl"
        Write-Warning "Status Code: $statusCode"
        Write-Warning "Error details: $($webException.Message)"
        if ($webException.InnerException) {
          Write-Warning "Inner Exception: $($webException.InnerException.Message)"
        }
      }
    }
    elseif ($_.Exception) {
      # Fallback for other errors in the try block (should be rare here)
      Write-Warning "An unexpected script error occurred while trying to connect: $($_.Exception.Message)"
    }
    else {
      # Should not happen if ErrorAction SilentlyContinue is used and an error occurs
      Write-Warning "Failed to connect to Supabase auth health endpoint. No specific error details captured from Invoke-WebRequest. The request may have timed out or failed to resolve without a WebException."
    }
  }
}
catch {
  # Catch errors from Get-Content, Test-Path, etc., or if Invoke-WebRequest had ErrorAction Stop
  Write-Error "A script-level error occurred: $($_.Exception.Message)"
  if ($_.Exception.InnerException) {
    Write-Error "Inner Exception: $($_.Exception.InnerException.Message)"
  }
  exit 1
}
