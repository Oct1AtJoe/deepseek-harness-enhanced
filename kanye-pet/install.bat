@echo off
REM Kanye West Pet - one-click installer for whale-girl
REM Double-click to install, or run from command line

echo ========================================
echo   Kanye West Pet - whale-girl plugin
echo ========================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: PowerShell not found.
    echo Please run install-kanye.ps1 manually in PowerShell.
    pause
    exit /b 1
)

REM Run the PowerShell installer
powershell -ExecutionPolicy Bypass -File "%~dp0install-kanye.ps1" %*

echo.
pause
