import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
try:
    from langdetect import detect, DetectorFactory
    DetectorFactory.seed = 0
except ImportError:
    def detect(text: str) -> str:
        return "en"

import sys
# Ensure the backend directory is in the path for absolute imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import models
import document_utils
import auth as auth_mod
import jobs
import subtitles

app = FastAPI(title="Offline Translation API", version="1.0.0")

# Auth Endpoints
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
def login(req: LoginRequest):
    conn = auth_mod.get_db_conn()
    c = conn.cursor()
    c.execute("SELECT password, role FROM users WHERE username=?", (req.username,))
    row = c.fetchone()
    conn.close()
    
    if not row or not auth_mod.verify_password(req.password, row[0]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    token = auth_mod.create_access_token(data={"sub": req.username, "role": row[1]})
    return {"access_token": token, "token_type": "bearer", "role": row[1]}

# Dependency for protected routes
from fastapi import Depends
protected = [Depends(auth_mod.get_current_user)]
admin_only = [Depends(auth_mod.require_admin)]

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
TEMP_DIR = os.path.join(BASE_DIR, "temp")

os.makedirs(TEMP_DIR, exist_ok=True)

# Initialize Model Manager (cached local models)
model_manager = models.ModelManager(cache_dir=MODELS_DIR)

# Request schemas
class TranslationRequest(BaseModel):
    text: str
    src_lang: str
    tgt_lang: str

class TTSRequest(BaseModel):
    text: str
    lang: str

def clean_temp_folder():
    """Clean the temporary workspace folder on start"""
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR)
    os.makedirs(TEMP_DIR, exist_ok=True)

@app.on_event("startup")
def startup_event():
    clean_temp_folder()
    print("[*] Temporary folder cleared.")

@app.get("/api/models-status")
def get_models_status(user=Depends(auth_mod.get_current_user)):
    """
    Check if the models cache exists and return which files are cached
    """
    is_cached = False
    whisper_cached = False
    nllb_cached = False
    tts_cached = False
    
    # We can check folder existence inside the models dir
    if os.path.exists(MODELS_DIR):
        contents = os.listdir(MODELS_DIR)
        if len(contents) > 0:
            is_cached = True
            # Simple check for subfolders
            for item in contents:
                if "whisper" in item:
                    whisper_cached = True
                if "nllb" in item:
                    nllb_cached = True
                if "tts" in item:
                    tts_cached = True
                    
    return {
        "is_cached": is_cached,
        "whisper_cached": whisper_cached or is_cached, # fallback to is_cached if downloading via downloader
        "nllb_cached": nllb_cached or is_cached,
        "tts_cached": tts_cached or is_cached,
        "models_dir": MODELS_DIR
    }

def detect_language_safe(text: str) -> str:
    """
    Detect language and map to supported names
    """
    try:
        lang_code = detect(text)
        mapping = {
            "en": "English",
            "hi": "Hindi",
            "mr": "Marathi"
        }
        return mapping.get(lang_code, "English") # Default to English
    except:
        return "English"

@app.post("/api/detect-language")
def api_detect_language(req: dict):
    text = req.get("text", "")
    if not text:
        return {"language": "English"}
    return {"language": detect_language_safe(text)}

@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str, user=Depends(auth_mod.get_current_user)):
    job = jobs.job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/api/translate-text")
def translate_text(req: TranslationRequest, user=Depends(auth_mod.get_current_user)):
    """
    Translate text using offline NLLB-200 model
    """
    try:
        src_lang = req.src_lang
        if src_lang.lower() == "auto":
            src_lang = detect_language_safe(req.text)
            
        translated = model_manager.translate(req.text, src_lang, req.tgt_lang)
        return {"translated_text": translated, "detected_src_lang": src_lang}
    except Exception as e:
        print(f"[Error] /api/translate-text: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe-audio")
