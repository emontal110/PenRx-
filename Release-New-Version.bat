@echo off
chcp 65001 >nul
set "PYTHONIOENCODING=utf-8"
title PenRX+ - Automated Master Release & Build Manager
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
echo  ==============================================================
echo   🌟 منظومة PenRX+ الطبية - معالج البناء والإصدار التلقائي الشامل
echo  ==============================================================
echo   [i] مسار المنظومة: %CD%
echo   [i] جاري بدء كافة مراحل البناء والإصدار والدفع السحابي فوراً...
echo  ==============================================================
echo.

set "TARGET_VER=%~1"
if "%TARGET_VER%"=="" (
    set "TARGET_VER=patch"
)

set "NOTES=%~2"
if "%NOTES%"=="" (
    set "NOTES=تحديث وإصدار تلقائي لمنظومة PenRX+ الطبية"
)

node scripts/release-builder.js %TARGET_VER% "%NOTES%"

if %errorlevel% neq 0 (
    echo.
    echo  ==============================================================
    echo   ❌ حدث خطأ أو توقف أثناء البناء. كود الخطأ: %errorlevel%
    echo  ==============================================================
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo  ==============================================================
echo   ✅ اكتملت كافة مراحل البناء والتغليف والرفع على GitHub بنجاح!
echo  ==============================================================
echo.

if exist "releases" (
    start "" explorer "releases"
)

pause
exit /b 0
