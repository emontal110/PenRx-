@echo off
title PenRX+ - Medical Web Suite
color 0A

if exist "%~dp0package.json" (
    set "PROJECT_ROOT=%~dp0"
) else if exist "%~dp0..\package.json" (
    set "PROJECT_ROOT=%~dp0..\"
) else if exist "%CD%\package.json" (
    set "PROJECT_ROOT=%CD%\"
) else (
    set "PROJECT_ROOT=C:\Users\Ayman\Desktop\PenRX+\"
)

cd /d "%PROJECT_ROOT%"

echo ========================================================
echo       Starting PenRX+ Medical Web Suite
echo ========================================================
echo.
echo [i] Project Directory: %CD%
echo [i] Starting Next.js Dev Server on http://localhost:3000 ...
echo.

start "" cmd /c "ping 127.0.0.1 -n 3 >nul & start http://localhost:3000"

call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Web Server stopped with exit code %errorlevel%
)
pause
