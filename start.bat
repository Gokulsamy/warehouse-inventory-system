@echo off
title Invento-AI Startup Utility
echo ===================================================
echo   INVENTO-AI: WAREHOUSE STOCK AND RACK MANAGER
echo ===================================================
echo.

REM Configure PATH to use the workspace's local Node.js installation
set PATH=c:\Users\gokulanand\OneDrive\Desktop\Antigravity\2026\2026\node\node-v20.18.1-win-x64;%PATH%

echo [1/2] Launching Python FastAPI Backend Server on port 8000...
start "Invento-AI Backend (FastAPI)" cmd /k "cd backend && venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"

echo [2/2] Launching React Frontend Dev Server...
start "Invento-AI Frontend (Vite)" cmd /k "cd frontend && npm run dev"

echo.
echo Waiting 3 seconds for servers to initialize...
timeout /t 3 /nobreak > nul
echo Opening in Chrome browser...
start chrome http://localhost:5173

echo.
echo ===================================================
echo   System running. Press any key to exit this script.
echo ===================================================
pause > null
