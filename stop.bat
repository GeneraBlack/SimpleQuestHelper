@echo off
echo Stopping SimpleQuestHelper Desktop Client...
taskkill /F /IM tauri-app.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] SimpleQuestHelper was stopped successfully.
) else (
    echo [INFO] SimpleQuestHelper is not currently running.
)
