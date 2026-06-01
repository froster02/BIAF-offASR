import { useLang } from '../LanguageContext';

export default function DashboardTab({ setActiveTab }) {
  const { t } = useLang();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="hero-banner">
        <div className="hero-badge">🌾 {t('dash.heroBadge')}</div>
        <h2 className="hero-title">{t('dash.heroTitle')}</h2>
        <p className="hero-subtitle">{t('dash.heroSub')}</p>
        <div className="hero-actions">
          <button className="btn btn-outline-white" onClick={() => setActiveTab('text')}>
            ✍️ {t('dash.heroTranslate')}
          </button>
          <button className="btn btn-outline-white" onClick={() => setActiveTab('settings')}>
            ⚙️ {t('dash.heroStatus')}
          </button>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-value">3</div>
            <div className="hero-stat-label">{t('dash.languages')}</div>
          </div>
        </div>
      </div>

      <div className="translator-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="section-title">{t('dash.whatYouCanDo')}</div>
          <div className="capabilities-grid">
            <div className="capability-card" onClick={() => setActiveTab('text')}>
              <div className="capability-icon">✍️</div>
              <div className="capability-title">{t('dash.capText')}</div>
              <div className="capability-desc">{t('dash.capTextDesc')}</div>
            </div>
            <div className="capability-card" onClick={() => setActiveTab('docs')}>
              <div className="capability-icon">📄</div>
              <div className="capability-title">{t('dash.capDocs')}</div>
              <div className="capability-desc">{t('dash.capDocsDesc')}</div>
            </div>
            <div className="capability-card" onClick={() => setActiveTab('audio')}>
              <div className="capability-icon">🎵</div>
              <div className="capability-title">{t('dash.capAudio')}</div>
              <div className="capability-desc">{t('dash.capAudioDesc')}</div>
            </div>
            <div className="capability-card" onClick={() => setActiveTab('video')}>
              <div className="capability-icon">🎬</div>
              <div className="capability-title">{t('dash.capVideo')}</div>
              <div className="capability-desc">{t('dash.capVideoDesc')}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="section-title">{t('dash.systemCap')}</div>
          <div className="system-info-card">
            <ul className="system-info-list">
              <li>{t('dash.sysNLLB')}</li>
              <li>{t('dash.sysDocs')}</li>
              <li>{t('dash.sysWhisper')}</li>
              <li>{t('dash.sysTTS')}</li>
              <li>{t('dash.sysSubs')}</li>
              <li>{t('dash.sysThread')}</li>
              <li>{t('dash.sysBatch')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
