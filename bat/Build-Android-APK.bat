@echo off
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

if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Android\Android Studio\jbr" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    if exist "C:\Program Files\Android\Android Studio\jre" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jre"
    if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr" set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
    if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    if exist "C:\Program Files\Java\jdk-17" set "JAVA_HOME=C:\Program Files\Java\jdk-17"
    if exist "C:\Program Files\Java\jdk-21" set "JAVA_HOME=C:\Program Files\Java\jdk-21"
    if exist "C:\Program Files\Eclipse Adoptium\jdk-17" set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17"
    if exist "C:\Program Files\Eclipse Adoptium\jdk-21" set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21"
    if exist "C:\Program Files\Microsoft\jdk-17" set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17"
    if exist "C:\Program Files\Microsoft\jdk-21" set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21"
)

if not "%JAVA_HOME%"=="" (
    echo [INFO] Detected Java at: %JAVA_HOME%
    set "PATH=%JAVA_HOME%\bin;%PATH%"
) else (
    echo [WARNING] JAVA_HOME is not set. If build fails, install Android Studio or Java JDK 17+.
)

echo.
echo 1. Building Web App Production Bundle...
call npm run build

echo.
echo 2. Syncing Capacitor Android Assets...
if not exist "out" mkdir "out"
if not exist "out\index.html" (
    if exist "docs\index.html" (
        copy /Y "docs\index.html" "out\index.html" >nul 2>&1
    ) else (
        echo ^<!DOCTYPE html^>^<html^>^<head^>^<meta charset="utf-8"^>^<title^>PenRX+^</title^>^</head^>^<body^>PenRX+ Mobile^</body^>^</html^> > "out\index.html"
    )
)
call npx cap sync android

echo.
echo 3. Compiling Real Android APK via Gradle...
cd android
if exist "gradlew.bat" (
    call gradlew.bat assembleDebug
) else (
    call gradlew assembleDebug
)
cd /d "%PROJECT_ROOT%"

echo.
echo 4. Deploying APK file to public downloads folder...
if not exist "public\downloads" mkdir "public\downloads"
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\PenRX+.apk"
    echo.
    echo =========================================================
    echo [SUCCESS] Real Android APK compiled and deployed to:
    echo    - %CD%\public\downloads\PenRX+.apk
    echo    - %CD%\android\app\build\outputs\apk\debug\app-debug.apk
    echo =========================================================
    start "" explorer "%CD%\public\downloads"
) else (
    echo.
    echo [NOTE] To build APK via Android Studio GUI:
    echo    run Open-Android-Studio.bat or execute npx cap open android
    echo    then click Build - Build Bundle - Build APK.
)

echo.
pause
