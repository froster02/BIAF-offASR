import pytest
import os
import shutil
import tempfile
from unittest.mock import MagicMock, patch
from backend.models import ModelManager

@pytest.fixture
def temp_models_dir():
    """Create a temporary directory for models."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def model_manager(temp_models_dir):
    """Initialize ModelManager with a temporary cache directory."""
    return ModelManager(cache_dir=temp_models_dir)

def test_model_manager_init(temp_models_dir):
    """Test initialization and device selection."""
    manager = ModelManager(cache_dir=temp_models_dir)
    assert manager.cache_dir == os.path.abspath(temp_models_dir)
    assert manager.device in ["cuda", "mps", "cpu"]
    assert os.environ["HF_HOME"] == os.path.join(os.path.abspath(temp_models_dir), "hf_cache")

def test_translate_empty_text(model_manager):
    """should_return_empty_string_when_empty_text_provided"""
    assert model_manager.translate("", "English", "Hindi") == ""
    assert model_manager.translate("   ", "English", "Hindi") == ""

def test_translate_unsupported_language(model_manager):
    """should_raise_value_error_when_unsupported_language_provided"""
    with pytest.raises(ValueError, match="Unsupported translation languages"):
        model_manager.translate("Hello", "English", "Spanish")

def test_translate_same_language(model_manager):
    """should_return_original_text_when_src_and_tgt_lang_are_same"""
    text = "Hello world"
    assert model_manager.translate(text, "English", "English") == text

def test_translate_batch_empty_list(model_manager):
    """should_return_empty_list_when_empty_list_provided"""
    assert model_manager.translate_batch([], "English", "Hindi") == []

def test_translate_batch_whitespace_only(model_manager):
    """should_preserve_whitespace_when_batch_translating"""
    texts = ["", "  ", "\t"]
    results = model_manager.translate_batch(texts, "English", "Hindi")
    assert results == texts

def test_tts_empty_text(model_manager):
    """should_raise_value_error_when_empty_text_provided_for_tts"""
    with pytest.raises(ValueError, match="Empty text provided for TTS"):
        model_manager.text_to_speech("", "English", "out.wav")

def test_tts_unsupported_language(model_manager):
    """should_raise_value_error_when_unsupported_language_provided_for_tts"""
    with pytest.raises(ValueError, match="Unsupported TTS language"):
        model_manager.text_to_speech("Hello", "Spanish", "out.wav")
