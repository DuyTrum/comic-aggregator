@echo off
title ComicAggregator Launcher
color 0B

echo =====================================================================
echo    ____                 _             _                                 _             
echo   / ___^|___  _ __ ___  (_) ___   __ _^| ^|    ___   __ _  __ _ _ __ ___  __ _  __ _  ___  _ __ 
echo  ^| ^|   / _ \^| '_ ` _ \ ^| ^|/ __^| / _` ^| ^|   / _ \ / _` ^|/ _` ^| '__/ _ \/ _` ^|/ _` ^|/ _ \^| '__^|
echo  ^| ^|__^| (_) ^| ^| ^| ^| ^| ^| ^| \__ \^| (_^| ^| ^|__^| (_) ^| (_^| ^| (_^| ^| ^| ^|  __/ (_^| ^| (_^| ^| (_) ^| ^|   
echo   \____\___/^|_^| ^|_^| ^|_^|^|_^|\___/ \__,_^|_____^|___/ \__, ^|\__, ^|_^|  \___^|\__, ^|\__,_^|\___/^|_^|   
echo                                                  ^|___/ ^|___/          ^|___/                 
echo =====================================================================
echo.
echo [*] Khoi dong cac dich vu cua ComicAggregator...
echo.

:: Launch Backend
echo [+] Dang khoi chay Spring Boot Backend o cua so moi...
start "ComicAggregator - Backend Server" cmd /k "cd backend && gradlew.bat bootRun"

:: Wait 2 seconds
timeout /t 2 /nobreak >nul

:: Launch Frontend
echo [+] Dang khoi chay Angular Frontend o cua so moi...
start "ComicAggregator - Frontend Server" cmd /k "cd frontend && npm start"

echo.
echo [!] Ca 2 dich vu da duoc khoi chay.
echo [!] Giu cac cua so lenh moi mo de duy tri dich vu.
echo [!] Backend: http://localhost:8080
echo [!] Frontend: http://localhost:4200
echo.
echo Nhan phim bat ky de dong cua so nay...
pause >nul
