@echo off
title ComicAggregator - Build and Launch
color 0D

echo =====================================================================
echo    ComicAggregator - Bien dich va Khoi chay ung dung
echo =====================================================================
echo.

:: Kill any existing java/desktop processes to free port 8080 and files
taskkill /f /im java.exe /t 2>nul
taskkill /f /im javaw.exe /t 2>nul
taskkill /f /im comic-aggregator-win_x64.exe /t 2>nul
taskkill /f /im comic-aggregator-NEW.exe /t 2>nul

:: Delete resources.neu so NeutralinoJS loads from the loose resources/ folder instead of the old packed archive
del /q "desktop\comic-aggregator\resources.neu" 2>nul

:: Build frontend
echo [*] Buoc 1/3: Dang bien dich Frontend Angular...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERR] Build frontend that bai!
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..

:: Clean and Copy assets
echo [*] Buoc 2/3: Dang cap nhat code vao Desktop resources...
del /q "desktop\comic-aggregator\resources\*.js" 2>nul
del /q "desktop\comic-aggregator\resources\*.css" 2>nul
del /q "desktop\comic-aggregator\resources\*.ico" 2>nul
del /q "desktop\comic-aggregator\resources\index.html" 2>nul
xcopy /s /e /y "frontend\dist\frontend\browser\*" "desktop\comic-aggregator\resources\" >nul

:: Build backend jar
echo [*] Buoc 3/3: Dang dong goi Backend Spring Boot...
cd backend
call .\gradlew bootJar >nul
cd ..

:: Launch Backend hidden with correct WorkingDirectory
echo [+] Dang khoi chay Backend running ngam...
cd backend
start "" javaw -Djava.net.preferIPv4Stack=true -jar build/libs/demo-0.0.1-SNAPSHOT.jar
cd ..

:: Launch Desktop app
echo [+] Dang mo ung dung Desktop...
cd desktop/comic-aggregator
start "" comic-aggregator-win_x64.exe

:: Exit launcher terminal
exit
