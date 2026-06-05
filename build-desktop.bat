@echo off
title ComicAggregator - Build Desktop App
color 0B

echo =====================================================================
echo    ComicAggregator - Bien dich va copy code vao Desktop App
echo =====================================================================
echo.

:: 1. Build Angular frontend
echo [*] Dang bien dich Angular frontend...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERR] Bien dich Angular that bai!
    pause
    exit /b %ERRORLEVEL%
)
cd ..

:: 2. Copy compiled files to Neutralino resources
echo [*] Dang copy tai nguyen vao Neutralino resources...
xcopy /y /e /q "frontend\dist\frontend\browser\*" "desktop\comic-aggregator\resources\"

:: 3. Tat tien trinh cu neu co
taskkill /f /im comic-aggregator-win_x64.exe /t 2>nul

:: 4. Xoa resources.neu neu co de khoi chay truc tiep tu thu muc resources
del /q "desktop\comic-aggregator\resources.neu" 2>nul

:: 5. Chay app
echo [+] Dang khoi chay ung dung Desktop...
cd desktop/comic-aggregator
start "" comic-aggregator-win_x64.exe
cd ../..

echo.
echo [!] Hoan tat! Ung dung Desktop da duoc bat voi ma nguon moi nhat.
echo.
timeout /t 3
exit
