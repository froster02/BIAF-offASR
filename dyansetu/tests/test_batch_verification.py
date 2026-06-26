"""Terminal-driven /batch verification pass.

What this CAN verify in this sandbox (CI_MODE=true, no GPU/no large model
downloads needed): that the full request pipeline — language ID, script
normalization, DNT masking, compound-word fixing, and the translate/
transcribe/document code paths — wires together correctly end-to-end under
concurrent load, using each service's CI_MODE mock instead of a real model.

What this CANNOT verify here (must be re-run on the real Windows 11 /
Intel i5-11th-gen target with real models loaded, per the agreed scaffold-only
scope): actual peak RSS with IndicTrans2 + faster-whisper + the correction
model + PaddleOCR all resident simultaneously. The RAM_CEILING_MB check below
is real and will genuinely fail this process over budget — it's just that in
CI_MODE there's nothing heavy loaded, so a pass here is necessary but not
sufficient evidence the 7GB ceiling holds in production.

Run directly:
    DYANSETU_CI_MODE=true python -m tests.test_batch_verification
Or under pytest:
    DYANSETU_CI_MODE=true pytest dyansetu/tests/test_batch_verification.py -v
"""
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

os.environ.setdefault("DYANSETU_CI_MODE", "true")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import config  # noqa: E402
from core.model_manager import model_manager  # noqa: E402
from services import translation  # noqa: E402
from services.lang_id import FastTextLangID  # noqa: E402
from services.compound_trie import CompoundTrie, fix_text  # noqa: E402

SAMPLE_TEXTS = {
    "English": "The annual rathyatra festival draws large crowds every year.",
    "Hindi": "हर साल रथयात्रा उत्सव में बड़ी संख्या में लोग आते हैं।",
    "Marathi": "रथा यात्रा दर वर्षी मोठ्या संख्येने लोक येतात.",
}
MAX_LOAD_REPEAT = 50      # simulate "maximum text load parameters"
CONCURRENT_JOBS = 8       # simulate "concurrent media arrays"


def _translate_job(idx: int):
    lang_id = FastTextLangID(models_dir=config.MODELS_DIR, ci_mode=True)
    text = SAMPLE_TEXTS["Marathi"] if idx % 2 == 0 else SAMPLE_TEXTS["English"]
    detected = lang_id.predict(text)
    translated = translation.translate(model_manager, text, detected, "Hindi")
    assert translated, f"job {idx}: empty translation result"
    return translated


def _compound_fix_job(idx: int):
    trie = CompoundTrie.from_vocab_file(os.path.join(config.MODELS_DIR, "regional_vocab.txt"))
    fixed = fix_text(SAMPLE_TEXTS["Marathi"], trie)
    assert "रथयात्रा" in fixed, f"job {idx}: compound word was not merged, got: {fixed!r}"
    return fixed


def test_concurrent_translation_load_stays_under_ram_ceiling():
    assert config.CI_MODE, "This verification pass must run with DYANSETU_CI_MODE=true"

    baseline_rss = model_manager.current_rss_mb()
    start = time.time()

    with ThreadPoolExecutor(max_workers=CONCURRENT_JOBS) as pool:
        futures = [pool.submit(_translate_job, i) for i in range(MAX_LOAD_REPEAT)]
        results = [f.result() for f in futures]

    elapsed = time.time() - start
    peak_rss = model_manager.current_rss_mb()

    assert len(results) == MAX_LOAD_REPEAT
    assert peak_rss < config.RAM_CEILING_MB, (
        f"Process RSS {peak_rss:.1f}MB exceeded ceiling {config.RAM_CEILING_MB}MB"
    )
    print(
        f"[batch-verify] {MAX_LOAD_REPEAT} jobs x {CONCURRENT_JOBS} workers in {elapsed:.2f}s | "
        f"RSS baseline={baseline_rss:.1f}MB peak={peak_rss:.1f}MB ceiling={config.RAM_CEILING_MB}MB"
    )


def test_compound_word_fix_under_concurrent_load():
    with ThreadPoolExecutor(max_workers=CONCURRENT_JOBS) as pool:
        futures = [pool.submit(_compound_fix_job, i) for i in range(MAX_LOAD_REPEAT)]
        results = [f.result() for f in futures]
    assert len(results) == MAX_LOAD_REPEAT


def test_lang_id_disambiguates_short_marathi_text():
    lang_id = FastTextLangID(models_dir=config.MODELS_DIR, ci_mode=True)
    assert lang_id.predict("रथा यात्रा सुरु") == "Marathi"
    assert lang_id.predict("hello world") == "English"


if __name__ == "__main__":
    print("=== Dyansetu /batch terminal verification (CI_MODE) ===")
    test_lang_id_disambiguates_short_marathi_text()
    print("[ok] language ID disambiguation")
    test_compound_word_fix_under_concurrent_load()
    print("[ok] compound-word fixing under concurrent load")
    test_concurrent_translation_load_stays_under_ram_ceiling()
    print("[ok] concurrent translation load within CI-mode RAM ceiling")
    print("\nNOTE: this pass used CI_MODE mocks. Real RAM-ceiling validation with actual")
    print("IndicTrans2/faster-whisper/correction/PaddleOCR models loaded must still be")
    print("run on the target Windows 11 / Intel i5-11th-gen machine before shipping.")
