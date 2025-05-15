#Requires -Version 5.0

<#
.SYNOPSIS
    Fixes tenant-unit relationships in the RentWhisperer database.

.DESCRIPTION
    This script runs a Node.js utility that ensures all tenant-unit relationships 
    have correct rent_amount and rent_due_day values in the tenant_units junction table.

.EXAMPLE
    .\Fix-TenantUnits.ps1
#>

$ErrorActionPreference = "Stop"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendPath = $ScriptPath
$NodeScript = Join-Path $BackendPath "src\scripts\apply-tenant-fixes.js"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Display script header
Write-ColorOutput Green "====================================="
Write-ColorOutput Green " RentWhisperer - Tenant Units Fixer"
Write-ColorOutput Green "====================================="
Write-ColorOutput Yellow "`nThis script will fix tenant-unit relationships in the database."

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-ColorOutput Cyan "`nNode.js version: $nodeVersion"
}
catch {
    Write-ColorOutput Red "Error: Node.js is not installed or not in the PATH."
    Write-ColorOutput Red "Please install Node.js and try again."
    exit 1
}

# Check if script file exists
if (-not (Test-Path $NodeScript)) {
    Write-ColorOutput Red "Error: Script file not found at: $NodeScript"
    exit 1
}

# Run the Node.js script
Write-ColorOutput Cyan "`nRunning tenant-unit fixer...`n"
try {
    Push-Location $BackendPath
    node $NodeScript
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput Red "Error: Script exited with code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}
catch {
    Write-ColorOutput Red "Error executing Node script: $_"
    exit 1
}
finally {
    Pop-Location
}

Write-ColorOutput Green "`nTenant-unit relationships fix completed successfully!"
Write-ColorOutput Yellow "You may need to restart your backend services for changes to take effect."
