$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExePath = Join-Path $ScriptDir "src-tauri\target\release\tauri-app.exe"

Write-Host "Starting SimpleQuestHelper Desktop Client..." -ForegroundColor Cyan

if (-not (Test-Path $ExePath)) {
    Write-Host "[INFO] Release binary not found. Building desktop client, please wait..." -ForegroundColor Yellow
    Set-Location $ScriptDir
    npx tauri build --no-bundle
}

Start-Process $ExePath
Write-Host "[OK] SimpleQuestHelper launched successfully!" -ForegroundColor Green
