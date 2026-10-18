import { useState } from 'react';
import { api } from '../api.js';

export default function PasswordForm({ onDone }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError('');
    try { await api.post('/auth/change-password', { current, next }); setOk(true); setTimeout(onDone, 900); }
    catch (err) { setError(err.message); }
  }
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <label>Current password<input className="fld" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
      <label>New password (8 or more characters)<input className="fld" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required /></label>
      <div className="err" role="alert">{ok ? 'Password changed.' : error}</div>
      <div className="acts"><button className="btn pri">Save</button><button type="button" className="btn" onClick={onDone}>Cancel</button></div>
    </form>
  );
}
