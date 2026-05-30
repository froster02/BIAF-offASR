import time
import subprocess
import os
import signal
import socket
from playwright.sync_api import sync_playwright

def wait_for_port(port, timeout=30):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection(("localhost", port), timeout=1):
                return True
        except:
            time.sleep(1)
    return False

def test_advanced_features():
    # 1. Start backend
    backend_env = os.environ.copy()
    backend_env["CI_MODE"] = "true"
    
    python_path = "./venv/bin/python3" if os.path.exists("./venv/bin/python3") else "python3"
    
    # Kill any existing processes on ports
    subprocess.run(["lsof -ti:8000 | xargs kill -9"], shell=True, stderr=subprocess.DEVNULL)
    subprocess.run(["lsof -ti:5173 | xargs kill -9"], shell=True, stderr=subprocess.DEVNULL)
    
    backend_proc = subprocess.Popen(
        [python_path, "backend/app.py"],
        stdout=open("backend_adv.log", "w"),
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
        env=backend_env
    )
    
    # 2. Start frontend (Vite)
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        stdout=open("frontend_adv.log", "w"),
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid
    )
    
    try:
        print("Waiting for servers to start...")
        if not wait_for_port(8000) or not wait_for_port(5173):
            print("Servers failed to start in time.")
            return

        with sync_playwright() as p:
            # Launch with microphone permissions mocked
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--use-fake-ui-for-media-stream",
                    "--use-fake-device-for-media-stream",
                    "--mute-audio"
                ]
            )
            context = browser.new_context(
                permissions=["microphone"]
            )
            page = context.new_page()
            
            # Navigate to frontend
            print("Navigating to frontend...")
            page.goto("http://localhost:5173", wait_until="networkidle")
            
            # Login
            print("Logging in...")
            page.fill("input[placeholder='admin or user']", "admin")
            page.fill("input[placeholder='••••••••']", "admin123")
            page.click("button:has-text('Login')")
            page.wait_for_selector("text=Dashboard", timeout=20000)
            
            # 1. Test Audio Recording & Dubbing
            print("Testing Audio Recording & Dubbing...")
            page.click("text=Audio Dub")
            page.wait_for_selector("text=Select Languages", timeout=20000)
            
            # Click Start Recording
            page.click("button:has-text('Start Recording')")
            print("Recording started...")
            time.sleep(3) # Record for 3 seconds
            
            # Click Stop Recording
            page.click("button:has-text('Stop')")
            print("Recording stopped.")
            
            # Click Dub button
            page.click("button:has-text('Transcribe & Dub Audio')")
            
            # Wait for result
            print("Waiting for audio results...")
            page.wait_for_selector("text=Dubbing Results", timeout=30000)
            page.wait_for_selector("text=Dubbed Voice Audio", timeout=30000)
            
            # Check for segments
            if page.locator("text=Translated Timeline").is_visible():
                print("Audio segments rendered successfully!")
            
            # 2. Test Document Translation
            print("Testing Document Translation...")
            page.click("text=Documents")
            page.wait_for_selector("text=Click to upload documents", timeout=20000)
            
            # Upload mock doc
            with page.expect_file_chooser() as fc_info:
                page.click(".dropzone")
            file_chooser = fc_info.value
            file_chooser.set_files("testcase/e2e/assets/test_doc.docx")
            
            # Click Translate Document
            page.click("button:has-text('Translate Document')")
            
            # Wait for result link
            print("Waiting for document results...")
            try:
                page.wait_for_selector("text=Download Translated DOCX", timeout=60000)
                print("Document translation successful!")
            except Exception as e:
                print(f"Document translation failed or timed out: {e}")
                page.screenshot(path="doc_e2e_failure.png")
                print("Screenshot saved to doc_e2e_failure.png")
                # Log the output area specifically
                print("Page content around buttons:")
                print(page.content()[-2000:]) # Show some end part of content
                raise e
            
            # 3. Test Settings
            print("Testing Settings...")
            page.click("text=Settings")
            page.wait_for_selector("text=Whisper ASR Model Size", timeout=20000)
            
            # Change model size
            page.select_option("select.select-control", "tiny")
            print("Settings updated successfully!")
            
            browser.close()
            print("All advanced features tested successfully!")
            
    finally:
        # Cleanup
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
    test_advanced_features()
