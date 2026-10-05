@echo off
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
echo       PenRX+ - Master Release and Build Manager
echo ========================================================
echo [i] Project Directory: %CD%
echo.

set "TARGET_VER=%~1"
if "%TARGET_VER%"=="" (
    set /p "TARGET_VER=>> Enter target version (e.g. 1.3.1) or press Enter for auto-patch: "
)
if "%TARGET_VER%"=="" (
    set "TARGET_VER=patch"
)

set "NOTES=%~2"
if "%NOTES%"=="" (
    set /p "NOTES=>> Enter release notes (or press Enter for default): "
)

echo.
echo [i] Starting build and release process for: %TARGET_VER%
echo.

if "%NOTES%"=="" (
    node scripts/release-builder.js %TARGET_VER%
) else (
    node scripts/release-builder.js %TARGET_VER% "%NOTES%"
)

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
