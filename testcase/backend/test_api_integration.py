import pytest
from fastapi.testclient import TestClient
from backend.app import app
import os
import shutil

client = TestClient(app)

def test_get_models_status():
    """Test the models status endpoint."""
    response = client.get("/api/models-status")
    assert response.status_code == 200
    data = response.json()
    assert "is_cached" in data
    assert "whisper_cached" in data
    assert "nllb_cached" in data
    assert "tts_cached" in data

def test_translate_text_api():
    """Test the text translation API (integration)."""
    # Note: This will actually load the model if not cached, 
    # but since it's a small distilled model, it should be fine in a dev environment.
    payload = {
        "text": "Hello world",
        "src_lang": "English",
        "tgt_lang": "Hindi"
    }
    response = client.post("/api/translate-text", json=payload)
    assert response.status_code == 200
    assert "translated_text" in response.json()

def test_download_file_not_found():
    """Test the download endpoint with invalid file."""
    response = client.get("/api/download-file?session_id=invalid&filename=nonexistent.wav")
    assert response.status_code == 404
