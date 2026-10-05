@echo off
title PenRX+ - Admin Cloud Portal
color 05

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

echo ===============================================================================
echo     PenRX+ Cloud Admin Portal
echo ===============================================================================
echo.
echo [i] Opening Admin Portal in your default browser...
echo [i] Project Directory: %CD%
echo.

if exist "%CD%\portal.html" (
    echo [i] Opening file: %CD%\portal.html
    start "" "%CD%\portal.html"
) else if exist "%CD%\public\portal.html" (
    echo [i] Opening file: %CD%\public\portal.html
    start "" "%CD%\public\portal.html"
) else (
    echo [i] Opening URL: http://localhost:3000/admin/portal
    start "" "http://localhost:3000/admin/portal"
)

echo [OK] Portal launched.
ping 127.0.0.1 -n 3 >nul
exit
