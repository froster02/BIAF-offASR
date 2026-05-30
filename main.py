import uvicorn
import os
import sys
import multiprocessing

# Add backend to path so imports work
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from backend.app import app

if __name__ == "__main__":
    # Required for PyInstaller on Windows
    multiprocessing.freeze_support()
    
    # Run the app
    print("Starting BAIF Offline Translation Portal...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
