import { useLang } from '../LanguageContext';

export default function SettingsTab({
  whisperSize, setWhisperSize,
  isConnected, modelsStatus,
  checkServerStatus,
}) {
  const { t } = useLang();

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <div className="section-title">{t('settings.whisperConfig')}</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          {t('settings.whisperDesc')}
        </p>
        <div className="form-group" style={{ maxWidth: '440px' }}>
          <label className="form-label">{t('settings.whisperLabel')}</label>
          <select className="select-control" value={whisperSize} onChange={(e) => setWhisperSize(e.target.value)}>
            <option value="tiny">{t('settings.whisperTiny')}</option>
            <option value="base">{t('settings.whisperBase')}</option>
          </select>
        </div>
      </div>

      <div style={{ borderTop: '1.5px solid var(--border-color)', paddingTop: '1.75rem' }}>
        <div className="section-title">{t('settings.performance')}</div>
        <div className="capabilities-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="system-info-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--green-dark)' }}>100%</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('settings.offlineCapable')}</div>
          </div>
          <div className="system-info-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--green-dark)' }}>0</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('settings.noFees')}</div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1.5px solid var(--border-color)', paddingTop: '1.75rem' }}>
        <div className="section-title">{t('settings.offlineStatus')}</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          {t('settings.offlineDesc')}
        </p>
        <div className="checklist-card">
          <div className="checklist-item">
            <span className="checklist-item-label">🖥️ {t('settings.server')}</span>
            <span className={isConnected ? 'status-ok' : 'status-warn'}>
              {isConnected ? `✓ ${t('settings.connected')}` : `✗ ${t('settings.offline')}`}
            </span>
          </div>
          <div className="checklist-item">
            <span className="checklist-item-label">📦 {t('settings.cache')}</span>
            <span className={modelsStatus.is_cached ? 'status-ok' : 'status-warn'}>
              {modelsStatus.is_cached ? `✓ ${t('settings.precached')}` : `⚠ ${t('settings.cloudFetch')}`}
            </span>
          </div>
          <div className="checklist-item" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
            <span className="checklist-item-label">🎙️ {t('settings.whisperCache')}</span>
            <span className={modelsStatus.whisper_cached ? 'status-ok' : 'status-warn'}>
              {modelsStatus.whisper_cached ? `✓ ${t('settings.cached')}` : `✗ ${t('settings.missing')}`}
            </span>
          </div>
          <div className="checklist-item">
            <span className="checklist-item-label">🔤 {t('settings.nllbCache')}</span>
            <span className={modelsStatus.nllb_cached ? 'status-ok' : 'status-warn'}>
              {modelsStatus.nllb_cached ? `✓ ${t('settings.cached')}` : `✗ ${t('settings.missing')}`}
            </span>
          </div>
          <div className="checklist-item">
            <span className="checklist-item-label">🔊 {t('settings.ttsCache')}</span>
            <span className={modelsStatus.tts_cached ? 'status-ok' : 'status-warn'}>
              {modelsStatus.tts_cached ? `✓ ${t('settings.cached')}` : `✗ ${t('settings.missing')}`}
            </span>
          </div>
          {modelsStatus.models_dir && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.875rem', marginTop: '0.25rem' }}>
              📁 {t('settings.ckptPath')}: <code style={{ background: 'var(--green-pale)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>{modelsStatus.models_dir}</code>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={checkServerStatus}>🔄 {t('settings.refresh')}</button>
        <button
          className="btn btn-secondary"
          onClick={() => alert(t('settings.predownloadAlert'))}
        >📦 {t('settings.predownload')}</button>
      </div>
    </div>
  );
}
