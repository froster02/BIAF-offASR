import os
import subprocess
import shutil

def format_time(seconds, is_vtt=False):
    """
    Format seconds (float) into HH:MM:SS,mmm (SRT) or HH:MM:SS.mmm (VTT)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    
    sep = "." if is_vtt else ","
    return f"{hours:02d}:{minutes:02d}:{secs:02d}{sep}{millis:03d}"

def generate_srt(segments):
    """
    Convert Whisper segments to SRT string
    """
    lines = []
    for i, seg in enumerate(segments, start=1):
        start_str = format_time(seg["start"], is_vtt=False)
        end_str = format_time(seg["end"], is_vtt=False)
        text = seg["text"].strip()
        lines.append(f"{i}")
        lines.append(f"{start_str} --> {end_str}")
        lines.append(text)
        lines.append("")  # Empty line separator
    return "\n".join(lines)

def generate_vtt(segments):
    """
    Convert Whisper segments to VTT string
    """
    lines = ["WEBVTT", ""]
    for seg in segments:
        start_str = format_time(seg["start"], is_vtt=True)
        end_str = format_time(seg["end"], is_vtt=True)
        text = seg["text"].strip()
        lines.append(f"{start_str} --> {end_str}")
        lines.append(text)
        lines.append("")  # Empty line separator
    return "\n".join(lines)

def run_ffmpeg_command(cmd, cwd=None):
    """
    Safely run an FFmpeg command and check for errors
    """
    # Verify ffmpeg is available
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg executable not found in system PATH. Please install FFmpeg.")
        
    print(f"[*] Running FFmpeg: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=cwd,
        text=True
    )
    
    if result.returncode != 0:
        print(f"[✗] FFmpeg Error: {result.stderr}")
        raise RuntimeError(f"FFmpeg failed with return code {result.returncode}: {result.stderr}")
    return True

def extract_audio(video_path, audio_output_path):
    """
    Extract audio track from a video and convert to standard 16kHz mono WAV for Whisper ASR
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        audio_output_path
    ]
    run_ffmpeg_command(cmd)
    return audio_output_path

def burn_subtitles(video_path, srt_path, output_path):
    """
    Burn subtitles into a video file.
    To avoid complex absolute path escaping issues in FFmpeg's subtitle filter,
    we copy the SRT file and the video to the same directory, run FFmpeg using
    relative paths inside that directory, and move the final result back.
    """
    video_dir = os.path.dirname(os.path.abspath(video_path))
    video_name = os.path.basename(video_path)
    srt_name = os.path.basename(srt_path)
    output_name = os.path.basename(output_path)
    
    # We will copy the SRT file to the video directory if it isn't there already
    temp_srt_copied = False
    target_srt_in_dir = os.path.join(video_dir, srt_name)
    if os.path.abspath(srt_path) != os.path.abspath(target_srt_in_dir):
        shutil.copy2(srt_path, target_srt_in_dir)
        temp_srt_copied = True
        
    try:
        # In FFmpeg, subtitle filter paths are tricky. 
        # Using relative paths within the working directory (cwd) is the most robust cross-platform solution.
        cmd = [
            "ffmpeg", "-y",
            "-i", video_name,
            "-vf", f"subtitles={srt_name}",
            "-c:a", "copy",  # Copy audio stream without re-encoding to save time
            output_name
        ]
        
        run_ffmpeg_command(cmd, cwd=video_dir)
        
        # If the output path was supposed to go elsewhere, move it
        final_output_path = os.path.abspath(output_path)
        generated_output = os.path.join(video_dir, output_name)
        if os.path.abspath(generated_output) != final_output_path:
            shutil.move(generated_output, final_output_path)
            
    finally:
        # Cleanup copied srt file if needed
        if temp_srt_copied and os.path.exists(target_srt_in_dir):
            os.remove(target_srt_in_dir)
            
    return output_path

def overlay_audio_on_video(video_path, audio_path, output_path):
    """
    Overlay a translated audio track onto a video track, replacing original audio.
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", audio_path,
        "-map", "0:v",         # Use video stream from first input (video)
        "-map", "1:a",         # Use audio stream from second input (new audio)
        "-c:v", "copy",        # Copy video codec (zero rendering latency)
        "-acodec", "aac",      # Compress new audio to modern standard AAC format
        "-shortest",           # Trim streams to shortest length
        output_path
    ]
    run_ffmpeg_command(cmd)
    return output_path
