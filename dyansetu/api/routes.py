"""FastAPI route layer. Endpoints are thin: validate input, call into
services/, return a response model — no model logic lives here.

Session-scoped downloads are intentionally path-traversal-hardened (resolve
the real path and verify it's still inside TEMP_DIR) — this is the exact
class of bug the existing backend/app.py /api/download-file endpoint has
(unauthenticated, unsanitized session_id/filename joined into a path); this
rebuild does not repeat it.
"""
import logging
import os
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from api.schemas import (
    DetectLanguageRequest, DetectLanguageResponse,
    TranslateTextRequest, TranslateTextResponse,
)
from core import config
from core.model_manager import model_manager
from services import document_processor, media_processor, transcription, translation
from services.compound_trie import CompoundTrie
from services.lang_id import FastTextLangID
from services.post_asr_correction import correct_segments

logger = logging.getLogger("dyansetu.api")
router = APIRouter()

_lang_id = FastTextLangID(models_dir=config.MODELS_DIR, ci_mode=config.CI_MODE)
_compound_trie = CompoundTrie.from_vocab_file(os.path.join(config.MODELS_DIR, "regional_vocab.txt"))


def _safe_session_path(session_id: str, filename: str) -> str:
    """Joins session_id/filename under TEMP_DIR and rejects any traversal
    outside it, regardless of how many '..' segments are attempted."""
    candidate = os.path.realpath(os.path.join(config.TEMP_DIR, session_id, filename))
    temp_root = os.path.realpath(config.TEMP_DIR)
    if os.path.commonpath([candidate, temp_root]) != temp_root:
        raise HTTPException(status_code=400, detail="Invalid path.")
    return candidate


@router.get("/health")
def health_check():
    return {"status": "healthy", "ci_mode": config.CI_MODE}


@router.post("/api/detect-language", response_model=DetectLanguageResponse)
def detect_language(req: DetectLanguageRequest):
    if not req.text.strip():
        return DetectLanguageResponse(language="English")
    return DetectLanguageResponse(language=_lang_id.predict(req.text))


@router.post("/api/translate-text", response_model=TranslateTextResponse)
def translate_text(req: TranslateTextRequest):
    try:
        src_lang = req.src_lang
        if src_lang.lower() == "auto":
            src_lang = _lang_id.predict(req.text)
        translated = translation.translate(model_manager, req.text, src_lang, req.tgt_lang)
        return TranslateTextResponse(translated_text=translated, detected_src_lang=src_lang)
    except Exception as e:
        logger.error("Error in /api/translate-text: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/transcribe-audio")
async def transcribe_audio(
    file: UploadFile = File(...),
    model_size: str = Form("medium"),
    language: str = Form("auto"),
    apply_correction: bool = Form(True),
):
    import shutil

    session_id = str(uuid.uuid4())
    session_dir = os.path.join(config.TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    filename = file.filename or "unknown"
    file_ext = os.path.splitext(filename)[1].lower()
    input_path = os.path.join(session_dir, f"input{file_ext}")
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        audio_path = input_path
        if file_ext in (".mp4", ".mov", ".avi", ".wmv", ".mkv", ".flv", ".webm"):
            audio_path = os.path.join(session_dir, "extracted_audio.wav")
            media_processor.extract_audio(input_path, audio_path)

        result = transcription.transcribe(model_manager, audio_path, size=model_size, language=language)

        segments = result["segments"]
        if apply_correction:
            segments = correct_segments(model_manager, segments, result["detected_language"])

        from services.compound_trie import fix_text
        segments = [{**seg, "text": fix_text(seg["text"], _compound_trie)} for seg in segments]
        full_text = " ".join(seg["text"] for seg in segments)

        return {
            "text": full_text,
            "segments": segments,
            "srt": media_processor.generate_srt(segments),
            "vtt": media_processor.generate_vtt(segments),
            "detected_language": result["detected_language"],
            "session_id": session_id,
        }
    except Exception as e:
        logger.error("Error in /api/transcribe-audio: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/translate-document")
async def translate_document(
    file: UploadFile = File(...),
    src_lang: str = Form("auto"),
    tgt_lang: str = Form("Hindi"),
):
    import shutil

    session_id = str(uuid.uuid4())
    session_dir = os.path.join(config.TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    filename = file.filename or "unknown"
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in (".docx", ".pptx", ".xlsx", ".pdf"):
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {file_ext}")

    input_path = os.path.join(session_dir, f"input{file_ext}")
    output_filename = f"translated_{filename}"
    output_path = os.path.join(session_dir, output_filename)
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    actual_src = src_lang
    if src_lang.lower() == "auto":
        preview = document_processor.extract_preview_text(input_path, file_ext)
        actual_src = _lang_id.predict(preview) if preview else "English"

    try:
        if file_ext == ".docx":
            document_processor.translate_docx(input_path, output_path, model_manager, actual_src, tgt_lang)
        elif file_ext == ".pptx":
            document_processor.translate_pptx(input_path, output_path, model_manager, actual_src, tgt_lang)
        elif file_ext == ".xlsx":
            document_processor.translate_xlsx(input_path, output_path, model_manager, actual_src, tgt_lang)
        elif file_ext == ".pdf":
            document_processor.translate_pdf(input_path, output_path, model_manager, actual_src, tgt_lang)

        return {
            "session_id": session_id,
            "filename": output_filename,
            "detected_src_lang": actual_src,
            "download_url": f"/api/download-file?session_id={session_id}&filename={output_filename}",
        }
    except Exception as e:
        logger.error("Error in /api/translate-document: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/download-file")
def download_file(session_id: str, filename: str):
    file_path = _safe_session_path(session_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Requested file not found.")

    ext = os.path.splitext(filename)[1].lower()
    media_type = {
        ".mp4": "video/mp4", ".wav": "audio/wav", ".srt": "text/plain", ".vtt": "text/plain",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".pdf": "application/pdf",
    }.get(ext, "application/octet-stream")

    return FileResponse(file_path, media_type=media_type, filename=os.path.basename(filename))
