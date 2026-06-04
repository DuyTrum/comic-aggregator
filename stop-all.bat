@echo off
title ComicAggregator - Stop Services
color 0C

echo =====================================================================
echo    ComicAggregator - Dung cac dich vu dang chay ngam
echo =====================================================================
echo.
echo [*] Dang dung tien trinh Java (Backend)...
taskkill /f /im java.exe /t 2>nul
taskkill /f /im javaw.exe /t 2>nul

echo [*] Dang dung tien trinh Desktop App...
taskkill /f /im comic-aggregator-win_x64.exe /t 2>nul
taskkill /f /im comic-aggregator-NEW.exe /t 2>nul

echo.
echo [!] Da dung tat ca cac dich vu hoan toan.
echo.
timeout /t 3
