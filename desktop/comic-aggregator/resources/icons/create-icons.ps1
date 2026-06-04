# PowerShell script to open HTML and wait for user to download icons

Write-Host "🦕 Dinosaur Icon Creator" -ForegroundColor Green
Write-Host "========================`n" -ForegroundColor Green

# Open the HTML file in default browser
$htmlPath = Join-Path $PSScriptRoot "convert-icon.html"
Start-Process $htmlPath

Write-Host "✅ Opened convert-icon.html in your browser" -ForegroundColor Cyan
Write-Host "`n📝 Instructions:" -ForegroundColor Yellow
Write-Host "  1. Click 'Download appIcon.png' button"
Write-Host "  2. Click 'Download trayIcon.png' button"
Write-Host "  3. Move downloaded files to this folder"
Write-Host "  4. Press any key to continue...`n"

# Wait for user input
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

# Check if files exist
$appIconPath = Join-Path $PSScriptRoot "appIcon.png"
$trayIconPath = Join-Path $PSScriptRoot "trayIcon.png"

if (Test-Path $appIconPath) {
    Write-Host "✅ Found appIcon.png" -ForegroundColor Green
} else {
    Write-Host "⚠️  appIcon.png not found - please download it" -ForegroundColor Yellow
}

if (Test-Path $trayIconPath) {
    Write-Host "✅ Found trayIcon.png" -ForegroundColor Green
} else {
    Write-Host "⚠️  trayIcon.png not found - please download it" -ForegroundColor Yellow
}

Write-Host "`n🎉 Icon setup complete!" -ForegroundColor Green
Write-Host "Now rebuild your desktop app to see the new icon." -ForegroundColor Cyan
