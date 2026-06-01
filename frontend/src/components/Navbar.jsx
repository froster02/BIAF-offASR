export default function Navbar({ activeTab, setActiveTab, isMenuOpen, setIsMenuOpen, isConnected, auth, handleLogout }) {
  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'text',      icon: '✍️', label: 'Text Translate' },
    { id: 'docs',      icon: '📄', label: 'Documents' },
    { id: 'audio',     icon: '🎵', label: 'Audio Dub' },
    { id: 'video',     icon: '🎬', label: 'Video Dub' },
    { id: 'settings',  icon: '⚙️', label: 'Settings' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">🌾</div>
        <div className="navbar-title">
          <span className="navbar-title-main">OfflineASR</span>
          <span className="navbar-title-sub">Offline AI Translation</span>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {auth && (
          <button className="btn btn-outline-white" onClick={handleLogout} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            🚪 Logout ({auth.role})
          </button>
        )}
        <div className={`navbar-status ${isConnected ? 'online' : 'offline'}`}>
          <span className={`dot ${isConnected ? '' : 'offline'}`} />
          <span className="status-text">{isConnected ? 'Connected' : 'Offline'}</span>
        </div>
      </div>
    </nav>
  );
}
