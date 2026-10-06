@echo off
chcp 65001 >nul
set "PYTHONIOENCODING=utf-8"
title "PenRX+ - Automated Master Release and Build Manager"
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
echo   [PenRX+] Automated Build, Packaging ^& GitHub Release Pipeline
echo   منظومة PenRX+ الطبية - معالج البناء والإصدار السحابي التلقائي
echo  ==================================================================
echo   [*] Project Path: %CD%
echo   [*] Status: Starting automated release steps now...
echo  ==================================================================
echo.

set "TARGET_VER=%~1"
if "%TARGET_VER%"=="" (
    set "TARGET_VER=minor"
)

set "NOTES=%~2"
if "%NOTES%"=="" (
    set "NOTES=تحديث وإصدار تلقائي لمنظومة PenRX+ الطبية"
)

node scripts/release-builder.js %TARGET_VER% "%NOTES%"

if %errorlevel% neq 0 (
    echo.
    echo  ==================================================================
    echo   [!] Build stopped or failed with error code: %errorlevel%
    echo   حدث خطأ أو توقف أثناء البناء. كود الخطأ: %errorlevel%
    echo  ==================================================================
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo  ==================================================================
echo   [OK] Build, packaging, and GitHub sync completed successfully!
echo   اكتملت كافة مراحل البناء والتغليف والرفع على GitHub بنجاح!
echo  ==================================================================
echo.

if exist "releases" (
    start "" explorer "releases"
)

pause
exit /b 0
