@echo off
REM Script to restart the RentWhisperer services
echo ======================================================
echo RentWhisperer - Restarting Services
echo ======================================================
echo.

REM Execute the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0restart-services.ps1"

echo.
pause
