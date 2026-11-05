@echo off
chcp 65001 >nul
title PenRX+ - Build Windows Installer
color 0E

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
echo       Building PenRX+ Windows Installer (.exe)
echo ========================================================
echo.
echo [i] Project Directory: %CD%
echo.

REM Close any running PenRX+.exe instance so dist-electron is not locked
taskkill /F /IM "PenRX+.exe" /T >nul 2>&1

if exist ".next\cache" rmdir /s /q ".next\cache" >nul 2>&1
if exist "dist-electron" rmdir /s /q "dist-electron" >nul 2>&1

call npm run electron:build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed with error code %errorlevel%.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo  [OK] Installer output is located in: %CD%\dist-electron\
echo ========================================================
echo.

if exist "%CD%\dist-electron" (
    start "" explorer "%CD%\dist-electron"
)

pause
exit /b 0
