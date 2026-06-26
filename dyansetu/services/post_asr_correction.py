"""Task-specific post-ASR error correction for Hindi/Marathi transcripts.

Design intent from the brief: avoid general-purpose LLM correction (multi-turn
hallucination, "over-correction" of already-correct spans) by using a small
(~300M param) task-centric ByT5-small/mT5-small checkpoint instead, run
through ONNX Runtime rather than torch to stay inside the RAM ceiling.

IMPORTANT — unverified in this environment: there is no public, off-the-shelf
ByT5-small/mT5-small checkpoint already fine-tuned for Hindi/Marathi ASR
correction that I can confirm exists and name here. `models/model_config.json`
ships pointing at the base `google/mt5-small` until a task-specific fine-tune
is trained on (noisy ASR hypothesis, clean reference) pairs and exported via
scripts/export_correction_model_onnx.py. Treat correction quality as
unvalidated until that fine-tune exists.

Conservative-by-construction: rather than trusting the model blindly (which is
exactly the "over-correction" failure mode this component exists to avoid), we
reject any correction whose similarity to the input drops below
MIN_SIMILARITY_RATIO — a cheap, model-free guardrail that bounds how much a
single forward pass is allowed to rewrite.
"""
import difflib
import logging

logger = logging.getLogger("dyansetu.post_asr_correction")

MIN_SIMILARITY_RATIO = 0.6
TASK_PREFIX = "correct: "
MAX_NEW_TOKENS = 256


def _similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a, b).ratio()


def correct(model_manager, text: str, language: str) -> dict:
    """Returns {"corrected": str, "changed": bool, "similarity": float}.

    `changed` is False whenever the guardrail rejected the model's output —
    callers should treat that as "no correction applied", not an error.
    """
    text = text.strip()
    if not text:
        return {"corrected": text, "changed": False, "similarity": 1.0}

    if model_manager.ci_mode:
        return {"corrected": text, "changed": False, "similarity": 1.0}

    model, tokenizer = model_manager.get_correction_model()
    inputs = tokenizer(TASK_PREFIX + text, return_tensors="pt", truncation=True, max_length=512)
    output_ids = model.generate(**inputs, max_new_tokens=MAX_NEW_TOKENS, num_beams=1)
    candidate = tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()

    ratio = _similarity(text, candidate)
    if ratio < MIN_SIMILARITY_RATIO:
        logger.warning(
            "Rejected post-ASR correction (similarity=%.2f < %.2f) — suspected over-correction. "
            "original=%r candidate=%r",
            ratio, MIN_SIMILARITY_RATIO, text, candidate,
        )
        return {"corrected": text, "changed": False, "similarity": ratio}

    return {"corrected": candidate, "changed": candidate != text, "similarity": ratio}


def correct_segments(model_manager, segments: list, language: str) -> list:
    """Apply `correct` per-segment so timestamps stay aligned to corrected text."""
    corrected = []
    for seg in segments:
        result = correct(model_manager, seg["text"], language)
        corrected.append({"start": seg["start"], "end": seg["end"], "text": result["corrected"]})
    return corrected
