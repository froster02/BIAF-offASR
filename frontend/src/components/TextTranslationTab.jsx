export default function TextTranslationTab({
  textInput, setTextInput,
  textOutput,
  textSrcLang, setTextSrcLang,
  textTgtLang, setTextTgtLang,
  detectedTextLang,
  isTranslatingText, handleTextTranslate,
  ttsAudioUrl,
  isGeneratingTts, handleTextToSpeech,
}) {
  return (
    <div className="glass-card">
      <div className="translator-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Source Language</label>
          <select className="select-control" value={textSrcLang} onChange={(e) => {
            setTextSrcLang(e.target.value);
          }}>
            <option value="auto">✨ Auto Detect</option>
            <option value="English">🇬🇧 English</option>
            <option value="Hindi">🇮🇳 Hindi (हिन्दी)</option>
            <option value="Marathi">🇮🇳 Marathi (मराठी)</option>
          </select>
          {detectedTextLang && (
            <div style={{ fontSize: '0.75rem', color: 'var(--green-dark)', marginTop: '0.25rem', fontWeight: 600 }}>
              ✨ Detected: {detectedTextLang}
            </div>
          )}
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
  );
}
