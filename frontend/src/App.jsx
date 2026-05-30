import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('baif_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [modelsStatus, setModelsStatus] = useState({
    is_cached: false,
    whisper_cached: false,
    nllb_cached: false,
    tts_cached: false,
    models_dir: ''
  });
  const [isConnected, setIsConnected] = useState(true);
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Document Translation States
  const [docFile, setDocFile] = useState(null);
  const [docSrcLang, setDocSrcLang] = useState('English');
  const [docTgtLang, setDocTgtLang] = useState('Hindi');
  const [isProcessingDoc, setIsProcessingDoc] = useState(false);
  const [docResult, setDocResult] = useState(null);
  const docFileInputRef = useRef(null);
  const videoFileInputRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        const data = await res.json();
        setAuth(data);
        localStorage.setItem('baif_auth', JSON.stringify(data));
      } else {
        alert('Invalid credentials');
      }
    } catch (e) {
      alert('Login error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem('baif_auth');
    setActiveTab('dashboard');
  };

  // Helper for authenticated fetch
  const authFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${auth?.access_token}`
    };
    return fetch(url, { ...options, headers });
  };

  // Fetch model status from server
  const checkServerStatus = async () => {
    if (!auth) return;
    try {
      const res = await authFetch('/api/models-status');
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
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle Text Translation
  const handleTextTranslate = async () => {
    if (!textInput.trim()) return;
    setIsTranslatingText(true);
    setTtsAudioUrl('');
    try {
      const res = await authFetch('/api/translate-text', {
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
      const res = await authFetch('/api/text-to-speech', {
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
      const progressInterval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 90) { clearInterval(progressInterval); return prev; }
          if (prev >= 70) { setAudioProgressText('Translating text segments and synthesizing dubbing audio...'); return prev + 1; }
          if (prev >= 40) { setAudioProgressText('Transcribing speech offline using Whisper ASR...'); return prev + 2; }
          return prev + 5;
        });
      }, 800);

      const res = await authFetch('/api/translate-audio', {
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

  const pollJob = async (job_id, onSuccess, onFail, onProgress) => {
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/jobs/${job_id}`);
        if (res.ok) {
          const job = await res.json();
          if (onProgress) onProgress(job.progress, job.status);
          
          if (job.status === 'completed') {
            clearInterval(interval);
            onSuccess(job.result);
          } else if (job.status === 'failed') {
            clearInterval(interval);
            onFail(job.error || 'Job failed');
          }
        } else {
          clearInterval(interval);
          onFail('Error checking job status');
        }
      } catch (e) {
        clearInterval(interval);
        onFail('Network error checking job status');
      }
    }, 2000);
    return interval;
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
      const res = await authFetch('/api/process-video', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const { job_id } = await res.json();
        pollJob(
          job_id,
          (result) => {
            setVideoResult(result);
            setVideoProgress(100);
            setVideoProgressText('Video processed successfully!');
            setTimeout(() => {
              setIsProcessingVideo(false);
              setVideoProgress(0);
            }, 1000);
          },
          (error) => {
            alert(`Video processing failed: ${error}`);
            setIsProcessingVideo(false);
          },
          (progress, status) => {
            setVideoProgress(progress);
            if (status === 'processing') {
              if (progress < 40) setVideoProgressText('Running speech-to-text extraction using Whisper...');
              else if (progress < 70) setVideoProgressText('Translating timeline and rendering transcript overlays...');
              else setVideoProgressText('Injecting subtitle layers and copying streams with FFmpeg...');
            }
          }
        );
      } else {
        alert('Video processing failed to start.');
        setIsProcessingVideo(false);
      }
    } catch (e) {
      alert('Error connecting to video processing endpoint.');
      setIsProcessingVideo(false);
    }
  };

  // Handle Document Upload & Processing
  const handleDocUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDocFile(file);
      setDocResult(null);
    }
  };

  const processDoc = async () => {
    if (!docFile) return;
    setIsProcessingDoc(true);

    const formData = new FormData();
    formData.append('file', docFile);
    formData.append('src_lang', docSrcLang);
    formData.append('tgt_lang', docTgtLang);

    try {
      const res = await authFetch('/api/translate-document', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const { job_id } = await res.json();
        pollJob(
          job_id,
          (result) => {
            setDocResult(result);
            setIsProcessingDoc(false);
          },
          (error) => {
            alert(`Document translation failed: ${error}`);
            setIsProcessingDoc(false);
          }
        );
      } else {
        alert('Document translation failed to start.');
        setIsProcessingDoc(false);
      }
    } catch (e) {
      alert('Error connecting to backend.');
      setIsProcessingDoc(false);
    }
  };

  // Nav items config
  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'text',      icon: '✍️', label: 'Text Translate' },
    { id: 'docs',      icon: '📄', label: 'Documents' },
    { id: 'audio',     icon: '🎵', label: 'Audio Dub' },
    { id: 'video',     icon: '🎬', label: 'Video Dub' },
    { id: 'settings',  icon: '⚙️', label: 'Settings' },
  ];

  const pageTitles = {
    dashboard: 'CSR Translation Hub',
    text:      'Text Translator',
    docs:      'Document Translator',
    audio:     'Speech & Audio Dubber',
    video:     'Video Subtitler & Dubber',
    settings:  'App Settings & Local Models',
  };

  const pageSubtitles = {
    dashboard: 'An enterprise offline AI portal — bridging Indian regional language barriers.',
    text:      'Translate sentences instantly across Marathi, Hindi, and English.',
    docs:      'Translate Word, PowerPoint, Excel, and PDF files while preserving formatting.',
    audio:     'Transcribe audio tracks, translate texts, and synthesize spoken voiceovers.',
    video:     'Extract dialogue, burn-in subtitles, and replace spoken tracks on media files.',
    settings:  'Configure offline hardware capabilities and model cache states.',
  };

  return (
    <div className="app-container">

      {/* ── Top Navigation Bar ── */}
      <nav className="navbar">
        {/* Brand */}
        <div className="navbar-brand">
          <div className="navbar-logo">🌾</div>
          <div className="navbar-title">
            <span className="navbar-title-main">OfflineASR</span>
            <span className="navbar-title-sub">Offline AI Translation</span>
          </div>
        </div>

        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? '✕' : '☰'}
        </button>

        <div className="navbar-divider" />

        {/* Nav Links */}
        <div className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                setIsMenuOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {auth && (
            <button className="btn btn-outline-white" onClick={handleLogout} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              🚪 Logout ({auth.role})
            </button>
          )}
          <div className={`navbar-status ${isConnected ? 'online' : 'offline'}`}>
            <span className={`dot ${isConnected ? '' : 'offline'}`} />
            <span className="status-text">{isConnected ? 'Connected' : 'Offline'}</span>
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className="main-content">
        {!auth ? (
          <div className="glass-card" style={{ maxWidth: '400px', margin: '4rem auto', padding: '2.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌾</div>
              <h2 className="page-title" style={{ fontSize: '1.5rem' }}>BAIF Offline Portal</h2>
              <p className="page-subtitle">Authorized Access Only</p>
            </div>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="select-control"
                  style={{ width: '100%', padding: '0.6rem' }}
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="admin or user"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="select-control"
                  style={{ width: '100%', padding: '0.6rem' }}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? '🔐 Verifying...' : '🔑 Login to Portal'}
              </button>
            </form>
            <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Default credentials: admin/admin123 or user/user123
            </div>
          </div>
        ) : (
          <>
            {/* Page Header */}
        <div className="header-container">
          <h1 className="page-title">{pageTitles[activeTab]}</h1>
          <p className="page-subtitle">{pageSubtitles[activeTab]}</p>
        </div>

        {/* ════════════════════════════════════════
            DASHBOARD TAB
        ════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Hero Banner */}
            <div className="hero-banner">
              <div className="hero-badge">🌾 Offline AI Translation Portal</div>
              <h2 className="hero-title">Bridging the Language Gap for Rural India</h2>
              <p className="hero-subtitle">
                This portal empowers field workers and colleagues to seamlessly translate
                educational and development resources across Hindi, Marathi, and English —
                entirely offline, with zero internet requirements and zero data leakage.
              </p>
              <div className="hero-actions">
                <button className="btn btn-outline-white" onClick={() => setActiveTab('text')}>
                  ✍️ Start Translating
                </button>
                <button className="btn btn-outline-white" onClick={() => setActiveTab('settings')}>
                  ⚙️ Check Model Cache
                </button>
              </div>

              <div className="hero-stats">
                <div className="hero-stat">
                  <div className="hero-stat-value">3</div>
                  <div className="hero-stat-label">Indian Languages</div>
                </div>
              </div>
            </div>

            {/* Capabilities Grid + System Info */}
            <div className="translator-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="section-title">What you can do</div>
                <div className="capabilities-grid">
                  <div className="capability-card" onClick={() => setActiveTab('text')}>
                    <div className="capability-icon">✍️</div>
                    <div className="capability-title">Text Translation</div>
                    <div className="capability-desc">Fast, offline text translation between Marathi, Hindi, and English.</div>
                  </div>
                  <div className="capability-card" onClick={() => setActiveTab('docs')}>
                    <div className="capability-icon">📄</div>
                    <div className="capability-title">Document Translation</div>
                    <div className="capability-desc">Translate Word, PowerPoint, Excel, and PDF while preserving formatting.</div>
                  </div>
                  <div className="capability-card" onClick={() => setActiveTab('audio')}>
                    <div className="capability-icon">🎵</div>
                    <div className="capability-title">Audio Translation</div>
                    <div className="capability-desc">Upload audio, transcribe it, and generate natural regional voiceovers.</div>
                  </div>
                  <div className="capability-card" onClick={() => setActiveTab('video')}>
                    <div className="capability-icon">🎬</div>
                    <div className="capability-title">Video Dubbing</div>
                    <div className="capability-desc">Process video files to generate translated subtitles and burned-in captions.</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="section-title">System Capabilities</div>
                <div className="system-info-card">
                  <ul className="system-info-list">
                    <li>Text Translation via Meta NLLB-200 distilled Seq2Seq model optimized for Indian languages.</li>
                    <li>Document Processing for DOCX, PPTX, XLSX, and PDF with format-preserving logic.</li>
                    <li>Audio Transcription using OpenAI Whisper ASR with automatic chunking & segmentation.</li>
                    <li>Synthesized Voice via Meta MMS VITS text-to-speech for Hindi, Marathi & English.</li>
                    <li>Subtitle Processing through a high-speed FFmpeg wrapper for SRT/VTT burn-in.</li>
                    <li>Thread-safe concurrent access using reentrant RLock on all PyTorch models.</li>
                    <li>2.42x batch translation speedup via vectorized NLLB padding on Apple Silicon MPS.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            TEXT TRANSLATION TAB
        ════════════════════════════════════════ */}
        {activeTab === 'text' && (
          <div className="glass-card">
            {/* Language Selectors */}
            <div className="translator-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Source Language</label>
                <select className="select-control" value={textSrcLang} onChange={(e) => setTextSrcLang(e.target.value)}>
                  <option value="auto">✨ Auto Detect</option>
                  <option value="English">🇬🇧 English</option>
                  <option value="Hindi">🇮🇳 Hindi (हिन्दी)</option>
                  <option value="Marathi">🇮🇳 Marathi (मराठी)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Language</label>
                <select className="select-control" value={textTgtLang} onChange={(e) => setTextTgtLang(e.target.value)}>
                  <option value="Hindi">🇮🇳 Hindi (हिन्दी)</option>
                  <option value="Marathi">🇮🇳 Marathi (मराठी)</option>
                  <option value="English">🇬🇧 English</option>
                </select>
              </div>
            </div>

            {/* Text Areas */}
            <div className="translator-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Original Text</label>
                <textarea
                  className="textarea-control"
                  placeholder="Type or paste your text here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Translated Output</label>
                <div
                  className="textarea-control output-box"
                  style={{ cursor: 'default' }}
                >
                  {textOutput
                    ? textOutput
                    : <span className="output-box-placeholder">Translated text will appear here...</span>
                  }
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleTextTranslate}
                disabled={isTranslatingText || !textInput.trim()}
              >
                {isTranslatingText ? '⏳ Translating...' : '⚡ Translate Text'}
              </button>

              {textOutput && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => { navigator.clipboard.writeText(textOutput); alert('Copied to clipboard!'); }}
                  >
                    📋 Copy Text
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleTextToSpeech}
                    disabled={isGeneratingTts}
                  >
                    {isGeneratingTts ? '⏳ Generating...' : '🔊 Speak Aloud (TTS)'}
                  </button>
                  {ttsAudioUrl && (
                    <audio src={ttsAudioUrl} controls autoPlay className="custom-audio-player" style={{ width: '220px', marginTop: 0 }} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            DOCUMENT TRANSLATION TAB
        ════════════════════════════════════════ */}
        {activeTab === 'docs' && (
          <div className="glass-card">
            <div className="translator-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Source Language</label>
                <select className="select-control" value={docSrcLang} onChange={(e) => setDocSrcLang(e.target.value)}>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Marathi">Marathi</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Target Language</label>
                <select className="select-control" value={docTgtLang} onChange={(e) => setDocTgtLang(e.target.value)}>
                  <option value="Hindi">Hindi</option>
                  <option value="Marathi">Marathi</option>
                  <option value="English">English</option>
                </select>
              </div>
            </div>

            <div 
              className="dropzone" 
              onClick={() => docFileInputRef.current.click()}
              style={{ marginBottom: '1.5rem' }}
            >
              <div className="dropzone-icon">📄</div>
              <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>Click to upload documents</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supports .docx, .pptx, .xlsx, .pdf</div>
              <input
                type="file"
                ref={docFileInputRef}
                style={{ display: 'none' }}
                accept=".docx,.pptx,.xlsx,.pdf"
                onChange={handleDocUpload}
              />
            </div>

            {docFile && (
              <div className="file-badge" style={{ marginBottom: '1.5rem' }}>
                <span>📄</span>
                <div>{docFile.name} ({(docFile.size / (1024 * 1024)).toFixed(2)} MB)</div>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={!docFile || isProcessingDoc}
              onClick={processDoc}
            >
              {isProcessingDoc ? '⏳ Processing Document...' : '⚡ Translate Document'}
            </button>

            {docResult && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <div className="status-ok" style={{ marginBottom: '1rem' }}>✓ Translation Complete!</div>
                <a 
                  href={docResult.output_url} 
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                  download
                >
                  📥 Download Translated {docFile.name.split('.').pop().toUpperCase()}
                </a>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            AUDIO TRANSLATION TAB
        ════════════════════════════════════════ */}
        {activeTab === 'audio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-card translator-grid">
              {/* Left: Dropzone & Settings */}
              <div>
                <div className="form-group">
                  <label className="form-label">Select Languages</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>From</span>
                      <select className="select-control" value={audioSrcLang} onChange={(e) => setAudioSrcLang(e.target.value)}>
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Marathi">Marathi</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>To</span>
                      <select className="select-control" value={audioTgtLang} onChange={(e) => setAudioTgtLang(e.target.value)}>
                        <option value="Hindi">Hindi</option>
                        <option value="Marathi">Marathi</option>
                        <option value="English">English</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="dropzone" onClick={() => audioFileInputRef.current.click()}>
                  <div className="dropzone-icon">📥</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>Click to browse audio files</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supports MP3, WAV, AAC, M4A, FLAC, OGG</div>
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
                    <span>🎵</span>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1.25rem' }}
                  disabled={!audioFile || isProcessingAudio}
                  onClick={processAudio}
                >
                  {isProcessingAudio ? '⏳ Processing Audio...' : '⚙️ Transcribe & Dub Audio'}
                </button>

                {isProcessingAudio && (
                  <div className="progress-panel">
                    <div className="progress-header">
                      <div className="processing-pulse">🔄 Processing...</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--green-dark)' }}>{audioProgress}%</div>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${audioProgress}%` }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {audioProgressText}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Results */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="section-title">Dubbing Results</div>

                {audioResult ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                    <div className="tab-header">
                      <button
                        className={`tab-btn ${audioActiveSubTab === 'translation' ? 'active' : ''}`}
                        onClick={() => setAudioActiveSubTab('translation')}
                      >Translated Dub</button>
                      <button
                        className={`tab-btn ${audioActiveSubTab === 'transcript' ? 'active' : ''}`}
                        onClick={() => setAudioActiveSubTab('transcript')}
                      >Original Transcript</button>
                    </div>

                    {audioActiveSubTab === 'translation' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                        <div className="output-box" style={{ minHeight: '130px', maxHeight: '200px' }}>
                          {audioResult.translated_text}
                        </div>
                        <div>
                          <label className="form-label" style={{ marginBottom: '0.25rem' }}>Dubbed Voice Audio</label>
                          <audio src={audioResult.translated_audio_url} controls className="custom-audio-player" style={{ marginTop: 0 }} />
                        </div>
                      </div>
                    ) : (
                      <div className="output-box" style={{ minHeight: '200px' }}>
                        {audioResult.source_text}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                      <a
                        className="btn btn-secondary"
                        style={{ flex: 1, textDecoration: 'none' }}
                        href={audioResult.translated_audio_url}
                        download={`dubbed_${audioTgtLang}_${audioFile.name}.wav`}
                      >📥 Download Audio</a>
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
                      >📥 Download Text</button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🎵</div>
                    <span>Upload an audio file and click Dub to get started.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            VIDEO TRANSLATION TAB
        ════════════════════════════════════════ */}
        {activeTab === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-card translator-grid">
              {/* Left: Dropzone & Settings */}
              <div>
                <div className="form-group">
                  <label className="form-label">Translation Direction</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>From</span>
                      <select className="select-control" value={videoSrcLang} onChange={(e) => setVideoSrcLang(e.target.value)}>
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Marathi">Marathi</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>To</span>
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
                  <div className="dropzone-icon">🎬</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>Click to browse video files</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supports MP4, MOV, AVI, WMV, MKV, WebM</div>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <div className="switch-container">
                    <div className="switch-label-group">
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>Burn-in Subtitles</span>
                      <span className="switch-subtext">Renders translated text directly onto the video frames.</span>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={burnSubtitles} onChange={(e) => setBurnSubtitles(e.target.checked)} />
                      <span className="slider" />
                    </label>
                  </div>

                  <div className="switch-container">
                    <div className="switch-label-group">
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>Voice Dubbing Overlay</span>
                      <span className="switch-subtext">Overlay synthetic voiceover and mute original track.</span>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={overlayVoice} onChange={(e) => setOverlayVoice(e.target.checked)} />
                      <span className="slider" />
                    </label>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1.25rem' }}
                  disabled={!videoFile || isProcessingVideo}
                  onClick={processVideo}
                >
                  {isProcessingVideo ? '⏳ Processing Video...' : '⚡ Process & Dub Video'}
                </button>

                {isProcessingVideo && (
                  <div className="progress-panel">
                    <div className="progress-header">
                      <div className="processing-pulse">🎞️ Rendering...</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--green-dark)' }}>{videoProgress}%</div>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${videoProgress}%` }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {videoProgressText}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Video Output */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="section-title">Output Preview</div>

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
                              <div className="sub-time">{timing.split(' --> ')[0]?.slice(3, 8)} ➔ {timing.split(' --> ')[1]?.slice(3, 8)}</div>
                              <div className="sub-text">{text}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                      <a
                        className="btn btn-primary"
                        style={{ flex: 1, textDecoration: 'none' }}
                        href={videoResult.video_url}
                        download={`translated_${videoTgtLang}_${videoFile.name}`}
                      >📥 Download Video (.mp4)</a>
                      <a
                        className="btn btn-secondary"
                        style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                        href={videoResult.srt_url}
                        download={`subtitles_${videoTgtLang}_${videoFile.name.split('.')[0]}.srt`}
                      >📄 Download SRT Subs</a>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🎬</div>
                    <span>Upload a video file and click Process to get started.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            SETTINGS TAB
        ════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Whisper Model Size */}
            <div>
              <div className="section-title">Speech-to-Text Model Configuration</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Select preferred Whisper model size for audio and video transcription.
                Smaller models execute faster on CPU-only hardware.
              </p>
              <div className="form-group" style={{ maxWidth: '440px' }}>
                <label className="form-label">Whisper ASR Model Size</label>
                <select className="select-control" value={whisperSize} onChange={(e) => setWhisperSize(e.target.value)}>
                  <option value="tiny">Whisper Tiny — Fastest (~75MB)</option>
                  <option value="base">Whisper Base — Recommended Balanced (~140MB)</option>
                </select>
              </div>
            </div>

            {/* System Performance & Cost */}
            <div style={{ borderTop: '1.5px solid var(--border-color)', paddingTop: '1.75rem' }}>
              <div className="section-title">System Performance & Cost</div>
              <div className="capabilities-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="system-info-card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--green-dark)' }}>100%</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Offline Capable</div>
                </div>
                <div className="system-info-card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--green-dark)' }}>0</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>API Fees</div>
                </div>
              </div>
            </div>

            {/* Model Cache Checklist */}
            <div style={{ borderTop: '1.5px solid var(--border-color)', paddingTop: '1.75rem' }}>
              <div className="section-title">Offline Node Status</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Verify all model weights are cached locally for 100% offline, air-gapped operation.
              </p>
              <div className="checklist-card">
                <div className="checklist-item">
                  <span className="checklist-item-label">🖥️ Backend Server</span>
                  <span className={isConnected ? 'status-ok' : 'status-warn'}>
                    {isConnected ? '✓ Connected' : '✗ Offline'}
                  </span>
                </div>
                <div className="checklist-item">
                  <span className="checklist-item-label">📦 Model Cache</span>
                  <span className={modelsStatus.is_cached ? 'status-ok' : 'status-warn'}>
                    {modelsStatus.is_cached ? '✓ Pre-cached' : '⚠ Cloud Fetch'}
                  </span>
                </div>
                <div className="checklist-item" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
                  <span className="checklist-item-label">🎙️ Speech-to-Text Model (Whisper)</span>
                  <span className={modelsStatus.whisper_cached ? 'status-ok' : 'status-warn'}>
                    {modelsStatus.whisper_cached ? '✓ Cached Locally' : '✗ Missing'}
                  </span>
                </div>
                <div className="checklist-item">
                  <span className="checklist-item-label">🔤 Text Translation Model (NLLB-200)</span>
                  <span className={modelsStatus.nllb_cached ? 'status-ok' : 'status-warn'}>
                    {modelsStatus.nllb_cached ? '✓ Cached Locally' : '✗ Missing'}
                  </span>
                </div>
                <div className="checklist-item">
                  <span className="checklist-item-label">🔊 Text-to-Speech Synthesizers (MMS-TTS)</span>
                  <span className={modelsStatus.tts_cached ? 'status-ok' : 'status-warn'}>
                    {modelsStatus.tts_cached ? '✓ Cached Locally' : '✗ Missing'}
                  </span>
                </div>
                {modelsStatus.models_dir && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.875rem', marginTop: '0.25rem' }}>
                    📁 Cache path: <code style={{ background: 'var(--green-pale)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>{modelsStatus.models_dir}</code>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={checkServerStatus}>🔄 Refresh Status</button>
              <button
                className="btn btn-secondary"
                onClick={() => alert('To pre-download all files for fully offline use, run the download script:\n\npython backend/download_models.py')}
              >📦 Pre-download Offline Weights</button>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <div className="footer-brand">
          <span>🌾</span>
          Offline Translation Portal
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} All rights reserved.</div>
      </footer>
    </div>
  );
}

export default App;
