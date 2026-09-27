@echo off
echo ========================================================
echo       💻 Starting PenRX+ Desktop Application (Electron)
echo ========================================================
echo.
cd /d "%~dp0"
call npm run electron:dev
pause
