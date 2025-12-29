REM Gemini App - Desktop Launcher
@echo off
title Gemini App - Metal Price Editor
echo Starting Gemini App in Desktop Mode...
echo.

cd backend
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
)

if not exist "prisma\dev.db" (
    echo Setting up local database...
    call npx prisma migrate dev --name init
)

echo Starting Backend Server...
start "Gemini Backend" /min cmd /k "npm run dev"

cd ..\frontend
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)

echo Starting Frontend Interface...
echo.
echo Application will open in your browser shortly...
echo.
echo DO NOT CLOSE THIS WINDOW while using the app.
echo.
start "Gemini Frontend" /min cmd /k "npm run dev"

timeout /t 10 >nul
start http://localhost:5173

pause
