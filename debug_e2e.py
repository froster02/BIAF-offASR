import os, signal, subprocess, time, socket
from playwright.sync_api import sync_playwright

def run():
    backend_env = os.environ.copy()
    backend_env["CI_MODE"] = "true"
    # Ensure no previous processes are running
    os.system("pkill -f 'python3 backend/app.py'")
    os.system("pkill -f 'npm run dev'")
    os.system("pkill -f 'vite'")
    
    backend_proc = subprocess.Popen(["python3", "backend/app.py"], env=backend_env, preexec_fn=os.setsid)
    frontend_proc = subprocess.Popen(["npm", "run", "dev"], cwd="frontend", preexec_fn=os.setsid)
    
    try:
        print("Waiting for servers...")
        time.sleep(15)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
            page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
            
            print("Going to localhost:5173")
            page.goto("http://localhost:5173")
            
            print("Filling login")
            page.fill("input[placeholder='admin or user']", "admin")
            page.fill("input[placeholder='••••••••']", "admin123")
            page.click("button:has-text('Login')")
            
            print("Waiting for Dashboard")
            page.wait_for_selector("text=Dashboard", timeout=10000)
            
            print("Clicking Text Translate")
            page.click("text=Text Translate")
            page.wait_for_selector("textarea")
            
            btn = page.locator("button:has-text('Translate')")
            print(f"Button enabled: {btn.is_enabled()}")
            
            page.fill("textarea", "Hello world")
            time.sleep(1)
            print(f"Button enabled after fill: {btn.is_enabled()}")
            
            # Click and wait for response
            try:
                print("Clicking button and waiting for response...")
                with page.expect_response("**/api/translate-text", timeout=10000) as response_info:
                    btn.click()
                response = response_info.value
                print(f"Response status: {response.status}")
                print(f"Response body: {response.text()}")
            except Exception as e:
                print(f"No response or timeout: {e}")
            
            print("Final page content snippet:")
            print(page.content()[:500])
            
            browser.close()
    finally:
        try:
            os.killpg(os.getpgid(backend_proc.pid), signal.SIGTERM)
            os.killpg(os.getpgid(frontend_proc.pid), signal.SIGTERM)
        except:
            pass

if __name__ == "__main__":
    run()
