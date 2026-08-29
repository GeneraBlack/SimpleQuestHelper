@echo off
title SimpleQuestHelper - Debug Console
echo =======================================================
echo   SimpleQuestHelper Desktop Client (Debug Mode)
echo =======================================================
echo.
set "EXE_PATH=%~dp0src-tauri\target\release\tauri-app.exe"

if not exist "%EXE_PATH%" (
    echo [INFO] Release binary not found. Building desktop client, please wait...
    cd /d "%~dp0"
    call npx tauri build --no-bundle
)

echo [INFO] Starting SimpleQuestHelper with live terminal console...
echo [INFO] Logs are also saved to: simplequesthelper.log
echo.

"%EXE_PATH%"

echo.
echo [INFO] SimpleQuestHelper process exited.
pause
