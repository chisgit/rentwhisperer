@echo off
echo ======================================================
echo RentWhisperer - Database Schema Update and Connection Test
echo ======================================================
echo.

REM Change to the scripts directory
cd %~dp0packages\backend\src\scripts

REM Run the JavaScript-based schema update script directly (no psql dependencies)
echo Running JavaScript-based schema update...
echo.
node apply-schema-js.js

REM After successful schema update, run connection test
echo.
echo Running connection test...
echo.
node enhanced-connection-test.js

echo.
echo If successful, please restart your backend server.
echo.
pause
