@echo off
cd /d "%~dp0"
echo Stopping any process on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    if not "%%a"=="0" "%SystemRoot%\System32\taskkill.exe" /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul
echo Starting FastAPI server (with reservations API)...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
