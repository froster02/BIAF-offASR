export default function DashboardTab({ setActiveTab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
  );
}
