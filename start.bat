@echo off
title Macha Express Launcher
echo =======================================================
echo  Launching Macha Express (Fish Delivery App)
echo  Location: Balasore, Odisha
echo =======================================================
echo.
echo [1/2] Starting backend API server (Port 5000)...
start "Macha Express Backend" cmd /k "cd backend && npm run start"

echo [2/2] Starting React frontend dev server (Port 5173)...
start "Macha Express Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo =======================================================
echo  Servers launched successfully!
echo   - Frontend: http://localhost:5173
echo   - Backend:  http://localhost:5000/health
echo =======================================================
echo.
pause