async def transcribe_audio(
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    language: str = Form("English"),
    user=Depends(auth_mod.get_current_user)
):
    """
    Transcribe uploaded audio or video file using offline Whisper
    """
    # Create unique session folder
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    filename = file.filename or "unknown"
    file_ext = os.path.splitext(filename)[1].lower()
    input_path = os.path.join(session_dir, f"input{file_ext}")
    
    # Save uploaded file
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        audio_path = input_path
        
        # If it's a video file, extract audio track using FFmpeg
        is_video = file_ext in [".mp4", ".mov", ".avi", ".wmv", ".mkv", ".flv", ".webm"]
        if is_video:
            print(f"[*] Input is a video file. Extracting audio stream...")
            audio_path = os.path.join(session_dir, "extracted_audio.wav")
            subtitles.extract_audio(input_path, audio_path)
            
        # Transcribe audio file
        transcription_result = model_manager.transcribe(
            audio_path=audio_path,
            size=model_size,
            language=language
        )
        
        # Generate SRT and VTT
        srt_content = subtitles.generate_srt(transcription_result["segments"])
        vtt_content = subtitles.generate_vtt(transcription_result["segments"])
        
        return {
            "text": transcription_result["text"],
            "segments": transcription_result["segments"],
            "srt": srt_content,
            "vtt": vtt_content,
            "session_id": session_id
        }
        
    except Exception as e:
        print(f"[Error] /api/transcribe-audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translate-audio")
async def translate_audio(
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    src_lang: str = Form("English"),
    tgt_lang: str = Form("Hindi"),
    user=Depends(auth_mod.get_current_user)
):
    """
    Transcribe and translate an audio or video file
    """
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    filename = file.filename or "unknown"
    file_ext = os.path.splitext(filename)[1].lower()
    input_path = os.path.join(session_dir, f"input{file_ext}")
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        audio_path = input_path
        is_video = file_ext in [".mp4", ".mov", ".avi", ".wmv", ".mkv", ".flv", ".webm"]
        if is_video:
            audio_path = os.path.join(session_dir, "extracted_audio.wav")
            subtitles.extract_audio(input_path, audio_path)
            
        # Transcribe in source language
        transcription_result = model_manager.transcribe(
            audio_path=audio_path,
            size=model_size,
            language=src_lang
        )
        
        actual_src = transcription_result.get("detected_language")
        if not actual_src or actual_src.lower() == "auto":
            actual_src = "English"

        # Translate the full text
        translated_text = model_manager.translate(
            text=transcription_result["text"],
            src_lang=actual_src,
            tgt_lang=tgt_lang
        )
        
        # Batch translate all segments to construct translated subtitles
        seg_texts = [seg["text"] for seg in transcription_result["segments"]]
        translated_texts = model_manager.translate_batch(
            texts=seg_texts,
            src_lang=actual_src,
            tgt_lang=tgt_lang
        )
        
        translated_segments = []
        for seg, trans_text in zip(transcription_result["segments"], translated_texts):
            translated_segments.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": trans_text
            })
            
        # Generate translated SRT & VTT
        translated_srt = subtitles.generate_srt(translated_segments)
        translated_vtt = subtitles.generate_vtt(translated_segments)
        
        # Still generate full text for UI results
        full_translated_text = " ".join([seg["text"] for seg in translated_segments])
        
        # Merge audio segments if it was requested
        tts_output_filename = f"tts_{tgt_lang.lower()}.wav"
        tts_output_path = os.path.join(session_dir, tts_output_filename)
        
        # Use synchronized merge for audio translation as well
        subtitles.merge_audio_segments(translated_segments, session_dir, model_manager, tgt_lang)
        # The merge_audio_segments returns 'combined_audio.wav' in session_dir, let's rename it to expected name
        if os.path.exists(os.path.join(session_dir, "combined_audio.wav")):
            shutil.move(os.path.join(session_dir, "combined_audio.wav"), tts_output_path)
        
        return {
            "source_text": transcription_result["text"],
            "translated_text": full_translated_text,
            "source_segments": transcription_result["segments"],
            "translated_segments": translated_segments,
            "translated_srt": translated_srt,
            "translated_vtt": translated_vtt,
            "translated_audio_url": f"/api/download-file?session_id={session_id}&filename={tts_output_filename}",
            "session_id": session_id
        }
        
    except Exception as e:
        print(f"[Error] /api/translate-audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/text-to-speech")
