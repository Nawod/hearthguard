@echo off
setlocal
cd /d "%~dp0"
title Hearthguard - Local game
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
set HOST=127.0.0.1
set PORT=5190
start "" "http://localhost:5190"
echo Leave this window open while playing. Press Ctrl+C to stop the server.
node dist-server\index.mjs
exit /b
:failed
echo Hearthguard could not install or build. Read the error above.
pause
