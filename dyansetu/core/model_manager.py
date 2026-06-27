"""Lazy-loading lifecycle manager for every quantized runtime Dyansetu uses.

Nothing heavy is imported or loaded at module import time. Each `get_*` method
loads its model on first use and caches it; `unload_all()` / `unload(name)`
release references and force a GC pass so RAM can be reclaimed under pressure
(e.g. before starting a large document batch). This is the layer
tests/test_batch_verification.py instruments to confirm the 7GB ceiling holds.
"""
import os
import gc
import logging
import threading

from core import config

logger = logging.getLogger("dyansetu.model_manager")


class ModelManager:
    def __init__(self, models_dir: str = None):
        self.models_dir = models_dir or config.MODELS_DIR
        self.ci_mode = config.CI_MODE
        self._lock = threading.RLock()

        self._lang_id = None
        self._whisper = None
        self._translators = {}   # keyed by model variant: "en-indic" | "indic-indic"
        self._correction_model = None
        self._correction_tokenizer = None
        self._ocr_reader = None

        logger.info(
            "ModelManager initialized (ci_mode=%s, models_dir=%s, ram_ceiling_mb=%d)",
            self.ci_mode, self.models_dir, config.RAM_CEILING_MB,
        )

    # ---- FastText language ID -------------------------------------------------
    def get_lang_id(self):
        with self._lock:
            if self._lang_id is None:
                from services.lang_id import FastTextLangID
                self._lang_id = FastTextLangID(models_dir=self.models_dir, ci_mode=self.ci_mode)
            return self._lang_id

    # ---- faster-whisper (CT2-backed) ------------------------------------------
    def get_whisper(self, size: str = "medium"):
        with self._lock:
            if self.ci_mode:
                return None  # services.transcription short-circuits before touching this
            if self._whisper is None:
                from faster_whisper import WhisperModel
                model_dir = os.path.join(self.models_dir, f"whisper-{size}-int8")
                logger.info("Loading faster-whisper (%s, INT8) from %s", size, model_dir)
                self._whisper = WhisperModel(
                    model_dir if os.path.isdir(model_dir) else f"medium",
                    device="cpu",
                    compute_type="int8",
                    cpu_threads=config.WHISPER_CPU_THREADS,
                    num_workers=1,  # one in-flight request at a time keeps peak RAM predictable
                )
            return self._whisper

    # ---- IndicTrans2-Dist / Dist-M2M (CTranslate2) -----------------------------
    def get_translator(self, variant: str):
        """variant: 'en-indic' (IndicTrans2-Dist) or 'indic-indic' (IndicTrans2-Dist-M2M)."""
        with self._lock:
            if self.ci_mode:
                return None
            if variant not in self._translators:
                import ctranslate2
                model_path = os.path.join(self.models_dir, f"indictrans2-{variant}-ct2-int8")
                if not os.path.isdir(model_path):
                    raise FileNotFoundError(
                        f"CTranslate2 model not found at {model_path}. Run "
                        f"scripts/convert_indictrans2_ct2.py to produce it first."
                    )
                logger.info("Loading CTranslate2 translator '%s' from %s", variant, model_path)
                self._translators[variant] = ctranslate2.Translator(
                    model_path,
                    device="cpu",
                    intra_threads=config.CT2_INTRA_THREADS,
                    inter_threads=1,
                )
            return self._translators[variant]

    # ---- ByT5/mT5-small post-ASR correction (ONNX Runtime via optimum) ---------
    def get_correction_model(self):
        with self._lock:
            if self.ci_mode:
                return None, None
            if self._correction_model is None:
                from optimum.onnxruntime import ORTModelForSeq2SeqLM
                from transformers import AutoTokenizer
                model_dir = os.path.join(self.models_dir, "post-asr-correction-onnx")
                logger.info("Loading post-ASR correction model (ONNX Runtime) from %s", model_dir)
                self._correction_tokenizer = AutoTokenizer.from_pretrained(model_dir)
                self._correction_model = ORTModelForSeq2SeqLM.from_pretrained(model_dir)
            return self._correction_model, self._correction_tokenizer

    # ---- PaddleOCR --------------------------------------------------------------
    def get_ocr_reader(self):
        with self._lock:
            if self.ci_mode:
                return None
            if self._ocr_reader is None:
                from paddleocr import PaddleOCR
                logger.info("Loading PaddleOCR (mobile/CPU-light, lang=devanagari)...")
                self._ocr_reader = PaddleOCR(
                    use_angle_cls=True,
                    lang="devanagari",
                    use_gpu=False,
                    det_model_dir=os.path.join(self.models_dir, "paddleocr", "det"),
                    rec_model_dir=os.path.join(self.models_dir, "paddleocr", "rec"),
                    cls_model_dir=os.path.join(self.models_dir, "paddleocr", "cls"),
                    show_log=False,
                )
            return self._ocr_reader

    # ---- Memory management -------------------------------------------------------
    def unload(self, name: str):
        with self._lock:
            attr = {
                "whisper": "_whisper",
                "correction": "_correction_model",
                "ocr": "_ocr_reader",
            }.get(name)
            if attr:
                setattr(self, attr, None)
            elif name == "translators":
                self._translators.clear()
            gc.collect()
            logger.info("Unloaded model: %s", name)

    def unload_all(self):
        with self._lock:
            self._lang_id = None
            self._whisper = None
            self._translators.clear()
            self._correction_model = None
            self._correction_tokenizer = None
            self._ocr_reader = None
            gc.collect()
            logger.info("Unloaded all models.")

    def current_rss_mb(self) -> float:
        import psutil
        return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)


# Process-wide singleton, mirrors the existing backend/models.py pattern.
model_manager = ModelManager()
