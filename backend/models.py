import os
import torch
import numpy as np
import soundfile as sf
import threading
from transformers import (
    pipeline,
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    VitsModel,
    WhisperProcessor,
    WhisperForConditionalGeneration
)

class ModelManager:
    def __init__(self, cache_dir="./models"):
        self.cache_dir = os.path.abspath(cache_dir)
        os.environ["HF_HOME"] = os.path.join(self.cache_dir, "hf_cache")
        self.lock = threading.RLock() # Reentrant lock for concurrent requests safety
        self.ci_mode = os.environ.get("CI_MODE", "false").lower() == "true"
        
        # Select device automatically
        if self.ci_mode:
            self.device = "cpu"
        elif torch.cuda.is_available():
            self.device = "cuda"
        elif torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"
            
        print(f"[*] ModelManager initialized using device: {self.device} (CI_MODE={self.ci_mode})")
        
        # Lazy load containers
        self.whisper_pipe = {}
        self.nllb_model = None
        self.nllb_tokenizer = None
        self.tts_models = {}
        self.tts_tokenizers = {}

    def get_whisper(self, size="base"):
        with self.lock:
            if size not in self.whisper_pipe:
                model_id = f"openai/whisper-{size}"
                print(f"[*] Loading STT model {model_id} from {self.cache_dir} on {self.device}...")
                
                # Load processor & model from local cache
                processor = WhisperProcessor.from_pretrained(model_id, cache_dir=self.cache_dir)
                model = WhisperForConditionalGeneration.from_pretrained(model_id, cache_dir=self.cache_dir)
                
                # Pipeline does chunking automatically for long files
                self.whisper_pipe[size] = pipeline(
                    "automatic-speech-recognition",
                    model=model,
                    tokenizer=processor.tokenizer,
                    feature_extractor=processor.feature_extractor,
                    chunk_length_s=30,
                    device=0 if self.device == "cuda" else (-1 if self.device == "cpu" else "mps")
                )
            return self.whisper_pipe[size]

    def get_nllb(self):
        with self.lock:
            if self.nllb_model is None:
                model_id = "facebook/nllb-200-distilled-600M"
                print(f"[*] Loading NLLB-200 translation model from {self.cache_dir} on {self.device}...")
                self.nllb_tokenizer = AutoTokenizer.from_pretrained(model_id, cache_dir=self.cache_dir)
                self.nllb_model = AutoModelForSeq2SeqLM.from_pretrained(model_id, cache_dir=self.cache_dir).to(self.device)
            return self.nllb_model, self.nllb_tokenizer

    def get_tts(self, lang):
        with self.lock:
            if lang not in self.tts_models:
                model_id = {
                    "Hindi": "facebook/mms-tts-hin",
                    "Marathi": "facebook/mms-tts-mar",
                    "English": "facebook/mms-tts-eng"
                }.get(lang)
                
                if not model_id:
                    raise ValueError(f"Unsupported TTS language: {lang}")
                    
                print(f"[*] Loading TTS model for {lang} ({model_id}) on {self.device}...")
                self.tts_tokenizers[lang] = AutoTokenizer.from_pretrained(model_id, cache_dir=self.cache_dir)
                self.tts_models[lang] = VitsModel.from_pretrained(model_id, cache_dir=self.cache_dir).to(self.device)
                
            return self.tts_models[lang], self.tts_tokenizers[lang]

    def transcribe(self, audio_path, size="base", language="English"):
        if self.ci_mode:
            return {
                "text": "This is a mock transcription for CI mode.",
                "segments": [
                    {"start": 0.0, "end": 2.0, "text": "This is a mock"},
                    {"start": 2.0, "end": 4.0, "text": "transcription for CI mode."}
                ]
            }
        with self.lock:
            # Map human language name to Whisper code
            # If "auto", we pass None to let Whisper detect
            lang_code = {
                "Marathi": "mr",
                "Hindi": "hi",
                "English": "en"
            }.get(language)
            
            pipe = self.get_whisper(size)
            print(f"[*] Transcribing {audio_path} using Whisper-{size} (language={'auto' if lang_code is None else lang_code})...")
            
            # Run Whisper ASR pipeline with timestamps
            gen_kwargs = {"return_timestamps": True}
            if lang_code:
                gen_kwargs["language"] = lang_code
            
            # Using the pipeline's underlying model to get detected language if needed
            # but for simplicity, we can also look at the pipe.model.config.lang
            # Actually, the pipeline result might have it if we use return_timestamps=True and return_language=True
            
            result = pipe(
                audio_path,
                chunk_length_s=30,
                stride_length_s=5,
                generate_kwargs=gen_kwargs
            )
            
            # Extract segments from chunks
            chunks = result.get("chunks", [])
            segments = []
            for chunk in chunks:
                start, end = chunk.get("timestamp", (0, 0))
                segments.append({
                    "start": start,
                    "end": end,
                    "text": chunk.get("text", "")
                })
            
            # Extract detected language if auto
            detected_lang = language
            if language == "auto" and hasattr(pipe.model, "config") and hasattr(pipe.model.config, "lang"):
                # Map ISO code back to name
                iso_to_name = {
                    "mr": "Marathi",
                    "hi": "Hindi",
                    "en": "English"
                }
                detected_lang = iso_to_name.get(pipe.model.config.lang, "English")
            
            return {
                "text": result.get("text", ""),
                "segments": segments,
                "detected_language": detected_lang
            }

    def translate(self, text, src_lang, tgt_lang):
        if not text.strip():
            return ""
            
        if self.ci_mode:
            return f"[CI MOCK] {tgt_lang}: {text}"
            
        if src_lang == tgt_lang:
            return text

        # Map languages to NLLB-200 code
        lang_codes = {
            "Marathi": "mar_Deva",
            "Hindi": "hin_Deva",
            "English": "eng_Latn"
        }
        
        src_code = lang_codes.get(src_lang)
        tgt_code = lang_codes.get(tgt_lang)
        
        if not src_code or not tgt_code:
            raise ValueError(f"Unsupported translation languages: {src_lang} -> {tgt_lang}")
            
        with self.lock:
            model, tokenizer = self.get_nllb()
            print(f"[*] Translating text using NLLB-200 ({src_code} -> {tgt_code})...")
            
            # Tokenize and force generation in target language
            tokenizer.src_lang = src_code
            inputs = tokenizer(text, return_tensors="pt").to(self.device)
            forced_bos_token_id = tokenizer.convert_tokens_to_ids(tgt_code)
            
            with torch.no_grad():
                translated_tokens = model.generate(
                    **inputs,
                    forced_bos_token_id=forced_bos_token_id,
                    max_length=256,
                    num_beams=4,
                    no_repeat_ngram_size=3
                )
                
            translated_text = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]
            return translated_text

    def translate_batch(self, texts, src_lang, tgt_lang):
        if not texts:
            return []
            
        if self.ci_mode:
            return [f"[CI MOCK] {tgt_lang}: {t}" if t.strip() else t for t in texts]
            
        if src_lang == tgt_lang:
            return texts

        # Map languages to NLLB-200 code
        lang_codes = {
            "Marathi": "mar_Deva",
            "Hindi": "hin_Deva",
            "English": "eng_Latn"
        }
        
        src_code = lang_codes.get(src_lang)
        tgt_code = lang_codes.get(tgt_lang)
        
        if not src_code or not tgt_code:
            raise ValueError(f"Unsupported translation languages: {src_lang} -> {tgt_lang}")
            
        # Filter out empty/whitespace-only texts but keep track of indices to restore them
        non_empty_indices = []
        non_empty_texts = []
        for idx, text in enumerate(texts):
            if text.strip():
                non_empty_indices.append(idx)
                non_empty_texts.append(text)
                
        results = [""] * len(texts)
        if not non_empty_texts:
            # All texts were empty
            for idx, text in enumerate(texts):
                if not text.strip():
                    results[idx] = text # Preserve original whitespace if any
            return results
            
        with self.lock:
            model, tokenizer = self.get_nllb()
            print(f"[*] Batch translating {len(non_empty_texts)} items using NLLB-200 ({src_code} -> {tgt_code})...")
            
            tokenizer.src_lang = src_code
            inputs = tokenizer(non_empty_texts, return_tensors="pt", padding=True).to(self.device)
            forced_bos_token_id = tokenizer.convert_tokens_to_ids(tgt_code)
            
            with torch.no_grad():
                translated_tokens = model.generate(
                    **inputs,
                    forced_bos_token_id=forced_bos_token_id,
                    max_length=256,
                    num_beams=4,
                    no_repeat_ngram_size=3
                )
                
            translated_texts = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)
            
            # Map back to full results list
            for i, idx in enumerate(non_empty_indices):
                results[idx] = translated_texts[i]
                
            # For empty texts, just preserve them
            for idx, text in enumerate(texts):
                if not text.strip():
                    results[idx] = ""
                    
            return results

    def text_to_speech(self, text, lang, output_path, speed=1.0):
        if not text.strip():
            raise ValueError("Empty text provided for TTS")
            
        supported_langs = ["Hindi", "Marathi", "English"]
        if lang not in supported_langs:
            raise ValueError(f"Unsupported TTS language: {lang}")

        if self.ci_mode:
            # Generate a small dummy wav file (1 second of silence at 16kHz)
            print(f"[*] [CI MOCK] Generating dummy TTS for {lang}...")
            dummy_data = np.zeros(16000)
            sf.write(output_path, dummy_data, 16000)
            return output_path

        with self.lock:
            model, tokenizer = self.get_tts(lang)
            print(f"[*] Synthesizing speech for text in {lang} (speed={speed})...")
            
            inputs = tokenizer(text, return_tensors="pt").to(self.device)
            
            with torch.no_grad():
                output = model(**inputs).waveform
                
            # Convert PyTorch tensor to numpy array (1D)
            waveform_numpy = output.cpu().numpy().squeeze()
            
            # Apply speed adjustment if not 1.0
            # We use simple linear resampling for speed control
            if speed != 1.0:
                import scipy.interpolate
                x = np.arange(len(waveform_numpy))
                new_x = np.linspace(0, len(waveform_numpy)-1, int(len(waveform_numpy) / speed))
                f = scipy.interpolate.interp1d(x, waveform_numpy)
                waveform_numpy = f(new_x).astype(np.float32)

            # MMS-TTS models output sample rate is 16000Hz
            sf.write(output_path, waveform_numpy, samplerate=16000)
            print(f"[✓] TTS audio written to: {output_path}")
            return output_path
