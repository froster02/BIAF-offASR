export default function LoginForm({ loginForm, setLoginForm, handleLogin, isLoggingIn }) {
  return (
    <div className="glass-card" style={{ maxWidth: '400px', margin: '4rem auto', padding: '2.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌾</div>
        <h2 className="page-title" style={{ fontSize: '1.5rem' }}>BAIF Offline Portal</h2>
        <p className="page-subtitle">Authorized Access Only</p>
      </div>
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="select-control"
            style={{ width: '100%', padding: '0.6rem' }}
            value={loginForm.username}
            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
            placeholder="admin or user"
            required
          />
        </div>
        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label">Password</label>
          <input
            type="password"
            className="select-control"
            style={{ width: '100%', padding: '0.6rem' }}
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            placeholder="••••••••"
            required
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? '🔐 Verifying...' : '🔑 Login to Portal'}
        </button>
      </form>
      <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Default credentials: admin/admin123 or user/user123
      </div>
    </div>
  );
}
