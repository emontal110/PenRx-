@echo off
echo ========================================================
echo       🔨 Building PenRX+ Windows Installer (.exe)
echo ========================================================
echo.
cd /d "%~dp0"
call npm run electron:build
echo.
echo ========================================================
echo  Installer output is located in: dist-electron/
echo ========================================================
pause
