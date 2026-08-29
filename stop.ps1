Write-Host "Stopping SimpleQuestHelper Desktop Client..." -ForegroundColor Cyan

$processes = Get-Process -Name "tauri-app" -ErrorAction SilentlyContinue

if ($processes) {
    $processes | Stop-Process -Force
    Write-Host "[OK] SimpleQuestHelper has been stopped." -ForegroundColor Green
} else {
    Write-Host "[INFO] SimpleQuestHelper is not currently running." -ForegroundColor Yellow
}
