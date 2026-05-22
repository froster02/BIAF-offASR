import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import models
import subtitles

app = FastAPI(title="BAIF Offline Translation API", version="1.0.0")

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
def get_models_status():
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

@app.post("/api/translate-text")
def translate_text(req: TranslationRequest):
    """
    Translate text using offline NLLB-200 model
    """
    try:
        translated = model_manager.translate(req.text, req.src_lang, req.tgt_lang)
        return {"translated_text": translated}
    except Exception as e:
        print(f"[Error] /api/translate-text: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe-audio")
async def transcribe_audio(
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    language: str = Form("English")
):
    """
    Transcribe uploaded audio or video file using offline Whisper
    """
    # Create unique session folder
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1].lower()
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
    tgt_lang: str = Form("Hindi")
):
    """
    Transcribe and translate an audio or video file
    """
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1].lower()
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
        
        # Translate the full text
        translated_text = model_manager.translate(
            text=transcription_result["text"],
            src_lang=src_lang,
            tgt_lang=tgt_lang
        )
        
        # Batch translate all segments to construct translated subtitles
        seg_texts = [seg["text"] for seg in transcription_result["segments"]]
        translated_texts = model_manager.translate_batch(
            texts=seg_texts,
            src_lang=src_lang,
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
        
        # Generate translated TTS audio for the output text
        tts_output_filename = f"tts_{tgt_lang.lower()}.wav"
        tts_output_path = os.path.join(session_dir, tts_output_filename)
        model_manager.text_to_speech(translated_text, tgt_lang, tts_output_path)
        
        return {
            "source_text": transcription_result["text"],
            "translated_text": translated_text,
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
def text_to_speech(req: TTSRequest):
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

@app.post("/api/process-video")
async def process_video(
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    src_lang: str = Form("English"),
    tgt_lang: str = Form("Hindi"),
    burn_subtitles_option: bool = Form(True),
    overlay_voice_option: bool = Form(False)
):
    """
    Complete video translation pipeline: transcribe, translate, burn subtitles, and/or replace voice over.
    """
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    input_path = os.path.join(session_dir, f"input{file_ext}")
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # 1. Extract audio for ASR
        audio_path = os.path.join(session_dir, "extracted_audio.wav")
        subtitles.extract_audio(input_path, audio_path)
        
        # 2. Transcribe
        transcription_result = model_manager.transcribe(
            audio_path=audio_path,
            size=model_size,
            language=src_lang
        )
        
        # 3. Batch translate all segments & construct SRT
        seg_texts = [seg["text"] for seg in transcription_result["segments"]]
        translated_texts = model_manager.translate_batch(
            texts=seg_texts,
            src_lang=src_lang,
            tgt_lang=tgt_lang
        )
        
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
            
        # 5. Handle audio overlay if selected
        if overlay_voice_option:
            print("[*] Generating voiceover and overlaying...")
            # Translate full text
            full_translated_text = model_manager.translate(
                text=transcription_result["text"],
                src_lang=src_lang,
                tgt_lang=tgt_lang
            )
            # Synthesize
            tts_audio_path = os.path.join(session_dir, "tts_voiceover.wav")
            model_manager.text_to_speech(full_translated_text, tgt_lang, tts_audio_path)
            
            # Overlay new audio track
            final_video_path = os.path.join(session_dir, "translated_final.mp4")
            subtitles.overlay_audio_on_video(current_video_stream, tts_audio_path, final_video_path)
            output_video_filename = "translated_final.mp4"
        else:
            # If only burning subtitles (or doing nothing)
            if burn_subtitles_option:
                output_video_filename = "burned_subtitles.mp4"
            else:
                # Fallback to copy input if nothing selected
                output_video_filename = f"input{file_ext}"
                
        return {
            "source_text": transcription_result["text"],
            "translated_text": model_manager.translate(transcription_result["text"], src_lang, tgt_lang) if overlay_voice_option else "",
            "translated_srt": translated_srt,
            "video_url": f"/api/download-file?session_id={session_id}&filename={output_video_filename}",
            "srt_url": f"/api/download-file?session_id={session_id}&filename=translated_subs.srt",
            "session_id": session_id
        }
        
    except Exception as e:
        print(f"[Error] /api/process-video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        
    return FileResponse(file_path, media_type=media_type, filename=filename)

# Mount frontend build folder statically if it exists
frontend_dist = os.path.abspath(os.path.join(BASE_DIR, "../frontend/dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
    print(f"[*] Mounted static frontend files from: {frontend_dist}")
else:
    print("[!] Frontend distribution folder not found. Serving API endpoints only.")
