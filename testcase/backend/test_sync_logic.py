import os
import numpy as np
import soundfile as sf
import pytest
from backend.subtitles import merge_audio_segments

class MockModelManager:
    def __init__(self):
        self.ci_mode = True
    
    def text_to_speech(self, text, lang, output_path):
        # Generate 2 seconds of dummy audio (32000 samples at 16kHz)
        # This is longer than our target segments to trigger the speed-up logic
        data = np.random.uniform(-1, 1, 32000)
        sf.write(output_path, data, 16000)

def test_merge_audio_segments_alignment():
    # Setup
    session_dir = "test_session_sync"
    os.makedirs(session_dir, exist_ok=True)
    model_manager = MockModelManager()
    
    # Segments: 
    # 1. 0s to 1s (target 1s)
    # 2. 2s to 3s (target 1s)
    segments = [
        {"start": 0.0, "end": 1.0, "text": "Segment 1"},
        {"start": 2.0, "end": 3.0, "text": "Segment 2"}
    ]
    
    try:
        output_path = merge_audio_segments(segments, session_dir, model_manager, "Hindi")
        
        assert os.path.exists(output_path)
        data, sr = sf.read(output_path)
        assert sr == 16000
        
        # Expected length:
        # Segment 1 (1s) + Silence (1s) + Segment 2 (1s) = 3s total
        # Samples: 3 * 16000 = 48000
        # Allow small margin for rounding in resampling
        assert 47900 <= len(data) <= 48100
        
        # Verify silence in the middle (roughly 1s to 2s)
        # data[16000:32000] should be silence
        silence_part = data[16500:31500]
        assert np.all(silence_part == 0)
        
        # Verify non-silence in the segments
        assert np.any(data[0:15000] != 0)
        assert np.any(data[33000:47000] != 0)
        
    finally:
        if os.path.exists(session_dir):
            import shutil
            shutil.rmtree(session_dir)

if __name__ == "__main__":
    test_merge_audio_segments_alignment()
