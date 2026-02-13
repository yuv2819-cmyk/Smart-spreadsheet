@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo Smart Spreadsheet Launcher
echo ==========================

if not exist "%ROOT%frontend\package.json" (
  echo [ERROR] frontend\package.json not found.
  goto :fail
)

if not exist "%ROOT%backend\app\main.py" (
  echo [ERROR] backend app entrypoint not found.
  goto :fail
)

set "BACKEND_PY=%ROOT%backend\venv\Scripts\python.exe"
if not exist "%BACKEND_PY%" (
  for /f "delims=" %%P in ('where python 2^>nul') do (
    set "BACKEND_PY=%%P"
    goto :python_found
  )
  echo [ERROR] Python not found. Create backend\venv or add Python to PATH.
  goto :fail
)

:python_found
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js 18+ and try again.
  goto :fail
)

call :is_port_open 8000
if "!PORT_OPEN!"=="1" (
  echo [OK] Backend already running on port 8000.
) else (
  echo [..] Starting backend on port 8000...
  start "Smart Spreadsheet Backend" cmd /k "cd /d ""%ROOT%backend"" && ""%BACKEND_PY%"" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
)

call :is_port_open 3000
if "!PORT_OPEN!"=="1" (
  echo [OK] Frontend already running on port 3000.
) else (
  echo [..] Starting frontend on port 3000...
  start "Smart Spreadsheet Frontend" cmd /k "cd /d ""%ROOT%frontend"" && npm run dev"
)

echo [..] Waiting for frontend startup...
set /a RETRIES=40
:wait_frontend
call :is_port_open 3000
if "!PORT_OPEN!"=="1" goto :open_browser
set /a RETRIES-=1
if !RETRIES! LEQ 0 goto :open_browser
timeout /t 1 /nobreak >nul
goto :wait_frontend

:open_browser
echo [OK] Opening http://localhost:3000
start "" "http://localhost:3000"
goto :done

:is_port_open
set "PORT_OPEN=0"
for /f "tokens=5" %%A in ('netstat -ano ^| findstr /r /c:":%~1 .*LISTENING"') do (
  set "PORT_OPEN=1"
  goto :eof
)
goto :eof

:fail
echo.
echo Launcher failed. Fix the error above and run index.bat again.
pause
exit /b 1

:done
echo.
echo Launcher finished.
exit /b 0
