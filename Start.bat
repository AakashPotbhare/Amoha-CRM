@echo off
title Amoha Pathfinder — Launcher
color 0A

echo.
echo  ==========================================
echo   Amoha Pathfinder — Starting Services
echo  ==========================================
echo.

:: ── 1. Start MySQL ────────────────────────────────────────────────────────────
echo [1/3] Starting MySQL...
net start MySQL >nul 2>&1
if %errorlevel%==0 (
    echo       MySQL started successfully.
) else (
    echo       MySQL already running or failed. Continuing...
)

:: ── 2. Start Backend ──────────────────────────────────────────────────────────
echo [2/3] Starting Backend  (port 4000)...
start "Amoha Backend" cmd /k "cd /d "%~dp0backend" && node src/app.js"
timeout /t 3 /nobreak >nul

:: ── 3. Start Frontend ─────────────────────────────────────────────────────────
echo [3/3] Starting Frontend (port 5173)...
start "Amoha Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 4 /nobreak >nul

:: ── 4. Open Browser ───────────────────────────────────────────────────────────
echo.
echo  ==========================================
echo   Opening http://localhost:5173
echo  ==========================================
echo.
start "" "http://localhost:5173"

echo  Both servers are running in their own windows.
echo  Close those windows to stop the servers.
echo.
pause
