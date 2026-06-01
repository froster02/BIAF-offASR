import { useRef } from 'react';
import { useLang } from '../LanguageContext';

export default function DocumentTranslationTab({
  docFile, handleDocUpload,
  docSrcLang, setDocSrcLang,
  docTgtLang, setDocTgtLang,
  isProcessingDoc, processDoc,
  docResult,
}) {
  const { t } = useLang();
  const docFileInputRef = useRef(null);

  return (
    <div className="glass-card">
      <div className="translator-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label">{t('docs.srcLang')}</label>
          <select className="select-control" value={docSrcLang} onChange={(e) => setDocSrcLang(e.target.value)}>
            <option value="auto">✨ {t('docs.auto')}</option>
            <option value="English">🇬🇧 {t('docs.english')}</option>
            <option value="Hindi">🇮🇳 {t('docs.hindi')}</option>
            <option value="Marathi">🇮🇳 {t('docs.marathi')}</option>
          </select>
          {docResult?.detected_src_lang && (
            <div style={{ fontSize: '0.75rem', color: 'var(--green-dark)', marginTop: '0.25rem', fontWeight: 600 }}>
              ✨ {t('text.detected')}: {docResult.detected_src_lang}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">{t('docs.tgtLang')}</label>
          <select className="select-control" value={docTgtLang} onChange={(e) => setDocTgtLang(e.target.value)}>
            <option value="Hindi">{t('docs.hindi')}</option>
            <option value="Marathi">{t('docs.marathi')}</option>
            <option value="English">{t('docs.english')}</option>
          </select>
        </div>
      </div>

      <div
        className="dropzone"
        onClick={() => docFileInputRef.current.click()}
        style={{ marginBottom: '1.5rem' }}
      >
        <div className="dropzone-icon">📄</div>
        <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{t('docs.browse')}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('docs.supported')}</div>
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
        {isProcessingDoc ? `⏳ ${t('docs.processing')}` : `⚡ ${t('docs.translate')}`}
      </button>

      {docResult && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <div className="status-ok" style={{ marginBottom: '1rem' }}>✓ {t('docs.complete')}</div>
          <a
            href={docResult.output_url}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
            download
          >
            📥 {t('docs.download')} {docFile?.name?.split('.').pop()?.toUpperCase()}
          </a>
        </div>
      )}
    </div>
  );
}
