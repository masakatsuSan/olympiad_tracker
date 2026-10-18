import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../auth.jsx';

const MAIL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c.4 0 .6.3.6.6v11c0 .3-.2.6-.6.6H4c-.4 0-.6-.3-.6-.6V4.6c0-.3.2-.6.6-.6z"/><polyline points="22,6 12,13 2,6"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
const EYE_OPEN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><path d="M5.12 5.12l15.76 15.76M3.82 19.08l15.76-15.76"/></svg>';
const GOOGLE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0-3.16 19.47c5.76-.26 10.32-5 10.32-10.47 0-5.5-4.56-10-10.16-10z"/><path d="M12 12h.01"/></svg>';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const shake = useRef(0);

  const emailErr = touched.email && !email ? 'Email is required.'
    : touched.email && !EMAIL_RE.test(email) ? 'Enter a valid email.' : null;
  const pwErr = touched.password && !password ? 'Password is required.' : null;

  const submit = useCallback(async (e) => {
    e.preventDefault(); setError(''); setTouched({ email: true, password: true });
    if (emailErr || pwErr) { shake.current += 1; return; }
    setBusy(true);
    try { await login(email, password); }
    catch (err) { setError(err.message || 'Sign in failed.'); shake.current += 1; setBusy(false); }
  }, [email, password, emailErr, pwErr, login]);

  return (
    <div id="login" className="login-page">
      <article className="lcard" data-shake={shake.current}>
        <header className="lhead">
          <div className="lmark">Ω</div>
          <button type="button" className="lclose" aria-label="Close" onClick={() => setError('')}>✕</button>
        </header>
        <div className="lwelcome">
          <h1>Welcome to Olympiad Roadmap</h1>
          <p className="lsub">Log in to discover more ideas just for you.</p>
        </div>
        <form onSubmit={submit} className="lform" noValidate>
          {error && <div className="err" role="alert">{error}</div>}
          <div className={`lfld ${touched.email && emailErr ? 'bad' : ''}`}>
            <label className="lfld-label">Email</label>
            <div className="lfld-wrap">
              <span className="lfld-icon" dangerouslySetInnerHTML={{ __html: MAIL }} />
              <input
                className="fld"
                type="email"
                autoComplete="username"
                autoFocus
                disabled={busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                aria-describedby={emailErr ? 'email-err' : undefined}
                placeholder="Email"
              />
            </div>
            {emailErr && <span id="email-err" className="lfld-err">{emailErr}</span>}
          </div>
          <div className={`lfld ${touched.password && pwErr ? 'bad' : ''}`}>
            <label className="lfld-label">Password</label>
            <div className="lfld-wrap">
              <span className="lfld-icon" dangerouslySetInnerHTML={{ __html: LOCK }} />
              <input
                className="fld pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                aria-describedby={pwErr ? 'pw-err' : undefined}
                placeholder="Password"
              />
              <button type="button" className="lshow" disabled={busy} onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'} dangerouslySetInnerHTML={{ __html: showPw ? EYE_CLOSED : EYE_OPEN }} />
            </div>
            {pwErr && <span id="pw-err" className="lfld-err">{pwErr}</span>}
          </div>
          <button type="submit" className="lbtn btn pri" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </article>
    </div>
  );
}
