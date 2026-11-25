@echo off
chcp 65001 >nul
cd /d "%~dp0"
set MEDIA_ROOT=D:\02. Tiếng Nhật\luyennoi
set NODE_ENV=production
echo Starting Kaiwa Shadowing Studio...
echo Media folder: %MEDIA_ROOT%
if not exist "dist\index.html" (
  echo Building frontend for first run...
  call npm run build
)
start "" http://localhost:3100
node server/index.mjs
pause
