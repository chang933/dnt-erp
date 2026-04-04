import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const { login, token, user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (ready && token && user) {
      navigate(from, { replace: true });
    }
  }, [ready, token, user, navigate, from]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      // 토큰 저장 후 /me 로 user가 채워지면 아래 useEffect에서 이동
    } catch {
      setError('아이디 또는 비밀번호를 확인해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">도원반점 ERP</h1>
        <p className="login-sub">로그인 후 이용할 수 있습니다.</p>
        <form onSubmit={onSubmit} className="login-form">
          <label className="login-label">
            아이디
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              required
            />
          </label>
          <label className="login-label">
            비밀번호
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              required
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
