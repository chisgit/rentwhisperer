#!/usr/bin/env pwsh
# Script to restart the RentWhisperer backend and frontend services

Write-Host "Restarting RentWhisperer services..." -ForegroundColor Cyan

# Function to check if a port is in use
function Test-PortInUse {
    param($port)
    $inUse = $false
    $connections = netstat -ano | findstr ":$port"
    if ($connections) {
        $inUse = $true
    }
    return $inUse
}

# Kill any processes using the backend port (3000)
if (Test-PortInUse 3000) {
    Write-Host "Stopping backend service on port 3000..." -ForegroundColor Yellow
    $processesUsingPort = netstat -ano | findstr ":3000" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique
    foreach ($pid in $processesUsingPort) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped process $pid using port 3000" -ForegroundColor Green
        } catch {
            Write-Host "Failed to stop process $pid" -ForegroundColor Red
        }
    }
}

# Kill any processes using the frontend port (5173)
if (Test-PortInUse 5173) {
    Write-Host "Stopping frontend service on port 5173..." -ForegroundColor Yellow
    $processesUsingPort = netstat -ano | findstr ":5173" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique
    foreach ($pid in $processesUsingPort) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped process $pid using port 5173" -ForegroundColor Green
        } catch {
            Write-Host "Failed to stop process $pid" -ForegroundColor Red
        }
    }
}

# Start backend server
Write-Host "`nStarting backend server..." -ForegroundColor Cyan
Start-Process -FilePath "powershell" -ArgumentList "-Command cd '$PSScriptRoot\packages\backend' ; npm run dev" -NoNewWindow

# Wait a few seconds for the backend to initialize
Write-Host "Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start frontend server
Write-Host "`nStarting frontend server..." -ForegroundColor Cyan
Start-Process -FilePath "powershell" -ArgumentList "-Command cd '$PSScriptRoot\packages\web' ; npm run dev" -NoNewWindow

Write-Host "`nServices are restarting. Check the terminal windows for status." -ForegroundColor Green
Write-Host "Backend will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend will be available at: http://localhost:5173" -ForegroundColor Cyan
