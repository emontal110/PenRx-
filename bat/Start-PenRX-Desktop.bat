@echo off
title PenRX+ - Desktop Application
color 0B

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
echo       Starting PenRX+ Desktop Application (Electron)
echo ========================================================
echo.
echo [i] Project Directory: %CD%
echo [i] Launching Electron Desktop and Next.js...
echo.

call npm run electron:dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Desktop app stopped with exit code %errorlevel%
)
pause
