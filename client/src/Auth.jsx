import React, { useState } from 'react';
import { Shield, User, Lock, Key, LogIn, UserPlus, AlertCircle, Activity } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

function Auth({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (isRegister && isAdmin && !adminCode.trim()) {
      setError('Admin Secret Code is required to register as Admin.');
      return;
    }

    setLoading(true);
    const endpoint = isRegister ? '/api/auth/signup' : '/api/auth/login';
    const payload = {
      username: username.trim(),
      password: password
    };

    if (isRegister && isAdmin) {
      payload.isAdmin = true;
      payload.adminCode = adminCode.trim();
    }

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      // Save credentials in App state (handled by parent callback)
      onLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Server connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setUsername('');
    setPassword('');
    setIsAdmin(false);
    setAdminCode('');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '1rem'
    }}>
      <div className="card highlighted animate-fade-in" style={{
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 12px 40px rgba(99, 102, 241, 0.15)',
        border: '1px solid var(--card-border-glow)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.12)',
            color: 'var(--primary)',
            padding: '0.75rem',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.25rem',
            boxShadow: '0 0 15px var(--primary-glow)'
          }}>
            <Activity size={28} className="logo-icon" />
          </div>
          <h2 className="card-title" style={{ fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="card-subtitle" style={{ fontSize: '0.875rem' }}>
            {isRegister ? 'Join LivePoll to participate in realtime feedback' : 'Sign in to access your polling dashboard'}
          </p>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div className="info-banner animate-slide-down" style={{ 
            background: 'rgba(239, 68, 68, 0.08)', 
            border: '1px solid rgba(239, 68, 68, 0.25)', 
            borderLeft: '4px solid var(--danger)',
            color: '#f87171' 
          }}>
            <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '0.1rem' }} />
            <div style={{ fontSize: '0.8rem' }}>{error}</div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Registration Role Options */}
          {isRegister && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
              <label className="flex-align-center" style={{ 
                cursor: 'pointer', 
                fontSize: '0.85rem', 
                color: 'var(--text-secondary)',
                userSelect: 'none'
              }}>
                <input 
                  type="checkbox" 
                  checked={isAdmin} 
                  onChange={(e) => {
                    setIsAdmin(e.target.checked);
                    if (!e.target.checked) setAdminCode('');
                  }}
                  style={{ 
                    marginRight: '0.5rem',
                    accentColor: 'var(--primary)',
                    width: '15px',
                    height: '15px',
                    cursor: 'pointer'
                  }}
                  disabled={loading}
                />
                Register as Administrator
              </label>

              {isAdmin && (
                <div className="form-group animate-slide-down">
                  <label className="form-label">Admin Secret Code</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={16} style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)'
                    }} />
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="e.g., admin123"
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                      style={{ paddingLeft: '2.5rem' }}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : isRegister ? (
              <>
                <UserPlus size={16} /> Register
              </>
            ) : (
              <>
                <LogIn size={16} /> Sign In
              </>
            )}
          </button>
        </form>

        {/* Footer Toggle links */}
        <div style={{ 
          textAlign: 'center', 
          fontSize: '0.85rem', 
          color: 'var(--text-secondary)',
          marginTop: '0.5rem'
        }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button 
            type="button" 
            onClick={toggleAuthMode}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--primary)', 
              fontWeight: 600, 
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            disabled={loading}
          >
            {isRegister ? 'Sign In' : 'Register Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Auth;
