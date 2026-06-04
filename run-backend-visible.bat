@echo off
title ComicAggregator - Debug Backend
cd backend
java -Djava.net.preferIPv4Stack=true -jar build/libs/demo-0.0.1-SNAPSHOT.jar
pause
