@echo off
title Offline Translation System Launcher
color 0A

echo ====================================================
echo       Offline Translation System Launcher
echo ====================================================

:: Check for Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not found in system PATH.
    echo Please install Python to continue.
    pause
    exit /b 1
)

:: Set up virtual environment
if not exist "venv" (
    echo [*] Creating Python Virtual Environment (venv)...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
      )
    echo [✓] Virtual environment created successfully.
)

:: Activate venv
echo [*] Activating virtual environment...
call venv\Scripts\activate.bat

:: Install dependencies
echo [*] Installing/updating backend Python dependencies...
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Dependency installation failed. Please check internet connection.
    pause
    exit /b 1
)
echo [✓] Dependencies installed successfully.

:: Check models cache
set "MODELS_DIR=backend\models"
if not exist "%MODELS_DIR%" mkdir "%MODELS_DIR%"

:: Simple check if directory is empty
dir /b /a "%MODELS_DIR%" | findstr . >nul
if %errorlevel% neq 0 (
    echo [!] Warning: Offline model files not found in %MODELS_DIR%.
    set /p choice="Would you like to pre-download them now for offline deployment? (y/n): "
    if /i "%choice%"=="y" (
        echo [*] Launching offline models downloader...
        python backend\download_models.py "%MODELS_DIR%"
        if %errorlevel% neq 0 (
            echo [ERROR] Downloader exited with error. Starting server anyway...
        ) else (
            echo [✓] All models successfully pre-downloaded offline!
        )
    ) else (
        echo [*] Skipping pre-download. Server will fetch weights on-demand if online.
    )
)

:: Check for FFmpeg
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Warning: ffmpeg is not found in your system PATH.
    echo     FFmpeg is required for processing video subtitles and dubbing overlays.
    echo     Please download and install FFmpeg from https://ffmpeg.org/download.html
)

echo [✓] Initialization completed. Starting Translation Server...
echo [*] App running at: http://localhost:8000
echo [*] Press Ctrl+C to stop the server.
echo ====================================================

uvicorn app:app --app-dir backend --host 0.0.0.0 --port 8000
pause
