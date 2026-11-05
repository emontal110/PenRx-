@echo off
chcp 65001 >nul
title PenRX+ - Android APK Builder
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

echo =========================================================
echo       PenRX+ - Android APK Local Builder
echo =========================================================
echo.
echo [i] Project Directory: %CD%

REM Always detect ANDROID_HOME independently of JAVA_HOME
if "%ANDROID_HOME%"=="" (
    if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)

if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    ) else if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr" (
        set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
    ) else if exist "C:\Program Files\Android\Android Studio\jre" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jre"
    ) else if exist "C:\Program Files\Eclipse Adoptium\jdk-21" (
        set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21"
    ) else if exist "C:\Program Files\Eclipse Adoptium\jdk-17" (
        set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17"
    ) else if exist "C:\Program Files\Java\jdk-21" (
        set "JAVA_HOME=C:\Program Files\Java\jdk-21"
    ) else if exist "C:\Program Files\Java\jdk-17" (
        set "JAVA_HOME=C:\Program Files\Java\jdk-17"
    ) else if exist "C:\Program Files\Microsoft\jdk-21" (
        set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21"
    ) else if exist "C:\Program Files\Microsoft\jdk-17" (
        set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17"
    )
)

if not "%JAVA_HOME%"=="" (
    echo [INFO] Detected Java at: %JAVA_HOME%
    set "PATH=%JAVA_HOME%\bin;%PATH%"
) else (
    echo [WARNING] JAVA_HOME is not set. If build fails, install Android Studio or Java JDK 17+.
)

echo.
echo 1. Preparing Capacitor Android Web Assets...
if not exist "out" mkdir "out"
if exist "public\error.html" copy /Y "public\error.html" "out\error.html" >nul 2>&1
if exist "public\logo-penrx.jpg" copy /Y "public\logo-penrx.jpg" "out\logo-penrx.jpg" >nul 2>&1
if exist "public\favicon.ico" copy /Y "public\favicon.ico" "out\favicon.ico" >nul 2>&1
if exist "public\icon-192.png" copy /Y "public\icon-192.png" "out\icon-192.png" >nul 2>&1
if exist "public\icon-512.png" copy /Y "public\icon-512.png" "out\icon-512.png" >nul 2>&1
if exist "public\apple-touch-icon.png" copy /Y "public\apple-touch-icon.png" "out\apple-touch-icon.png" >nul 2>&1
if exist "public\mobile.html" (
    copy /Y "public\mobile.html" "out\index.html" >nul 2>&1
) else if exist "public\download.html" (
    copy /Y "public\download.html" "out\index.html" >nul 2>&1
) else if not exist "out\index.html" (
    echo ^<!DOCTYPE html^>^<html^>^<head^>^<meta charset="utf-8"^>^<title^>PenRX+^</title^>^</head^>^<body^>PenRX+ Mobile^</body^>^</html^> > "out\index.html"
)
call npx cap sync android

echo.
echo 2. Compiling Signed Release Android APK via Gradle...
cd android
if exist "gradlew.bat" (
    call gradlew.bat assembleRelease
) else (
    call gradlew assembleRelease
)
cd /d "%PROJECT_ROOT%"

echo.
echo 3. Deploying Signed Release APK to downloads & releases folders...
if not exist "public\downloads" mkdir "public\downloads"
if not exist "releases" mkdir "releases"
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    copy /Y "android\app\build\outputs\apk\release\app-release.apk" "public\downloads\PenRX+.apk" >nul
    copy /Y "android\app\build\outputs\apk\release\app-release.apk" "releases\PenRX+.apk" >nul
    echo.
    echo =========================================================
    echo [SUCCESS] Official Signed Production APK deployed to:
    echo    - %CD%\releases\PenRX+.apk
    echo    - %CD%\public\downloads\PenRX+.apk
    echo =========================================================
    start "" explorer "%CD%\releases"
) else if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\PenRX+.apk" >nul
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "releases\PenRX+.apk" >nul
    echo.
    echo =========================================================
    echo [NOTICE] Debug fallback APK deployed to:
    echo    - %CD%\releases\PenRX+.apk
    echo =========================================================
) else (
    echo.
    echo [NOTE] To build APK via Android Studio GUI:
    echo    run Open-Android-Studio.bat or execute npx cap open android
    echo    then click Build - Build Bundle(s) / APK(s) - Build APK(s).
)

echo.
pause
exit /b 0
