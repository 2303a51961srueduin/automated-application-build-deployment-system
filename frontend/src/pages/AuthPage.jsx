import { useState } from 'react';
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function AuthPage({ mode, onAuthenticated }) {
  const registering = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (registering) await api('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      const { user } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      onAuthenticated(user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link to="/login" className="brand auth-brand"><span className="brand-mark"><Activity size={19} /></span><span>deploy<span className="brand-light">ops</span></span></Link>
        <div className="visual-copy">
          <span className="eyebrow"><span className="green-dot" /> SHIP WITH CONFIDENCE</span>
          <h1>From source<br />to <span>production.</span></h1>
          <p>One clear view of every build, every deployment, and everything in between.</p>
        </div>
        <div className="visual-footer"><span>BUILD</span><i /> <span>TEST</span><i /> <span>DEPLOY</span><i /> <span>REPEAT</span></div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-icon"><LockKeyhole size={21} /></div>
          <p className="eyebrow muted-eyebrow">{registering ? 'GET STARTED' : 'WELCOME BACK'}</p>
          <h2>{registering ? 'Create your account' : 'Sign in to DeployOps'}</h2>
          <p className="auth-subtitle">{registering ? 'Set up your workspace and start building.' : 'Enter your credentials to access your workspace.'}</p>
          <form onSubmit={submit} className="form-stack">
            {registering && <label>Full name<input autoComplete="name" required minLength="2" maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Alex Morgan" /></label>}
            <label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@company.com" /></label>
            <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 10 : 1} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={registering ? 'At least 10 characters' : 'Enter your password'} /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button type="submit" className="button primary wide" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'} {!busy && <ArrowRight size={17} />}</button>
          </form>
          <p className="auth-switch">{registering ? 'Already have an account?' : 'New to DeployOps?'} <Link to={registering ? '/login' : '/register'}>{registering ? 'Sign in' : 'Create an account'}</Link></p>
        </div>
        <div className="auth-legal">SECURE ACCESS <span>•</span> JWT SESSION <span>•</span> ROLE-BASED CONTROL</div>
      </section>
    </main>
  );
}
