import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { UserForm } from './Forms.jsx';
import { short } from '../dates.js';

export default function LearnersTab({ setError }) {
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(null);
  const [armed, setArmed] = useState('');
  const load = useCallback(() => api.get('/users').then((r) => setUsers(r.users)).catch((e) => setError(e.message)), [setError]);
  useEffect(() => { load(); }, [load]);

  async function run(key, fn) {
    if (armed !== key) { setArmed(key); return; }
    setArmed('');
    try { await fn(); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div className="panel">
      <div className="acts"><h3>Accounts</h3><button className="btn pri sp" onClick={() => setForm({ user: null })}>+ Add learner</button></div>
      <p className="cap">Create an account for each learner and give them the email and password. There is no public sign-up.</p>
      {!users && <div className="empty">Loading</div>}
      {users?.map((u) => (
        <div className="lrow" key={u.id}>
          <div><b>{u.name}</b> <span className={'pill' + (u.role === 'admin' ? ' admin' : '')}>{u.role === 'admin' ? 'Admin' : 'Learner'}</span>
            <small>{u.email} · {u.lastTick ? `last tick ${short(u.lastTick)}` : 'no ticks yet'}</small></div>
          <div><small>Lectures</small><b>{u.lectures.done} / {u.lectures.total}</b></div>
          <div><small>DPPs</small><b>{u.dpps.done} / {u.dpps.total}</b></div>
          <div><small>Streak</small><b>{u.streak} days</b></div>
          <div className="acts">
            <Link className="btn sm" to={`/learner/${u.id}`}>View</Link>
            <button className="btn sm" onClick={() => setForm({ user: u })}>Edit</button>
            <button className="btn sm warn" onClick={() => run('r' + u.id, () => api.del(`/progress/${u.id}`))}>{armed === 'r' + u.id ? 'Confirm reset' : 'Reset progress'}</button>
            <button className="btn sm warn" onClick={() => run('d' + u.id, () => api.del(`/users/${u.id}`))}>{armed === 'd' + u.id ? 'Confirm delete' : 'Delete'}</button>
          </div>
        </div>
      ))}
      {form && <UserForm user={form.user} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </div>
  );
}
