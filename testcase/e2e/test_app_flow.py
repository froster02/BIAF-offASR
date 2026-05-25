import time
import subprocess
import os
import signal
from playwright.sync_api import sync_playwright

def test_full_app_flow():
    # 1. Start backend
    backend_proc = subprocess.Popen(
        ["./venv/bin/python3", "backend/app.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    
    # 2. Start frontend (Vite)
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    
    try:
        # Give them time to start
        print("Waiting for servers to start...")
        time.sleep(10) 
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Navigate to frontend
            print("Navigating to frontend...")
            page.goto("http://localhost:5173")
            page.wait_for_load_state("networkidle")
            
            # Verify Title
            print(f"Page title: {page.title()}")
            assert "BIAF-offASR" in page.content() or "Translation" in page.content()
            
            # Navigate to Settings
            print("Checking Settings...")
            page.click("text=Settings")
            page.wait_for_timeout(2000)
            assert "Offline Node Status" in page.content()
            
            # Navigate to Text Translate
            print("Checking Text Translate...")
            page.click("text=Text Translate")
            page.wait_for_timeout(1000)
            
            # Perform a translation
            print("Testing translation UI...")
            page.fill("textarea", "Hello world")
            page.click("button:has-text('Translate')")
            
            # Wait for result (NLLB is fast)
            page.wait_for_timeout(3000)
            # Check if result area updated (assuming it shows translated text)
            print("Translation triggered.")
            
            browser.close()
            
    finally:
        # Cleanup processes
        os.killpg(os.getpgid(backend_proc.pid), signal.SIGTERM)
        os.killpg(os.getpgid(frontend_proc.pid), signal.SIGTERM)
        print("Servers stopped.")

if __name__ == "__main__":
    test_full_app_flow()
