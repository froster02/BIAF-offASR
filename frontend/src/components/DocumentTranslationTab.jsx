import { useRef } from 'react';

export default function DocumentTranslationTab({
  docFile, handleDocUpload,
  docSrcLang, setDocSrcLang,
  docTgtLang, setDocTgtLang,
  isProcessingDoc, processDoc,
  docResult,
}) {
  const docFileInputRef = useRef(null);

  return (
    <div className="glass-card">
      <div className="translator-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label">Source Language</label>
          <select className="select-control" value={docSrcLang} onChange={(e) => setDocSrcLang(e.target.value)}>
            <option value="auto">✨ Auto Detect</option>
            <option value="English">🇬🇧 English</option>
            <option value="Hindi">🇮🇳 Hindi (हिन्दी)</option>
            <option value="Marathi">🇮🇳 Marathi (मराठी)</option>
          </select>
          {docResult?.detected_src_lang && (
            <div style={{ fontSize: '0.75rem', color: 'var(--green-dark)', marginTop: '0.25rem', fontWeight: 600 }}>
              ✨ Detected: {docResult.detected_src_lang}
            </div>
          )}
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
            📥 Download Translated {docFile?.name?.split('.').pop()?.toUpperCase()}
          </a>
        </div>
      )}
    </div>
  );
}
