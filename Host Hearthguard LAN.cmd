@echo off
setlocal
cd /d "%~dp0"
title Hearthguard - Local Wi-Fi host
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 24 or newer, then run this launcher again.
 pause
 exit /b 1
)
if not exist node_modules call npm ci
if errorlevel 1 goto failed
if not exist dist\index.html call npm run build
if errorlevel 1 goto failed
set HOST=0.0.0.0
set PORT=5190
echo Open one of the Local Wi-Fi addresses below on this computer and your friends' devices.
echo Choose the adapter connected to your Wi-Fi. Do not share localhost with friends.
echo Allow Node.js on your private network if Windows Firewall asks.
echo Leave this window open. Press Ctrl+C to save active rounds and stop.
node dist-server\index.mjs
exit /b
:failed
echo Hearthguard could not install or build. Read the error above.
pause
