export default function SettingsTab({
  whisperSize, setWhisperSize,
  isConnected, modelsStatus,
  checkServerStatus,
}) {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={checkServerStatus}>🔄 Refresh Status</button>
        <button
          className="btn btn-secondary"
          onClick={() => alert('To pre-download all files for fully offline use, run the download script:\n\npython backend/download_models.py')}
        >📦 Pre-download Offline Weights</button>
      </div>
    </div>
  );
}
