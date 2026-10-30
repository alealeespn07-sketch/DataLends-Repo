@echo off
cd /d "%~dp0"

if not exist .venv\Scripts\python.exe (
    python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt

if errorlevel 1 (
    echo Error instalando las dependencias.
    pause
    exit /b 1
)

python run.py
pause