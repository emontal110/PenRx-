@echo off
chcp 65001 >nul
set "PYTHONIOENCODING=utf-8"
title PenRX+ - Automated Master Release and Build Manager
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

cls
echo.
echo  ==================================================================
echo   [PenRX+] Automated Build, Packaging ^& Release Pipeline
echo  ==================================================================
echo   [*] Project Path: %CD%
echo  ==================================================================
echo.

set "TARGET_VER=%~1"
if "%TARGET_VER%"=="" (
    set "TARGET_VER=minor"
)

set "NOTES=%~2"
if "%NOTES%"=="" (
    set "NOTES=PenRX+ Official Automated Release"
)

echo   Choose Release Mode:
echo    [1] Build Locally AND Push to GitHub (main ^& gh-pages)
echo    [2] Build Locally ONLY (Do NOT push to GitHub - Default)
echo.
set "PUSH_CHOICE=2"
set /p PUSH_CHOICE="  Select option [1 or 2, default is 2]: "

if "%PUSH_CHOICE%"=="1" (
    echo.
    echo   [*] Running build WITH GitHub push enabled...
    echo.
    node scripts/release-builder.js %TARGET_VER% "%NOTES%"
) else (
    echo.
    echo   [*] Running LOCAL build ONLY (GitHub push disabled)...
    echo.
    node scripts/release-builder.js %TARGET_VER% "%NOTES%" --no-push
)

if %errorlevel% neq 0 (
    echo.
    echo  ==================================================================
    echo   [!] Build stopped or failed with error code: %errorlevel%
    echo  ==================================================================
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo  ==================================================================
echo   [OK] Build and packaging completed successfully!
echo  ==================================================================
echo.

if exist "releases" (
    start "" explorer "releases"
)

pause
exit /b 0
