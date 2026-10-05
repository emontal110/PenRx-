@echo off
title PenRX+ - Master Control Hub
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

:MENU
cls
echo ===============================================================================
echo            PenRX+ ^| مركز الإدارة والتشغيل الشامل (Master Control Hub)
echo ===============================================================================
echo.
echo   [1] تشغيل برنامج الكمبيوتر (Electron Desktop Application)
echo   [2] تشغيل المنظومة عبر الويب والمتصفح (Next.js Web Suite)
echo   [3] فتح بورتال الإدارة والتحكم السحابي (Admin Portal)
echo.
echo   [4] بناء مثبت ويندوز للكمبيوتر (Build Windows Installer .exe)
echo   [5] بناء وتوليد تطبيق أندرويد للهاتف (Build Android APK)
echo   [6] فتح مشروع أندرويد في (Open in Android Studio)
echo.
echo   [7] إدارة ونشر إصدار سحابي جديد (Release New Version to GitHub)
echo   [8] خروج (Exit)
echo.
echo ===============================================================================
set /p "CHOICE=>> اختر رقم العملية (1 - 8): "

if "%CHOICE%"=="1" goto RUN_DESKTOP
if "%CHOICE%"=="2" goto RUN_WEB
if "%CHOICE%"=="3" goto RUN_PORTAL
if "%CHOICE%"=="4" goto BUILD_ELECTRON
if "%CHOICE%"=="5" goto BUILD_ANDROID
if "%CHOICE%"=="6" goto OPEN_STUDIO
if "%CHOICE%"=="7" goto RELEASE_VER
if "%CHOICE%"=="8" goto QUIT

echo.
echo [!] اختيار غير صحيح، يرجى كتابة رقم من 1 إلى 8.
ping 127.0.0.1 -n 2 >nul
goto MENU

:RUN_DESKTOP
call "%~dp0Start-PenRX-Desktop.bat"
goto MENU

:RUN_WEB
call "%~dp0Start-PenRX-Web.bat"
goto MENU

:RUN_PORTAL
call "%~dp0Start-Admin-Portal.bat"
goto MENU

:BUILD_ELECTRON
call "%~dp0Build-Electron-Installer.bat"
goto MENU

:BUILD_ANDROID
call "%~dp0Build-Android-APK.bat"
goto MENU

:OPEN_STUDIO
call "%~dp0Open-Android-Studio.bat"
goto MENU

:RELEASE_VER
call "%~dp0Release-New-Version.bat"
goto MENU

:QUIT
exit