def text_to_speech(req: TTSRequest, user=Depends(auth_mod.get_current_user)):
    """
    Synthesize text into speech and return WAV audio binary stream
    """
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    output_path = os.path.join(session_dir, "tts.wav")
    try:
        model_manager.text_to_speech(req.text, req.lang, output_path)
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename=f"translated_speech_{req.lang.lower()}.wav"
        )
    except Exception as e:
        print(f"[Error] /api/text-to-speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_video_processing(job_id, session_id, input_path, session_dir, file_ext, model_size, src_lang, tgt_lang, burn_subtitles_option, overlay_voice_option):
    try:
        jobs.job_manager.update_job(job_id, status="processing", progress=5)
        
        # 1. Extract audio for ASR
        audio_path = os.path.join(session_dir, "extracted_audio.wav")
        subtitles.extract_audio(input_path, audio_path)
        jobs.job_manager.update_job(job_id, progress=15)
        
        # 2. Transcribe
        transcription_result = model_manager.transcribe(
            audio_path=audio_path,
            size=model_size,
            language=src_lang
        )
        jobs.job_manager.update_job(job_id, progress=40)
        
        # Use detected language for translation steps
        actual_src = transcription_result.get("detected_language")
        if not actual_src or actual_src.lower() == "auto":
             actual_src = "English" # Final fallback
             
        # 3. Batch translate all segments & construct SRT
        seg_texts = [seg["text"] for seg in transcription_result["segments"]]
        translated_texts = model_manager.translate_batch(
            texts=seg_texts,
            src_lang=actual_src,
            tgt_lang=tgt_lang
        )
        jobs.job_manager.update_job(job_id, progress=60)
        
        translated_segments = []
        for seg, trans_text in zip(transcription_result["segments"], translated_texts):
            translated_segments.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": trans_text
            })
            
        translated_srt = subtitles.generate_srt(translated_segments)
        translated_srt_path = os.path.join(session_dir, "translated_subs.srt")
        with open(translated_srt_path, "w", encoding="utf-8") as f:
            f.write(translated_srt)
            
        # 4. Generate subtitles-burned video
        current_video_stream = input_path
        if burn_subtitles_option:
            print("[*] Burning subtitles into video stream...")
            burned_video_path = os.path.join(session_dir, "burned_subtitles.mp4")
            subtitles.burn_subtitles(input_path, translated_srt_path, burned_video_path)
            current_video_stream = burned_video_path
        jobs.job_manager.update_job(job_id, progress=80)
            
        # 5. Handle audio overlay if selected
        output_video_filename = ""
        full_translated_text = ""
        if overlay_voice_option:
            print("[*] Generating voiceover segments and overlaying...")
            # Enhanced synchronization: synthesize each segment and merge them at correct timestamps
            tts_audio_path = subtitles.merge_audio_segments(translated_segments, session_dir, model_manager, tgt_lang)
            
            # Still generate full text for UI results
            full_translated_text = " ".join([seg["text"] for seg in translated_segments])
            
            final_video_path = os.path.join(session_dir, "translated_final.mp4")
            subtitles.overlay_audio_on_video(current_video_stream, tts_audio_path, final_video_path)
            output_video_filename = "translated_final.mp4"
        else:
            if burn_subtitles_option:
                output_video_filename = "burned_subtitles.mp4"
            else:
                output_video_filename = f"input{file_ext}"
        
        jobs.job_manager.update_job(
            job_id,
            status="completed",
            progress=100,
            result={
                "source_text": transcription_result["text"],
                "translated_text": full_translated_text,
                "translated_srt": translated_srt,
                "video_url": f"/api/download-file?session_id={session_id}&filename={output_video_filename}",
                "srt_url": f"/api/download-file?session_id={session_id}&filename=translated_subs.srt",
                "session_id": session_id
            }
        )
    except Exception as e:
        print(f"[Error] Job {job_id}: {e}")
        jobs.job_manager.update_job(job_id, status="failed", error=str(e))

