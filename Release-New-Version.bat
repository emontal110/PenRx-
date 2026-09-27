@echo off
chcp 65001 >nul
title PenRX+ | معالج إطلاق وتحديث الإصدارات الرسمي
color 0B

echo.
echo ===============================================================================
echo        🚀 منظومة PenRX+ الطبية الذكية - معالج الإصدار والتحديث التلقائي 🚀
echo ===============================================================================
echo.
echo  يقوم هذا المعالج التلقائي بالعمليات التالية:
echo   1. تحديث رقم الإصدار (Version) تلقائياً في شارة البرنامج وجميع ملفات الإعداد
echo   2. بناء واجهات وقواعد بيانات البرنامج (Next.js & Prisma Production Build)
echo   3. توليد وتغليف برنامج سطح المكتب للكمبيوتر (Windows .exe) في مجلد releases
echo   4. مزامنة وتجهيز تطبيق الهاتف (Android APK) في مجلد releases
echo   5. رفع وتحديث المشروع تلقائياً على GitHub المستودع:
echo      https://github.com/emontal110/PenRx-.git
echo   6. تفعيل التحديث التلقائي ليظهر إشعار فوري لجميع الأجهزة المشتركة
echo.
echo ===============================================================================
echo.

setlocal enabledelayedexpansion

:: Read current version
for /f "tokens=2 delims=:, " %%a in ('findstr "\"version\"" src\config\version.json') do (
    set "CURRENT_VER=%%~a"
)
echo  [i] الإصدار الحالي للنظام هو: v!CURRENT_VER!
echo.

:: Accept command line argument or prompt user
set "INPUT_VER=%1"
if "!INPUT_VER!"=="" (
    set /p "INPUT_VER=>> أدخل رقم الإصدار الجديد (مثال 1.0.1 أو اضغط Enter للترقية التلقائية): "
)

if "!INPUT_VER!"=="" (
    set "INPUT_VER=patch"
)

set "INPUT_NOTES=%2"
if "!INPUT_NOTES!"=="" (
    set /p "INPUT_NOTES=>> أدخل تفاصيل وميزات التحديث (أو اضغط Enter للوصف الافتراضي): "
)

if "!INPUT_NOTES!"=="" (
    set "INPUT_NOTES=تحديث دوري يتضمن تحسينات في السرعة ومحرك البحث الدوائي وتعدد الأجهزة"
)

echo.
echo -------------------------------------------------------------------------------
echo  [⏳] جارٍ بدء عملية المعالجة، الرجاء الانتظار حتى اكتمال كافة الخطوات...
echo -------------------------------------------------------------------------------
echo.

node scripts/release-builder.js !INPUT_VER! "!INPUT_NOTES!"

if %errorlevel% neq 0 (
    echo.
    echo [X] حدث خطأ أو تنبيه أثناء المعالجة. يرجى مراجعة الرسائل أعلاه.
    pause
    exit /b %errorlevel%
)

echo.
echo ===============================================================================
echo  ✅ تم الانتهاء بنجاح تام!
echo  📁 يتم الآن فتح مجلد الإصدارات releases للاطلاع على البرامج المولدة...
echo ===============================================================================
echo.

if exist "releases" (
    start "" explorer "releases"
)

pause
