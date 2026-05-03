@echo off
echo ==================================
echo  Codex Relay - Build Portable EXE
echo ==================================
echo.
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause & exit /b 1
)
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
    echo [1/3] Installing dependencies...
    call npm install
)
echo [2/3] Building portable EXE...
call npx electron-builder --win portable
if %errorlevel% neq 0 (
    echo [FALLBACK] Using unpacked directory...
    call npx electron-builder --dir
    echo Portable app in: dist\win-unpacked\
) else (
    echo [3/3] Done^^! EXE: dist\Codex-Relay-v1.0.0.exe
)
pause