@app.post("/api/process-video")
async def api_process_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    src_lang: str = Form("English"),
    tgt_lang: str = Form("Hindi"),
    burn_subtitles_option: bool = Form(True),
    overlay_voice_option: bool = Form(False),
    user=Depends(auth_mod.get_current_user)
):
    """
    Complete video translation pipeline asynchronously
    """
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    filename = file.filename or "unknown"
    file_ext = os.path.splitext(filename)[1].lower()
    input_path = os.path.join(session_dir, f"input{file_ext}")
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    job_id = jobs.job_manager.create_job("video_processing")
    background_tasks.add_task(
        run_video_processing,
        job_id, session_id, input_path, session_dir, file_ext, model_size, src_lang, tgt_lang, 
        burn_subtitles_option, overlay_voice_option
    )
    
    return {"job_id": job_id}

@app.get("/api/download-file")
def download_file(session_id: str, filename: str):
    """
    Endpoint to download session files safely
    """
    file_path = os.path.join(TEMP_DIR, session_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Requested file not found.")
        
    # Set appropriate media type
    ext = os.path.splitext(filename)[1].lower()
    media_type = "application/octet-stream"
    if ext == ".mp4":
        media_type = "video/mp4"
    elif ext == ".wav":
        media_type = "audio/wav"
    elif ext in [".srt", ".vtt"]:
        media_type = "text/plain"
    elif ext == ".docx":
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif ext == ".pptx":
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    elif ext == ".xlsx":
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif ext == ".pdf":
        media_type = "application/pdf"
        
    return FileResponse(file_path, media_type=media_type, filename=filename)

def run_document_translation(job_id, session_id, input_path, output_path, file_ext, src_lang, tgt_lang, output_filename):
    try:
        jobs.job_manager.update_job(job_id, status="processing", progress=10)
        
        # Auto-detect if requested
        actual_src = src_lang
        if src_lang.lower() == "auto":
            preview = document_utils.extract_preview_text(input_path, file_ext)
            actual_src = detect_language_safe(preview)
            print(f"[*] Auto-detected document language: {actual_src}")

        # Document translation logic
        if file_ext == ".docx":
            document_utils.translate_docx(input_path, output_path, model_manager, actual_src, tgt_lang)
        elif file_ext == ".pptx":
            document_utils.translate_pptx(input_path, output_path, model_manager, actual_src, tgt_lang)
        elif file_ext == ".xlsx":
            document_utils.translate_xlsx(input_path, output_path, model_manager, actual_src, tgt_lang)
        elif file_ext == ".pdf":
            document_utils.translate_pdf(input_path, output_path, model_manager, actual_src, tgt_lang)
        
        jobs.job_manager.update_job(
            job_id, 
            status="completed", 
            progress=100, 
            result={
                "output_url": f"/api/download-file?session_id={session_id}&filename={output_filename}",
                "session_id": session_id,
                "filename": output_filename,
                "detected_src_lang": actual_src
            }
        )
    except Exception as e:
        print(f"[Error] Job {job_id}: {e}")
        jobs.job_manager.update_job(job_id, status="failed", error=str(e))

@app.post("/api/translate-document")
async def api_translate_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    src_lang: str = Form("English"),
    tgt_lang: str = Form("Hindi"),
    user=Depends(auth_mod.get_current_user)
):
    """
    Translate uploaded document (docx, pptx, xlsx, pdf) asynchronously
    """
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    filename = file.filename or "unknown"
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in [".docx", ".pptx", ".xlsx", ".pdf"]:
         raise HTTPException(status_code=400, detail=f"Unsupported file format: {file_ext}")

    input_path = os.path.join(session_dir, f"input{file_ext}")
    output_filename = f"translated_{filename}"
    output_path = os.path.join(session_dir, output_filename)
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    job_id = jobs.job_manager.create_job("document_translation")
    background_tasks.add_task(
        run_document_translation, 
        job_id, session_id, input_path, output_path, file_ext, src_lang, tgt_lang, output_filename
    )
    
    return {"job_id": job_id}

# Mount frontend build folder statically if it exists
frontend_dist = os.path.abspath(os.path.join(BASE_DIR, "../frontend/dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
