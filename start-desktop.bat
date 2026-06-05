@echo off
title ComicAggregator - Docker Launch
color 0E

echo =====================================================================
echo    ComicAggregator - Khoi chay ung dung Desktop voi Docker
echo =====================================================================
echo.

:: 1. Tat tien trinh desktop cu dang chay neu co
taskkill /f /im comic-aggregator-win_x64.exe /t 2>nul
taskkill /f /im comic-aggregator-NEW.exe /t 2>nul

:: 2. Khoi dong Docker compose o che do ngam (Backend + DB)
echo [*] Dang kiem tra va khoi dong Docker Containers...
docker compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERR] Khong the khoi dong Docker! 
    echo [!] Vui long kiem tra xem Docker Desktop da duoc bat va dang chay chua.
    echo.
    pause
    exit /b %ERRORLEVEL%
)

:: 3. Don dep cache NeutralinoJS neu co
del /q "desktop\comic-aggregator\resources.neu" 2>nul

:: 4. Khoi chay Desktop App
echo [+] Dang khoi chay ung dung Desktop...
cd desktop/comic-aggregator
start "" comic-aggregator-win_x64.exe
cd ../..

echo.
echo [!] Khoi dong thanh cong! 
echo [!] Backend va Database dang tiep tuc chay ngam trong Docker.
echo.
timeout /t 3
exit
