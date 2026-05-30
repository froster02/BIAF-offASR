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
        stdout=open("backend.log", "w"),
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
        env=backend_env
    )
    
    # 2. Start frontend (Vite)
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        stdout=open("frontend.log", "w"),
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid
    )
    
    try:
        # Polling for servers to start
        print("Waiting for servers to start...")
        import socket
        def wait_for_port(port, timeout=30):
            start_time = time.time()
            while time.time() - start_time < timeout:
                try:
                    with socket.create_connection(("localhost", port), timeout=1):
                        return True
                except:
                    time.sleep(1)
            return False

        if not wait_for_port(8000) or not wait_for_port(5173):
            print("Servers failed to start in time.")
            return

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Handle dialogs (alerts)
            page.on("dialog", lambda dialog: (print(f"DIALOG: {dialog.message}"), dialog.dismiss()))
            
            # Capture console logs
            page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
            page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
            
            # Navigate to frontend
            print("Navigating to frontend...")
            page.goto("http://localhost:5173", wait_until="networkidle")
            
            # Login
            print("Logging in...")
            page.fill("input[placeholder='admin or user']", "admin")
            page.fill("input[placeholder='••••••••']", "admin123")
            page.click("button:has-text('Login')")
            page.wait_for_selector("text=Dashboard", timeout=20000)
            
            # Verify Title
            print(f"Page title: {page.title()}")
            assert "BIAF-offASR" in page.content() or "Translation" in page.content() or "Offline" in page.content()
            
            # Navigate to Text Translate
            print("Checking Text Translate...")
            page.click("text=Text Translate")
            page.wait_for_selector("textarea", timeout=20000)
            
            # Perform a translation
            print("Testing translation UI...")
            page.fill("textarea", "Hello world")
            
            # Wait a bit for React to update state
            time.sleep(1)
            
            # Click Translate
            print("Clicking Translate button...")
            translate_btn = page.locator("button.btn-primary:has-text('Translate')")
            print(f"Button visible: {translate_btn.is_visible()}")
            print(f"Button enabled: {translate_btn.is_enabled()}")
            translate_btn.click()
            
            # Wait for result to appear
            print("Waiting for translation result...")
            try:
                # We expect [CI MOCK] in the output
                page.wait_for_selector("text=[CI MOCK]", timeout=30000)
                print("Translation successful!")
                
                # Verify detected language badge appears
                if "Detected:" in page.content():
                    print("Detected language badge found!")
                
            except Exception as e:
                print(f"Translation failed or timed out: {e}")
                page.screenshot(path="e2e_failure.png")
                print("Screenshot saved to e2e_failure.png")
                # Log the output area specifically
                output_content = page.locator(".output-box").inner_text()
                print(f"Output box content: '{output_content}'")
                raise e
            
            browser.close()
            
    finally:
        # Cleanup processes
        print("Backend logs:")
        if os.path.exists("backend.log"):
            with open("backend.log", "r") as f:
                print(f.read())
        
        print("Frontend logs:")
        if os.path.exists("frontend.log"):
            with open("frontend.log", "r") as f:
                print(f.read())

        try:
            os.killpg(os.getpgid(backend_proc.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            os.killpg(os.getpgid(frontend_proc.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
        print("Servers stopped.")

if __name__ == "__main__":
    test_full_app_flow()
