@echo off
chcp 65001 >nul
title PenRX+ - Release and Build Manager
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
echo       PenRX+ - Automated Master Release and Build
echo ========================================================
echo [i] Project Directory: %CD%
echo [i] Starting automated build and release immediately...
echo.

set "TARGET_VER=%~1"
if "%TARGET_VER%"=="" (
    set "TARGET_VER=patch"
)

set "NOTES=%~2"
if "%NOTES%"=="" (
    set "NOTES=تحديث وإصدار تلقائي لمنظومة PenRX+ الطبية"
)

echo [i] Target Version Mode: %TARGET_VER%
echo [i] Release Notes: %NOTES%
echo.

node scripts/release-builder.js %TARGET_VER% "%NOTES%"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Process failed with error code %errorlevel%
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo [SUCCESS] Release and Build completed successfully!
echo ========================================================
echo.

if exist "releases" (
    start "" explorer "releases"
)

pause
exit /b 0
