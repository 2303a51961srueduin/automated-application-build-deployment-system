import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import AuthPage from './pages/AuthPage.jsx';
import Workspace from './pages/Workspace.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api('/me').then(({ user: current }) => setUser(current)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      navigate('/login');
    }
  }

  if (loading) return <div className="screen-loading"><span className="spinner" /> Loading workspace…</div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" onAuthenticated={setUser} />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" onAuthenticated={setUser} />} />
      <Route path="/*" element={user ? <Workspace user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
