"""FFmpeg-backed media processing: audio extraction, subtitle burn-in, audio
overlay, all run as argument-list subprocesses (never shell=True — no command
injection surface from user-controlled filenames) through a bounded worker
pool.

The pool is intentionally small (default 2): each ffmpeg invocation already
saturates several CPU threads on its own, and capping concurrent ffmpeg
processes is what actually keeps total RSS inside the 7GB ceiling when a
video job runs alongside Whisper/IndicTrans2 — unbounded concurrency here is
the most likely source of the "Python memory growth" the brief warns about,
since each in-flight subprocess.run() holds its stdout/stderr buffers (here
bounded by PIPE + immediate .communicate(), never accumulated across calls).
"""
import logging
import os
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger("dyansetu.media_processor")

DEFAULT_MAX_CONCURRENT_FFMPEG = 2
_pool = ThreadPoolExecutor(max_workers=DEFAULT_MAX_CONCURRENT_FFMPEG, thread_name_prefix="ffmpeg-worker")


def format_time(seconds, is_vtt=False):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    sep = "." if is_vtt else ","
    return f"{hours:02d}:{minutes:02d}:{secs:02d}{sep}{millis:03d}"


def generate_srt(segments) -> str:
    lines = []
    for i, seg in enumerate(segments, start=1):
        lines.append(str(i))
        lines.append(f"{format_time(seg['start'])} --> {format_time(seg['end'])}")
        lines.append(seg["text"].strip())
        lines.append("")
    return "\n".join(lines)


def generate_vtt(segments) -> str:
    lines = ["WEBVTT", ""]
    for seg in segments:
        lines.append(f"{format_time(seg['start'], is_vtt=True)} --> {format_time(seg['end'], is_vtt=True)}")
        lines.append(seg["text"].strip())
        lines.append("")
    return "\n".join(lines)


def _run_ffmpeg(cmd: list, cwd: str = None):
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg executable not found in system PATH.")
    logger.info("Running FFmpeg: %s", " ".join(cmd))
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg failed (exit {proc.returncode}): {proc.stderr}")
    return True


def submit_ffmpeg(cmd: list, cwd: str = None):
    """Queue an ffmpeg invocation on the bounded worker pool; returns a Future."""
    return _pool.submit(_run_ffmpeg, cmd, cwd)


def extract_audio(video_path: str, audio_output_path: str, wait: bool = True):
    cmd = ["ffmpeg", "-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", audio_output_path]
    future = submit_ffmpeg(cmd)
    if wait:
        future.result()
    return audio_output_path if wait else future


def burn_subtitles(video_path: str, srt_path: str, output_path: str):
    """Relative-path trick avoids FFmpeg's subtitle-filter path-escaping issues
    on Windows (drive letters/backslashes inside the filter string)."""
    video_dir = os.path.dirname(os.path.abspath(video_path))
    video_name = os.path.basename(video_path)
    srt_name = os.path.basename(srt_path)
    output_name = os.path.basename(output_path)

    target_srt_in_dir = os.path.join(video_dir, srt_name)
    copied = False
    if os.path.abspath(srt_path) != os.path.abspath(target_srt_in_dir):
        shutil.copy2(srt_path, target_srt_in_dir)
        copied = True

    try:
        cmd = ["ffmpeg", "-y", "-i", video_name, "-vf", f"subtitles={srt_name}", "-c:a", "copy", output_name]
        submit_ffmpeg(cmd, cwd=video_dir).result()

        generated = os.path.join(video_dir, output_name)
        final_output = os.path.abspath(output_path)
        if os.path.abspath(generated) != final_output:
            shutil.move(generated, final_output)
    finally:
        if copied and os.path.exists(target_srt_in_dir):
            os.remove(target_srt_in_dir)

    return output_path


