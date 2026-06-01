import { useRef } from 'react';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function AudioTranslationTab({
  audioFile, handleAudioUpload,
  audioSrcLang, setAudioSrcLang,
  audioTgtLang, setAudioTgtLang,
  isProcessingAudio, processAudio,
  audioProgress, audioProgressText,
  audioResult, audioActiveSubTab, setAudioActiveSubTab,
  isRecording, startRecording, stopRecording, recordingTime,
}) {
  const audioFileInputRef = useRef(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-card translator-grid">
        <div>
          <div className="form-group">
            <label className="form-label">Select Languages</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>From</span>
                <select className="select-control" value={audioSrcLang} onChange={(e) => setAudioSrcLang(e.target.value)}>
                  <option value="auto">✨ Auto Detect</option>
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

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button
              className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessingAudio}
            >
              {isRecording ? (
                <><span className="recording-pulse">🔴</span> Stop ({formatTime(recordingTime)})</>
              ) : (
                <>🎤 Start Recording</>
              )}
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => audioFileInputRef.current.click()}
              disabled={isRecording || isProcessingAudio}
            >
              📁 Upload File
            </button>
            <input
              type="file"
              ref={audioFileInputRef}
              style={{ display: 'none' }}
              accept="audio/*"
              onChange={handleAudioUpload}
            />
          </div>

          {audioFile && !isRecording && (
            <div className="file-badge" style={{ marginBottom: '1.5rem' }}>
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

                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem' }}>
                    <label className="form-label" style={{ marginBottom: '0.5rem' }}>Translated Timeline</label>
                    <div className="subtitle-editor" style={{ maxHeight: '200px' }}>
                      {audioResult.translated_segments?.map((seg, idx) => (
                        <div className="subtitle-segment" key={idx}>
                          <div className="sub-time">
                            {new Date(seg.start * 1000).toISOString().substr(14, 5)} ➔ {new Date(seg.end * 1000).toISOString().substr(14, 5)}
                          </div>
                          <div className="sub-text">{seg.text}</div>
                        </div>
                      ))}
                    </div>
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
                  download={`dubbed_${audioTgtLang}_${audioFile?.name}.wav`}
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
  );
}
