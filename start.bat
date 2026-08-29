@echo off
echo Starting SimpleQuestHelper Desktop Client...
set "EXE_PATH=%~dp0src-tauri\target\release\tauri-app.exe"

if not exist "%EXE_PATH%" (
    echo [INFO] Release binary not found. Building desktop client, please wait...
    cd /d "%~dp0"
    call npx tauri build --no-bundle
)

start "" "%EXE_PATH%"
echo [OK] SimpleQuestHelper started successfully!
