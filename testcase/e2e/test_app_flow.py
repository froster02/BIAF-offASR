import time
import subprocess
import os
import signal
from playwright.sync_api import sync_playwright

def test_full_app_flow():
    # 1. Start backend
    backend_env = os.environ.copy()
    backend_env["CI_MODE"] = "true"
    
    python_path = "./venv/bin/python3" if os.path.exists("./venv/bin/python3") else "python3"
    
    backend_proc = subprocess.Popen(
        [python_path, "backend/app.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid,
        env=backend_env
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
            page.wait_for_selector("text=Offline Node Status", timeout=10000)
            assert "Offline Node Status" in page.content()
            
            # Navigate to Text Translate
            print("Checking Text Translate...")
            page.click("text=Text Translate")
            page.wait_for_selector("textarea", timeout=5000)
            
            # Perform a translation
            print("Testing translation UI...")
            page.fill("textarea", "Hello world")
            page.click("button:has-text('Translate Text')")
            
            # Wait for result to appear
            print("Waiting for translation result...")
            page.wait_for_selector("text=[CI MOCK]", timeout=10000)
            
            browser.close()
            
    finally:
        # Cleanup processes
        os.killpg(os.getpgid(backend_proc.pid), signal.SIGTERM)
        os.killpg(os.getpgid(frontend_proc.pid), signal.SIGTERM)
        print("Servers stopped.")

if __name__ == "__main__":
    test_full_app_flow()
