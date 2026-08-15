@echo off
title CloudStream for iOS
cd /d "%~dp0"
echo ========================================================
echo   Starting CloudStream for iOS Engine...
echo ========================================================
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
echo Starting server...
node server/index.js
pause
