import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [modelsStatus, setModelsStatus] = useState({
    is_cached: false,
    whisper_cached: false,
    nllb_cached: false,
    tts_cached: false,
    models_dir: ''
  });
  const [isConnected, setIsConnected] = useState(false);
  const [whisperSize, setWhisperSize] = useState('base');

  // Text Translation States
  const [textInput, setTextInput] = useState('');
  const [textOutput, setTextOutput] = useState('');
  const [textSrcLang, setTextSrcLang] = useState('English');
  const [textTgtLang, setTextTgtLang] = useState('Hindi');
  const [isTranslatingText, setIsTranslatingText] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);

  // Audio Translation States
  const [audioFile, setAudioFile] = useState(null);
  const [audioSrcLang, setAudioSrcLang] = useState('English');
  const [audioTgtLang, setAudioTgtLang] = useState('Hindi');
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioProgressText, setAudioProgressText] = useState('');
  const [audioResult, setAudioResult] = useState(null);
  const [audioActiveSubTab, setAudioActiveSubTab] = useState('translation');
  const audioFileInputRef = useRef(null);

  // Video Translation States
  const [videoFile, setVideoFile] = useState(null);
  const [videoSrcLang, setVideoSrcLang] = useState('English');
  const [videoTgtLang, setVideoTgtLang] = useState('Hindi');
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [overlayVoice, setOverlayVoice] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoProgressText, setVideoProgressText] = useState('');
  const [videoResult, setVideoResult] = useState(null);
  const videoFileInputRef = useRef(null);

  // Fetch model status from server
  const checkServerStatus = async () => {
    try {
      const res = await fetch('/api/models-status');
      if (res.ok) {
        const data = await res.json();
        setModelsStatus(data);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (e) {
      setIsConnected(false);
    }
  };

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 5000); // Check status every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle Text Translation
  const handleTextTranslate = async () => {
    if (!textInput.trim()) return;
    setIsTranslatingText(true);
    setTtsAudioUrl('');
    try {
      const res = await fetch('/api/translate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textInput,
          src_lang: textSrcLang,
          tgt_lang: textTgtLang
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTextOutput(data.translated_text);
      } else {
        alert('Translation failed. Please make sure the backend is running and models are loaded.');
      }
    } catch (e) {
      alert('Network error connecting to backend.');
    } finally {
      setIsTranslatingText(false);
    }
  };

  // Generate TTS for Text Output
  const handleTextToSpeech = async () => {
    if (!textOutput.trim()) return;
    setIsGeneratingTts(true);
    try {
      const res = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textOutput,
          lang: textTgtLang
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        setTtsAudioUrl(audioUrl);
      } else {
        alert('TTS Synthesis failed.');
      }
    } catch (e) {
      alert('Error generating TTS.');
    } finally {
      setIsGeneratingTts(false);
    }
  };

  // Handle Audio Upload & Processing
  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(file);
      setAudioResult(null);
    }
  };

  const processAudio = async () => {
    if (!audioFile) return;
    setIsProcessingAudio(true);
    setAudioProgress(10);
    setAudioProgressText('Uploading audio file and initializing pipeline...');
    
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model_size', whisperSize);
    formData.append('src_lang', audioSrcLang);
    formData.append('tgt_lang', audioTgtLang);

    try {
      // Simulate progress updates for a smoother visual feel
      const progressInterval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          if (prev >= 70) {
            setAudioProgressText('Translating text segments and synthesizing dubbing audio...');
            return prev + 1;
          }
          if (prev >= 40) {
            setAudioProgressText('Transcribing speech offline using Whisper ASR...');
            return prev + 2;
          }
          return prev + 5;
        });
      }, 800);

      const res = await fetch('/api/translate-audio', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);

      if (res.ok) {
        setAudioProgress(100);
        setAudioProgressText('Synthesis complete!');
        const data = await res.json();
        setAudioResult(data);
      } else {
        alert('Audio processing failed. Check backend logs.');
        setIsProcessingAudio(false);
      }
    } catch (e) {
      alert('Error connecting to backend.');
      setIsProcessingAudio(false);
    } finally {
      setTimeout(() => {
        setIsProcessingAudio(false);
        setAudioProgress(0);
      }, 1000);
    }
  };

  // Handle Video Upload & Processing
  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoResult(null);
    }
  };

  const processVideo = async () => {
    if (!videoFile) return;
    setIsProcessingVideo(true);
    setVideoProgress(5);
    setVideoProgressText('Uploading video track. Initializing workspace...');

    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('model_size', whisperSize);
    formData.append('src_lang', videoSrcLang);
    formData.append('tgt_lang', videoTgtLang);
    formData.append('burn_subtitles_option', burnSubtitles);
    formData.append('overlay_voice_option', overlayVoice);

    try {
      const progressInterval = setInterval(() => {
        setVideoProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          if (prev >= 75) {
            setVideoProgressText('Injecting subtitle layers and copying streams with FFmpeg...');
            return prev + 1;
          }
          if (prev >= 45) {
            setVideoProgressText('Translating timeline and rendering transcript overlays...');
            return prev + 2;
          }
          if (prev >= 20) {
            setVideoProgressText('Running speech-to-text extraction using Whisper...');
            return prev + 3;
          }
          return prev + 5;
        });
      }, 1000);

      const res = await fetch('/api/process-video', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);

      if (res.ok) {
        setVideoProgress(100);
        setVideoProgressText('Video processed successfully!');
        const data = await res.json();
        setVideoResult(data);
      } else {
        alert('Video processing failed. Verify that FFmpeg is installed.');
        setIsProcessingVideo(false);
      }
    } catch (e) {
      alert('Error connecting to video processing endpoint.');
      setIsProcessingVideo(false);
    } finally {
      setTimeout(() => {
        setIsProcessingVideo(false);
        setVideoProgress(0);
      }, 1000);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="brand-section">
          <div className="brand-logo">B</div>
          <div className="brand-name">BAIF OffASR</div>
        </div>

        <div className="nav-links">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span>🏠</span> Dashboard
          </button>
          <button 
            className={`nav-item ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            <span>✍️</span> Text Translate
          </button>
          <button 
            className={`nav-item ${activeTab === 'audio' ? 'active' : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            <span>🎵</span> Audio Translate
          </button>
          <button 
            className={`nav-item ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => setActiveTab('video')}
          >
            <span>🎬</span> Video Translate
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span>⚙️</span> Settings
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="status-label">Offline Node Status</div>
          <div className="status-indicator">
            <span className={`dot ${isConnected ? '' : 'offline'}`}></span>
            {isConnected ? 'Fully Connected' : 'Disconnected'}
          </div>
          {isConnected && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Models: {modelsStatus.is_cached ? '📦 Pre-cached' : '⚠️ Cloud Fetch'}
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="main-content">
        
        {/* Dynamic Headers */}
        <div className="header-container">
          <div>
            <h1 className="page-title">
              {activeTab === 'dashboard' && 'CSR Tech for Good Hub'}
              {activeTab === 'text' && 'Text Translator'}
              {activeTab === 'audio' && 'Speech & Audio Dubber'}
              {activeTab === 'video' && 'Video Subtitler & Dubber'}
              {activeTab === 'settings' && 'App Settings & Local Models'}
            </h1>
            <p className="page-subtitle">
              {activeTab === 'dashboard' && 'BAIF enterprise offline AI portal to bridge Indian regional language barriers.'}
              {activeTab === 'text' && 'Translate sentences instantly across Marathi, Hindi, and English.'}
              {activeTab === 'audio' && 'Transcribe audio tracks, translate texts, and synthesize spoken voiceovers.'}
              {activeTab === 'video' && 'Extract dialogue, burn-in subtitles, and replace spoken tracks on complex media files.'}
              {activeTab === 'settings' && 'Configure offline hardware capabilities and cache check states.'}
            </p>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Quick Overview Info Panel */}
            <div className="glass-card translator-grid">
              <div>
                <h2 style={{ marginBottom: '1rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '1.75rem' }}>
                  Bridging the Language Gap
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  This application empowers BAIF permanent colleagues and field workers to seamlessly translate educational and developmental resources. All tools execute **entirely locally** on BAIF servers, with zero licensing fees, zero internet requirements, and zero data leakage.
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-primary" onClick={() => setActiveTab('text')}>Start Translating</button>
                  <button className="btn btn-secondary" onClick={() => setActiveTab('settings')}>Check Models Cache</button>
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>System Capabilities</h3>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <li>✓ **Text Translation**: Distilled NLLB model optimized for regional Indian dialects.</li>
                  <li>✓ **Audio Transcriber**: Whisper base ASR for automatic audio chunking.</li>
                  <li>✓ **Synthesized Voice**: Meta Massively Multilingual Speech (MMS) VITS.</li>
                  <li>✓ **Subtitles Processing**: High-speed ffmpeg wrapper for burning SRT overlays.</li>
                </ul>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="list-grid">
              <div className="glass-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('text')}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✍️</div>
                <h3 style={{ marginBottom: '0.5rem' }}>Text Translation</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Fast, reliable, and completely offline text translations across Marathi, Devanagari Hindi, and English.</p>
              </div>
              <div className="glass-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('audio')}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎵</div>
                <h3 style={{ marginBottom: '0.5rem' }}>Audio Translation</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upload raw sound streams, translate, and generate natural regional text-to-speech voiceovers.</p>
              </div>
              <div className="glass-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('video')}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎬</div>
                <h3 style={{ marginBottom: '0.5rem' }}>Video Dubbing</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Process files to generate translated subtitle timelines (SRT/VTT) and render burned-in video captions.</p>
              </div>
            </div>
          </div>
        )}

        {/* Text Translation Tab */}
        {activeTab === 'text' && (
          <div className="glass-card">
            <div className="translator-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Source Language</label>
                <select className="select-control" value={textSrcLang} onChange={(e) => setTextSrcLang(e.target.value)}>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Marathi">Marathi</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Target Language</label>
                <select className="select-control" value={textTgtLang} onChange={(e) => setTextTgtLang(e.target.value)}>
                  <option value="Hindi">Hindi</option>
                  <option value="Marathi">Marathi</option>
                  <option value="English">English</option>
                </select>
              </div>
            </div>

            <div className="translator-grid" style={{ marginBottom: '2rem' }}>
              <div className="form-group">
                <label className="form-label">Enter Original Text</label>
                <textarea 
                  className="textarea-control"
                  placeholder="Type or paste sentences here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Translated Output</label>
                <div 
                  className="textarea-control"
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {textOutput || <span style={{ color: 'var(--text-muted)' }}>Translated text will appear here...</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="btn btn-primary"
                onClick={handleTextTranslate}
                disabled={isTranslatingText || !textInput.trim()}
              >
                {isTranslatingText ? 'Translating...' : '⚡ Translate Text'}
              </button>

              {textOutput && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(textOutput);
                      alert('Copied to clipboard!');
                    }}
                  >
                    📋 Copy Text
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={handleTextToSpeech}
                    disabled={isGeneratingTts}
                  >
                    {isGeneratingTts ? 'Generating Audio...' : '🔊 Speak Aloud (TTS)'}
                  </button>
                  {ttsAudioUrl && (
                    <audio src={ttsAudioUrl} controls autoPlay className="custom-audio-player" style={{ width: '220px', marginTop: 0 }} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio Translation Tab */}
        {activeTab === 'audio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-card translator-grid">
              {/* Left Column: Dropzone and Settings */}
              <div>
                <div className="form-group">
                  <label className="form-label">Select Languages</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From</span>
                      <select className="select-control" value={audioSrcLang} onChange={(e) => setAudioSrcLang(e.target.value)}>
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Marathi">Marathi</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>To</span>
                      <select className="select-control" value={audioTgtLang} onChange={(e) => setAudioTgtLang(e.target.value)}>
                        <option value="Hindi">Hindi</option>
                        <option value="Marathi">Marathi</option>
                        <option value="English">English</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div 
                  className="dropzone"
                  onClick={() => audioFileInputRef.current.click()}
                >
                  <div className="dropzone-icon">📥</div>
                  <div style={{ fontWeight: 600 }}>Click to browse audio files</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Supports MP3, WAV, AAC, M4A, FLAC, WMA, OGG
                  </div>
                  <input 
                    type="file"
                    ref={audioFileInputRef}
                    style={{ display: 'none' }}
                    accept="audio/*"
                    onChange={handleAudioUpload}
                  />
                </div>

                {audioFile && (
                  <div className="file-badge" style={{ marginTop: '1rem' }}>
                    <span>📄</span>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  </div>
                )}

                <button 
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1.5rem' }}
                  disabled={!audioFile || isProcessingAudio}
                  onClick={processAudio}
                >
                  {isProcessingAudio ? 'Processing Audio...' : '⚙️ Transcribe & Dub Audio'}
                </button>

                {isProcessingAudio && (
                  <div className="progress-panel">
                    <div className="progress-header">
                      <div className="processing-pulse">Processing...</div>
                      <div style={{ fontSize: '0.85rem' }}>{audioProgress}%</div>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${audioProgress}%` }}></div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {audioProgressText}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Processing Results */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1rem' }}>Dubbing Results</h3>
                
                {audioResult ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                    <div className="tab-header">
                      <button 
                        className={`tab-btn ${audioActiveSubTab === 'translation' ? 'active' : ''}`}
                        onClick={() => setAudioActiveSubTab('translation')}
                      >
                        Translated Dub
                      </button>
                      <button 
                        className={`tab-btn ${audioActiveSubTab === 'transcript' ? 'active' : ''}`}
                        onClick={() => setAudioActiveSubTab('transcript')}
                      >
                        Original Transcript
                      </button>
                    </div>

                    {audioActiveSubTab === 'translation' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                        <div 
                          style={{ 
                            background: 'rgba(255, 255, 255, 0.01)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '8px', 
                            padding: '1rem',
                            minHeight: '150px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontSize: '0.95rem'
                          }}
                        >
                          {audioResult.translated_text}
                        </div>

                        <div>
                          <label className="form-label" style={{ marginBottom: '0.25rem' }}>Dubbed Voice Audio</label>
                          <audio src={audioResult.translated_audio_url} controls className="custom-audio-player" style={{ marginTop: 0 }} />
                        </div>
                      </div>
                    ) : (
                      <div 
                        style={{ 
                          background: 'rgba(255, 255, 255, 0.01)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px', 
                          padding: '1rem',
                          minHeight: '200px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.95rem'
                        }}
                      >
                        {audioResult.source_text}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
                      <a 
                        className="btn btn-secondary" 
                        style={{ flex: 1, textDecoration: 'none' }}
                        href={audioResult.translated_audio_url} 
                        download={`dubbed_${audioTgtLang.lower()}_${audioFile.name}.wav`}
                      >
                        📥 Download Audio
                      </a>
                      <button 
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                        onClick={() => {
                          const text = audioActiveSubTab === 'translation' ? audioResult.translated_text : audioResult.source_text;
                          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `${audioActiveSubTab}_transcript.txt`;
                          link.click();
                        }}
                      >
                        📥 Download Text
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    style={{ 
                      flexGrow: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: '1px dashed var(--border-color)',
                      borderRadius: '12px',
                      color: 'var(--text-muted)',
                      minHeight: '250px'
                    }}
                  >
                    No processed audio file yet. Upload and click dub!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Video Translation Tab */}
        {activeTab === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-card translator-grid">
              {/* Left Column: Dropzone and settings */}
              <div>
                <div className="form-group">
                  <label className="form-label">Translation Directions</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From</span>
                      <select className="select-control" value={videoSrcLang} onChange={(e) => setVideoSrcLang(e.target.value)}>
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Marathi">Marathi</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>To</span>
                      <select className="select-control" value={videoTgtLang} onChange={(e) => setVideoTgtLang(e.target.value)}>
                        <option value="Hindi">Hindi</option>
                        <option value="Marathi">Marathi</option>
                        <option value="English">English</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div 
                  className="dropzone"
                  onClick={() => videoFileInputRef.current.click()}
                  style={{ padding: '2.5rem 2rem' }}
                >
                  <div className="dropzone-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>🎬</div>
                  <div style={{ fontWeight: 600 }}>Click to browse video files</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Supports MP4, MOV, AVI, WMV, MKV, FLV, WebM
                  </div>
                  <input 
                    type="file"
                    ref={videoFileInputRef}
                    style={{ display: 'none' }}
                    accept="video/*"
                    onChange={handleVideoUpload}
                  />
                </div>

                {videoFile && (
                  <div className="file-badge" style={{ marginTop: '1rem' }}>
                    <span>🎥</span>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <div className="switch-container">
                    <div className="switch-label-group">
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Burn-in Subtitles</span>
                      <span className="switch-subtext">Renders translated text directly onto the video frames.</span>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={burnSubtitles} onChange={(e) => setBurnSubtitles(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="switch-container">
                    <div className="switch-label-group">
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Voice Dubbing Overlay</span>
                      <span className="switch-subtext">Overlay synthetic voiceover and mute original track.</span>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={overlayVoice} onChange={(e) => setOverlayVoice(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>

                <button 
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1.5rem' }}
                  disabled={!videoFile || isProcessingVideo}
                  onClick={processVideo}
                >
                  {isProcessingVideo ? 'Processing Video...' : '⚡ Process & Dub Video'}
                </button>

                {isProcessingVideo && (
                  <div className="progress-panel">
                    <div className="progress-header">
                      <div className="processing-pulse" style={{ color: '#8b5cf6' }}>Rendering...</div>
                      <div style={{ fontSize: '0.85rem' }}>{videoProgress}%</div>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${videoProgress}%`, background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}></div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {videoProgressText}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Video Output */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1rem' }}>Output Preview</h3>

                {videoResult ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flexGrow: 1 }}>
                    <video src={videoResult.video_url} controls className="custom-video-player" />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                      <label className="form-label" style={{ marginBottom: '0.5rem' }}>Synchronized Subtitle Segments</label>
                      <div className="subtitle-editor">
                        {videoResult.translated_srt.split('\n\n').filter(Boolean).map((block, idx) => {
                          const lines = block.split('\n');
                          const timing = lines[1] || '';
                          const text = lines.slice(2).join(' ') || '';
                          return (
                            <div className="subtitle-segment" key={idx}>
                              <div className="sub-time">{timing.split(' --> ')[0].slice(3, 8)} ➔ {timing.split(' --> ')[1]?.slice(3, 8)}</div>
                              <div className="sub-text">{text}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
                      <a 
                        className="btn btn-primary" 
                        style={{ flex: 1, textDecoration: 'none' }}
                        href={videoResult.video_url} 
                        download={`translated_${videoTgtLang.lower()}_${videoFile.name}`}
                      >
                        📥 Download Video (.mp4)
                      </a>
                      <a 
                        className="btn btn-secondary" 
                        style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                        href={videoResult.srt_url} 
                        download={`subtitles_${videoTgtLang.lower()}_${videoFile.name.split('.')[0]}.srt`}
                      >
                        📄 Download SRT Subs
                      </a>
                    </div>
                  </div>
                ) : (
                  <div 
                    style={{ 
                      flexGrow: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: '1px dashed var(--border-color)',
                      borderRadius: '12px',
                      color: 'var(--text-muted)',
                      minHeight: '350px'
                    }}
                  >
                    No processed video file yet. Upload and click dub!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Offline Model Cache Config</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Select preferred models sizing and verify files are cached locally for 100% offline air-gapped system.
              </p>

              <div className="form-group" style={{ maxWidth: '400px' }}>
                <label className="form-label">Speech-To-Text Whisper Size</label>
                <select className="select-control" value={whisperSize} onChange={(e) => setWhisperSize(e.target.value)}>
                  <option value="tiny">Whisper Tiny (Fastest, ~75MB)</option>
                  <option value="base">Whisper Base (Recommended Balanced, ~140MB)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Smaller models execute dramatically faster on CPU-only machines.
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Offline Files Checklist</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🎙️ Speech-to-Text Model (Whisper)</span>
                  <span style={{ fontWeight: 600, color: modelsStatus.whisper_cached ? 'var(--accent-success)' : '#f59e0b' }}>
                    {modelsStatus.whisper_cached ? '✓ Cached Locally' : '✗ Missing / Cloud fetch'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🔤 Text Translation Model (NLLB-200 600M)</span>
                  <span style={{ fontWeight: 600, color: modelsStatus.nllb_cached ? 'var(--accent-success)' : '#f59e0b' }}>
                    {modelsStatus.nllb_cached ? '✓ Cached Locally' : '✗ Missing / Cloud fetch'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🔊 Text-to-Speech regional Synthesizers (MMS-TTS)</span>
                  <span style={{ fontWeight: 600, color: modelsStatus.tts_cached ? 'var(--accent-success)' : '#f59e0b' }}>
                    {modelsStatus.tts_cached ? '✓ Cached Locally' : '✗ Missing / Cloud fetch'}
                  </span>
                </div>
                
                {modelsStatus.models_dir && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    **Cache Storage Path**: `{modelsStatus.models_dir}`
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-primary" onClick={checkServerStatus}>🔄 Refresh Status</button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  alert("To pre-download all files for fully offline use, run the download script:\n\npython backend/download_models.py");
                }}
              >
                📦 Pre-download offline weights instructions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
