import { useLang } from '../LanguageContext';

export default function Navbar({ activeTab, setActiveTab, isMenuOpen, setIsMenuOpen, isConnected }) {
  const { t, lang, setLang } = useLang();

  const navItems = [
    { id: 'dashboard', icon: '🏠', label: t('nav.dashboard') },
    { id: 'text',      icon: '✍️', label: t('nav.text') },
    { id: 'docs',      icon: '📄', label: t('nav.docs') },
    { id: 'audio',     icon: '🎵', label: t('nav.audio') },
    { id: 'video',     icon: '🎬', label: t('nav.video') },
    { id: 'settings',  icon: '⚙️', label: t('nav.settings') },
  ];

  const langOptions = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'mr', label: 'मराठी' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">🌾</div>
        <div className="navbar-title">
          <span className="navbar-title-main">{t('nav.brand')}</span>
          <span className="navbar-title-sub">{t('nav.brandSub')}</span>
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

      <div className="navbar-right">
        <div className="lang-selector">
          <span className="lang-globe">🌐</span>
          <select
            className="lang-dropdown"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            {langOptions.map(opt => (
              <option key={opt.code} value={opt.code}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className={`navbar-status ${isConnected ? 'online' : 'offline'}`}>
          <span className={`dot ${isConnected ? '' : 'offline'}`} />
          <span className="status-text">{isConnected ? t('nav.statusOnline') : t('nav.statusOffline')}</span>
        </div>
      </div>
    </nav>
  );
}
