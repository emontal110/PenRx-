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
echo     PenRX+ Admin Portal Launcher
echo ===============================================================================
echo.
echo [i] Project Directory: %CD%
echo.
echo   [1] Open Cloud Portal (https://pen-rx.vercel.app/portal)
echo   [2] Open Local Portal (http://localhost:3000/portal)
echo   [3] Open Standalone Offline Portal (public\portal.html)
echo.
set /p "PORTAL_CHOICE=>> Choose portal option [Default: 1]: "

if "%PORTAL_CHOICE%"=="2" (
    echo [i] Opening Local Portal: http://localhost:3000/portal ...
    start "" "http://localhost:3000/portal"
) else if "%PORTAL_CHOICE%"=="3" (
    if exist "%CD%\public\portal.html" (
        echo [i] Opening Offline file: %CD%\public\portal.html ...
        start "" "%CD%\public\portal.html"
    ) else (
        echo [!] Standalone file not found, opening local portal ...
        start "" "http://localhost:3000/portal"
    )
) else (
    echo [i] Opening Cloud Portal: https://pen-rx.vercel.app/portal ...
    start "" "https://pen-rx.vercel.app/portal"
)

echo.
echo [OK] Portal launched successfully.
ping 127.0.0.1 -n 3 >nul
exit
