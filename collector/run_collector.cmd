@echo off
title DispoScan Diagnostic Collector
cd /d "%~dp0"

echo DispoScan Diagnostic Collector v3.0
echo ====================================
echo.
echo This tool auto-discovers the DispoScan Pi appliance,
echo runs comprehensive hardware diagnostics, and streams
echo results back to the appliance for review.
echo.

:: Check if running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo NOTE: Running without administrator privileges.
  echo Some diagnostics (WMI, SMART) may be limited.
  echo.
)

:: Launch the collector
echo Starting collector...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0collector.ps1"
if %errorlevel% equ 0 (
  echo.
  echo Collector finished. You may close this window.
) else (
  echo.
  echo Collector encountered errors (exit code: %errorlevel%).
)
echo.
pause
