@echo off
REM Gemini Desktop App - One-Click Installer (Batch version)
REM This launches the PowerShell installer

echo ======================================
echo   Gemini Desktop App - Installer
echo ======================================
echo.
echo Starting installer...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0INSTALL.ps1"

pause
