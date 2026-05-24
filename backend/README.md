# ⚙️ Offline Translation Engine — FastAPI Backend

The backend is a robust, high-performance API built with **FastAPI** and **PyTorch**. It manages the lifecycle of offline AI models, media processing pipelines via FFmpeg, and provides a secure, thread-safe interface for the frontend.

---

## 🧠 AI Model Suite

The system is designed to run entirely offline. All model weights are cached locally in the `models/` directory.

*   **ASR (Speech-to-Text)**: OpenAI **Whisper** (Tiny/Base).
    *   Handles multi-lingual transcription with timestamps.
    *   Optimized with automated chunking for long-form audio.
*   **Translation**: Meta **NLLB-200** (distilled-600M).
    *   Supports high-quality translation between English, Hindi, and Marathi.
    *   Uses **Vectorized Batching** for 2.4x faster performance.
*   **TTS (Text-to-Speech)**: Meta **MMS (Massively Multilingual Speech)**.
    *   VITS-based architectures for English, Hindi, and Marathi.
    *   Produces natural-sounding speech sampled at 16,000Hz.

---

## 🚀 Key Features

*   **Parallel Processing**: Implements `ModelManager.translate_batch()` to process multiple segments concurrently.
*   **Thread Safety**: Uses a reentrant lock (`RLock`) to ensure stable inference on shared hardware (especially Apple Silicon MPS).
*   **Media Pipelines**: Deeply integrates with **FFmpeg** for:
    *   Audio extraction from video.
    *   Hard-burning translated subtitles into video frames.
    *   Overlaying synthesized voiceovers onto existing video tracks.
*   **Session Management**: Generates unique session IDs and isolated workspaces in `temp/` to prevent cross-user data leakage.

---

## 🛠️ API Reference

### Core Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/models-status` | Returns the local cache status of all AI models. |
| `POST` | `/api/translate-text` | Translates a single string of text. |
| `POST` | `/api/transcribe-audio` | Transcribes audio/video; returns SRT/VTT. |
| `POST` | `/api/translate-audio` | Full audio translation + TTS synthesis. |
| `POST` | `/api/process-video` | Full video dubbing pipeline (Subtitles + Voiceover). |
| `GET` | `/api/download-file` | Securely serves processed media files. |

Detailed Swagger documentation is available at `http://localhost:8000/docs` when the server is running.

---

## 📁 File Structure

*   **`app.py`**: Main FastAPI application and routing logic.
*   **`models.py`**: The `ModelManager` class—handles PyTorch inference and batching.
*   **`subtitles.py`**: Utilities for FFmpeg processing and SRT/VTT generation.
*   **`download_models.py`**: Utility script to pre-fetch model weights for offline use.
*   **`test_pipeline.py`**: Comprehensive regression suite for backend verification.
*   **`requirements.txt`**: Python dependencies (optimized for CPU/MPS).

---

## 🧪 Local Verification

Run the test suite to verify model loading and inference performance:
```bash
python backend/test_pipeline.py
```
This script validates hardware acceleration (CUDA/MPS), translation accuracy, and TTS audio generation.
