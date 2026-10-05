@echo off
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

call npm run electron:build

echo.
echo ========================================================
echo  Installer output is located in: %CD%\dist-electron\
echo ========================================================
echo.

if exist "%CD%\dist-electron" (
    start "" explorer "%CD%\dist-electron"
)

pause
