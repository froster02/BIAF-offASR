import pytest
from fastapi.testclient import TestClient
from backend.app import app
import os
import shutil

client = TestClient(app)

def get_auth_headers():
    """Helper to get auth headers for testing."""
    payload = {"username": "admin", "password": "admin123"}
    response = client.post("/api/login", json=payload)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_get_models_status():
    """Test the models status endpoint."""
    headers = get_auth_headers()
    response = client.get("/api/models-status", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "is_cached" in data
    assert "whisper_cached" in data
    assert "nllb_cached" in data
    assert "tts_cached" in data

def test_translate_text_api():
    """Test the text translation API (integration)."""
    headers = get_auth_headers()
    payload = {
        "text": "Hello world",
        "src_lang": "English",
        "tgt_lang": "Hindi"
    }
    response = client.post("/api/translate-text", json=payload, headers=headers)
    assert response.status_code == 200
    assert "translated_text" in response.json()

def test_download_file_not_found():
    """Test the download endpoint with invalid file."""
    response = client.get("/api/download-file?session_id=invalid&filename=nonexistent.wav")
    assert response.status_code == 404
