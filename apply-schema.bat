@echo off
echo ======================================================
echo RentWhisperer - Apply Database Schema with JS Client
echo ======================================================
echo.

REM Change to the scripts directory
cd %~dp0\packages\backend\src\scripts

REM Run the update-schema-and-test.js script
echo Applying schema with JavaScript client...
echo.
node apply-schema-js.js

echo.
echo If successful, please restart your backend server.
echo.
pause
