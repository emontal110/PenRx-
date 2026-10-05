@echo off
title PenRX+ - Open Android Studio
color 03

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

echo ========================================================
echo   Opening PenRX+ Android Project in Android Studio...
echo ========================================================
echo.
echo [i] Project Directory: %CD%
echo.

if not exist "out" mkdir "out"
if not exist "out\index.html" (
    if exist "docs\index.html" (
        copy /Y "docs\index.html" "out\index.html" >nul 2>&1
    ) else (
        echo ^<!DOCTYPE html^>^<html^>^<head^>^<meta charset="utf-8"^>^<title^>PenRX+^</title^>^</head^>^<body^>PenRX+ Mobile^</body^>^</html^> > "out\index.html"
    )
)

call npx cap open android
pause
