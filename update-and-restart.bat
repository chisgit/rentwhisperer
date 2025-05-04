@echo off
echo ======================================================
echo RentWhisperer - Database Update and Server Restart
echo ======================================================
echo.

REM Change to the scripts directory
cd %~dp0packages\backend\src\scripts

REM Step 1: Apply schema updates using JavaScript client (no psql dependency)
echo [1/3] Applying database schema with JavaScript client...
echo.
node apply-schema-js.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Schema update failed! Fix any errors before continuing.
    echo.
    pause
    exit /b 1
)

REM Step 2: Test the connection
echo.
echo [2/3] Testing Supabase connection...
echo.
node enhanced-connection-test.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Connection test failed! Fix any errors before continuing.
    echo.
    pause
    exit /b 1
)

REM Step 3: Restart backend server
echo.
echo [3/3] Restarting backend server...
echo.

REM Kill any existing node processes running the backend server
taskkill /f /im node.exe /fi "WINDOWTITLE eq *RentWhisperer Backend*" > nul 2>&1

REM Change to the backend directory
cd %~dp0packages\backend

REM Start the backend server in a new window
start "RentWhisperer Backend" cmd /c "npm run dev"

echo.
echo ✅ Database updated and backend server restarted successfully!
echo.

pause
