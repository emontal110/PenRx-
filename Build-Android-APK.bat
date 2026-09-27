@echo off
echo =========================================================
echo       🚀 PenRX+ - Android APK Local Builder
echo =========================================================
echo.

rem Auto-detect JAVA_HOME if not set
if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Android\Android Studio\jbr" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    if exist "C:\Program Files\Android\Android Studio\jre" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jre"
    if exist "C:\Program Files\Java\jdk-17" set "JAVA_HOME=C:\Program Files\Java\jdk-17"
    if exist "C:\Program Files\Java\jdk-21" set "JAVA_HOME=C:\Program Files\Java\jdk-21"
)

if not "%JAVA_HOME%"=="" (
    echo [INFO] Detected Java at: %JAVA_HOME%
    set "PATH=%JAVA_HOME%\bin;%PATH%"
) else (
    echo [WARNING] JAVA_HOME is not set. If build fails, please install Android Studio or Java JDK 17+.
)

echo.
echo 1. Building Web App Production Bundle...
call npm run build

echo.
echo 2. Syncing Capacitor Android Assets...
call npx cap sync android

echo.
echo 3. Compiling Real Android APK via Gradle...
cd android
call gradlew assembleDebug
cd ..

echo.
echo 4. Deploying APK file to public downloads folder...
if not exist "public\downloads" mkdir "public\downloads"
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\PenRX+.apk"
    echo.
    echo =========================================================
    echo ✅ SUCCESS! Real Android APK compiled and deployed to:
    echo    - public\downloads\PenRX+.apk
    echo    - android\app\build\outputs\apk\debug\app-debug.apk
    echo =========================================================
) else (
    echo.
    echo ⚠️ Note: To build APK via Android Studio GUI,
    echo    run "Open-Android-Studio.bat" or execute "npx cap open android"
    echo    then click Build -^> Build Bundle(s) / APK(s) -^> Build APK(s).
)

echo.
pause
