#!/bin/bash

# Color styles for terminal feedback
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}      Offline Translation System Launcher  ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[✗] Python3 is not installed. Please install Python3 to continue.${NC}"
    exit 1
fi

# Set up virtual environment
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}[*] Creating Python Virtual Environment (venv)...${NC}"
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}[✗] Failed to create virtual environment.${NC}"
        exit 1
    fi
    echo -e "${GREEN}[✓] Virtual environment created successfully.${NC}"
fi

# Activate venv
echo -e "${BLUE}[*] Activating virtual environment...${NC}"
source venv/bin/activate

# Install dependencies
echo -e "${BLUE}[*] Installing/updating backend Python dependencies...${NC}"
pip install --upgrade pip
pip install -r backend/requirements.txt
if [ $? -ne 0 ]; then
    echo -e "${RED}[✗] Dependency installation failed. Please check your internet connection.${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Dependencies installed successfully.${NC}"

# Check models cache
MODELS_DIR="backend/models"
if [ ! -d "$MODELS_DIR" ] || [ -z "$(ls -A "$MODELS_DIR")" ]; then
    echo -e "${YELLOW}[!] Warning: Offline model files not found in $MODELS_DIR.${NC}"
    read -p "Would you like to pre-download them now for offline deployment? (y/n): " choice
    if [[ "$choice" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}[*] Launching offline models downloader...${NC}"
        python backend/download_models.py "$MODELS_DIR"
        if [ $? -ne 0 ]; then
            echo -e "${RED}[✗] Downloader exited with error. Starting server anyway...${NC}"
        else
            echo -e "${GREEN}[✓] All models successfully pre-downloaded offline!${NC}"
        fi
    else
        echo -e "${YELLOW}[*] Skipping pre-download. Server will fetch weights on-demand if online.${NC}"
    fi
fi

# Locate FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}[!] Warning: ffmpeg is not found on your system PATH.${NC}"
    echo -e "${YELLOW}    FFmpeg is required for processing video subtitles and dubbing overlays.${NC}"
    echo -e "${YELLOW}    To install: 'brew install ffmpeg' (macOS) or 'sudo apt install ffmpeg' (Linux).${NC}"
fi

echo -e "${GREEN}[✓] Initialization completed. Starting Translation Server...${NC}"
echo -e "${BLUE}[*] App running at: http://localhost:8000${NC}"
echo -e "${BLUE}[*] Press Ctrl+C to stop the server.${NC}"
echo -e "${BLUE}====================================================${NC}"

# Start Uvicorn backend (which serves the pre-built static React UI on /)
uvicorn app:app --app-dir backend --host 0.0.0.0 --port 8000

