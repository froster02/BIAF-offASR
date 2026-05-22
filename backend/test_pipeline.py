import os
import sys
import torch

# Add backend to path so we can import models robustly
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)
import models

def test_pipeline():
    print("=" * 60)
    print("   BAIF OFFLINE TRANSLATION PIPELINE FUNCTIONAL TEST   ")
    print("=" * 60)
    
    # 1. Initialize Model Manager
    models_dir = os.path.join(BASE_DIR, "models")
    print(f"[*] Initializing ModelManager from: {models_dir}")
    try:
        manager = models.ModelManager(cache_dir=models_dir)
        print(f"[✓] ModelManager successfully initialized on device: {manager.device}")
    except Exception as e:
        print(f"[✗] ModelManager initialization failed: {e}")
        return False

    print("\n" + "-" * 40)
    print("1. RUNNING TEXT TRANSLATION FUNCTIONAL TESTS (NLLB-200)")
    print("-" * 40)
    
    test_cases = [
        ("English", "Hindi", "how are you ?"),
        ("Hindi", "Marathi", "तुम कैसे हो ?"),
        ("Marathi", "English", "तू कसा आहेस ?"),
        ("English", "Marathi", "thank you very much ."),
        ("Marathi", "Hindi", "खूप खूप धन्यवाद ."),
        ("Hindi", "English", "आपका बहुत-बहुत धन्यवाद ।")
    ]
    
    all_passed = True
    for src, tgt, text in test_cases:
        print(f"\n[*] Test Case: {src} ➔ {tgt}")
        print(f"    Source Text: '{text}'")
        try:
            translation = manager.translate(text, src, tgt)
            print(f"    [✓] Result: '{translation}'")
        except Exception as e:
            print(f"    [✗] Translation Failed: {e}")
            all_passed = False

    print("\n" + "-" * 40)
    print("2. RUNNING BATCH TRANSLATION TESTS (NLLB-200)")
    print("-" * 40)
    
    batch_texts = [
        "hello everyone",
        "how are you ?",
        "we are working to solve offline translation for farmers",
        "thank you very much"
    ]
    print(f"[*] Input Batch: {batch_texts}")
    try:
        batch_results = manager.translate_batch(batch_texts, "English", "Hindi")
        print("[✓] Batch Translation Succeeded:")
        for idx, (original, translated) in enumerate(zip(batch_texts, batch_results)):
            print(f"    [{idx}] '{original}' ➔ '{translated}'")
    except Exception as e:
        print(f"[✗] Batch Translation Failed: {e}")
        all_passed = False

    print("\n" + "-" * 40)
    print("3. RUNNING TEXT-TO-SPEECH (TTS) FUNCTIONAL TESTS (MMS-TTS)")
    print("-" * 40)
    
    tts_test_cases = [
        ("English", "This is an automated offline text to speech test on localhost."),
        ("Hindi", "यह स्थानीय होस्ट पर एक स्वचालित ऑफ़लाइन पाठ से वाक् परीक्षण है।"),
        ("Marathi", "हे लोकलहोस्टवरील स्वयंचलित ऑफलाइन मजकूर ते भाषण चाचणी आहे.")
    ]
    
    temp_dir = os.path.join(BASE_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    for lang, text in tts_test_cases:
        out_path = os.path.join(temp_dir, f"test_tts_{lang.lower()}.wav")
        print(f"\n[*] TTS Test Case: {lang}")
        print(f"    Text: '{text}'")
        print(f"    Output Path: {out_path}")
        try:
            if os.path.exists(out_path):
                os.remove(out_path)
            manager.text_to_speech(text, lang, out_path)
            if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                print(f"    [✓] TTS Succeeded! File size: {os.path.getsize(out_path)} bytes")
            else:
                print("    [✗] TTS Succeeded but output file is empty or missing.")
                all_passed = False
        except Exception as e:
            print(f"    [✗] TTS Failed: {e}")
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("   ALL FUNCTIONAL AND REGRESSION TESTS COMPLETED SUCCESSFULLY!   ")
    else:
        print("   SOME FUNCTIONAL AND REGRESSION TESTS FAILED. CHECK LOGS.      ")
    print("=" * 60)
    return all_passed

if __name__ == "__main__":
    test_pipeline()
