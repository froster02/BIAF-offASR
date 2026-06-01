import { useLang } from '../LanguageContext';

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
  const { t } = useLang();

  return (
    <div className="glass-card">
      <div className="translator-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{t('text.srcLang')}</label>
          <select className="select-control" value={textSrcLang} onChange={(e) => setTextSrcLang(e.target.value)}>
            <option value="auto">✨ {t('text.auto')}</option>
            <option value="English">🇬🇧 {t('text.english')}</option>
            <option value="Hindi">🇮🇳 {t('text.hindi')}</option>
            <option value="Marathi">🇮🇳 {t('text.marathi')}</option>
          </select>
          {detectedTextLang && (
            <div style={{ fontSize: '0.75rem', color: 'var(--green-dark)', marginTop: '0.25rem', fontWeight: 600 }}>
              ✨ {t('text.detected')}: {detectedTextLang}
            </div>
          )}
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{t('text.tgtLang')}</label>
          <select className="select-control" value={textTgtLang} onChange={(e) => setTextTgtLang(e.target.value)}>
            <option value="Hindi">🇮🇳 {t('text.hindi')}</option>
            <option value="Marathi">🇮🇳 {t('text.marathi')}</option>
            <option value="English">🇬🇧 {t('text.english')}</option>
          </select>
        </div>
      </div>

      <div className="translator-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{t('text.input')}</label>
          <textarea
            className="textarea-control"
            placeholder={t('text.inputPlaceholder')}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{t('text.output')}</label>
          <div className="textarea-control output-box" style={{ cursor: 'default' }}>
            {textOutput
              ? textOutput
              : <span className="output-box-placeholder">{t('text.outputPlaceholder')}</span>
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
          {isTranslatingText ? `⏳ ${t('text.translating')}` : `⚡ ${t('text.translate')}`}
        </button>

        {textOutput && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => { navigator.clipboard.writeText(textOutput); alert('Copied!'); }}
            >
              📋 {t('text.copy')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleTextToSpeech}
              disabled={isGeneratingTts}
            >
              {isGeneratingTts ? `⏳ ${t('text.ttsGenerating')}` : `🔊 ${t('text.tts')}`}
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
