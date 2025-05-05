# Simple PowerShell script to run all RentWhisperer tests

Write-Host "Starting RentWhisperer test suite..."

# Create array of test files
$TestFiles = @(
  "src\pages\__tests__\Payments.test.tsx",
  "src\hooks\__tests__\usePayments.test.ts",
  "src\components\payments\__tests__\PaymentFilters.test.tsx",
  "src\components\payments\__tests__\PaymentsTable.test.tsx",
  "src\utils\__tests__\formatters.test.ts",
  "src\types\__tests__\payment.types.test.ts"
)

# Track test results
$Passed = 0
$Failed = 0
$FailedTests = @()

# Run each test file individually
foreach ($TestFile in $TestFiles) {
  Write-Host "Running test: $TestFile"
    
  if (Test-Path $TestFile) {
    npx jest $TestFile --verbose
        
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Test passed: $TestFile"
      $Passed++
    }
    else {
      Write-Host "Test failed: $TestFile"
      $FailedTests += $TestFile
      $Failed++
    }
  }
  else {
    Write-Host "Test file not found: $TestFile"
    $FailedTests += "$TestFile (not found)"
    $Failed++
  }
}

# Display summary
Write-Host "========== Test Summary =========="
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"

if ($FailedTests.Count -gt 0) {
  Write-Host "Failed tests:"
  foreach ($TestFile in $FailedTests) {
    Write-Host "  - $TestFile"
  }
}

# Exit with appropriate code
if ($Failed -gt 0) {
  Write-Host "Some tests failed. Please fix the issues and try again."
  exit 1
}
else {
  Write-Host "All tests passed successfully!"
  exit 0
}
