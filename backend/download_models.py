import os
import sys

def download_models(target_dir="./models"):
    os.makedirs(target_dir, exist_ok=True)
    target_dir = os.path.abspath(target_dir)
    print(f"[*] Downloading models to: {target_dir}")
    
    # We set HF_HOME or HF_HUB_ENABLE_HF_TRANSFER if desired, but standard transformers is fine
    os.environ["HF_HOME"] = os.path.join(target_dir, "hf_cache")
    
    from transformers import (
        AutoTokenizer, 
        AutoModelForSeq2SeqLM, 
        WhisperProcessor, 
        WhisperForConditionalGeneration,
        VitsModel
    )
    
    # 1. Whisper Models (Speech to Text)
    # We will pre-download Whisper Base and Tiny for options
    whisper_models = ["openai/whisper-tiny", "openai/whisper-base"]
    for model_id in whisper_models:
        print(f"\n[+] Downloading Speech-to-Text Model: {model_id}")
        try:
            WhisperProcessor.from_pretrained(model_id, cache_dir=target_dir)
            WhisperForConditionalGeneration.from_pretrained(model_id, cache_dir=target_dir)
            print(f"[✓] Successfully downloaded: {model_id}")
        except Exception as e:
            print(f"[✗] Error downloading {model_id}: {e}", file=sys.stderr)

    # 2. NLLB-200 Model (Translation)
    nllb_model = "facebook/nllb-200-distilled-600M"
    print(f"\n[+] Downloading Translation Model: {nllb_model}")
    try:
        AutoTokenizer.from_pretrained(nllb_model, cache_dir=target_dir)
        AutoModelForSeq2SeqLM.from_pretrained(nllb_model, cache_dir=target_dir)
        print(f"[✓] Successfully downloaded: {nllb_model}")
    except Exception as e:
        print(f"[✗] Error downloading {nllb_model}: {e}", file=sys.stderr)

    # 3. MMS-TTS Models (Text to Speech for Hin, Mar, Eng)
    tts_models = {
        "Hindi": "facebook/mms-tts-hin",
        "Marathi": "facebook/mms-tts-mar",
        "English": "facebook/mms-tts-eng"
    }
    for lang, model_id in tts_models.items():
        print(f"\n[+] Downloading Text-to-Speech Model for {lang}: {model_id}")
        try:
            AutoTokenizer.from_pretrained(model_id, cache_dir=target_dir)
            VitsModel.from_pretrained(model_id, cache_dir=target_dir)
            print(f"[✓] Successfully downloaded TTS: {model_id}")
        except Exception as e:
            print(f"[✗] Error downloading TTS {model_id}: {e}", file=sys.stderr)

    print("\n[✓] All models downloaded successfully and cached for offline use!")

if __name__ == "__main__":
    # If a custom path is provided as argument, use it
    path = sys.argv[1] if len(sys.argv) > 1 else "./models"
    download_models(path)
