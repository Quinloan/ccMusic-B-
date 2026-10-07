@echo off
rem ccMusic dev launcher - ASCII only, CRLF line endings (do not convert)
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron is not installed. Run: npm install
  pause
  exit /b 1
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
