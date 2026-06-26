"""Audio transcription via faster-whisper (CTranslate2-backed Whisper, INT8).

faster-whisper already wraps CTranslate2 internally — there is no separate
"convert Whisper to CT2" step for us to script the way there is for
IndicTrans2; ct2-transformers-converter handles the HF checkpoint -> CT2
INT8 conversion (see models/model_config.json for the exact command).
"""
import logging

logger = logging.getLogger("dyansetu.transcription")

_LANG_NAME_TO_WHISPER_CODE = {"English": "en", "Hindi": "hi", "Marathi": "mr"}
_WHISPER_CODE_TO_LANG_NAME = {v: k for k, v in _LANG_NAME_TO_WHISPER_CODE.items()}


def transcribe(model_manager, audio_path: str, size: str = "medium", language: str = "auto") -> dict:
    """Returns {"text": str, "segments": [{"start","end","text"}], "detected_language": str}."""
    if model_manager.ci_mode:
        return {
            "text": "This is a mock transcription for CI mode.",
            "segments": [
                {"start": 0.0, "end": 2.0, "text": "This is a mock"},
                {"start": 2.0, "end": 4.0, "text": "transcription for CI mode."},
            ],
            "detected_language": "English",
        }

    whisper_model = model_manager.get_whisper(size)
    lang_code = _LANG_NAME_TO_WHISPER_CODE.get(language)  # None -> let Whisper auto-detect

    logger.info("Transcribing %s (size=%s, language=%s)", audio_path, size, language or "auto")
    segments_iter, info = whisper_model.transcribe(
        audio_path,
        language=lang_code,
        beam_size=5,
        vad_filter=True,  # trims silence -> fewer hallucinated segments, lower compute
    )

    segments = []
    full_text_parts = []
    for seg in segments_iter:
        text = seg.text.strip()
        segments.append({"start": seg.start, "end": seg.end, "text": text})
        full_text_parts.append(text)

    detected_lang = _WHISPER_CODE_TO_LANG_NAME.get(info.language, "English")

    return {
        "text": " ".join(full_text_parts),
        "segments": segments,
        "detected_language": detected_lang,
    }
