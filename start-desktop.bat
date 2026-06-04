@echo off
title ComicAggregator - Quick Launch

:: Kill any existing java/desktop processes to free port 8080 and files
taskkill /f /im java.exe /t 2>nul
taskkill /f /im javaw.exe /t 2>nul
taskkill /f /im comic-aggregator-win_x64.exe /t 2>nul
taskkill /f /im comic-aggregator-NEW.exe /t 2>nul

:: Delete resources.neu so NeutralinoJS loads from the loose resources/ folder instead of the old packed archive
del /q "desktop\comic-aggregator\resources.neu" 2>nul

:: Launch Spring Boot Backend silently in the background
cd backend
start "" javaw -Djava.net.preferIPv4Stack=true -jar build/libs/demo-0.0.1-SNAPSHOT.jar
cd ..

:: Launch Desktop App
cd desktop/comic-aggregator
start "" comic-aggregator-win_x64.exe

:: Exit launcher terminal immediately
exit
