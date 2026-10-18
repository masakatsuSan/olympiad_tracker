import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { short } from '../dates.js';
import Schedule from './Schedule.jsx';
import ProgressTab from './ProgressTab.jsx';
import ChaptersTab from './ChaptersTab.jsx';
import PlanTab from './PlanTab.jsx';
import LearnersTab from './LearnersTab.jsx';
import PasswordForm from '../components/PasswordForm.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';

export default function Tracker() {
  const { user, logout } = useAuth();
  const { uid: uidParam, tab: tabParam } = useParams();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin';
  const uid = uidParam || 'me';
  const viewing = uid !== 'me' && uid !== user.id;
  const wanted = tabParam || 'schedule';
  const base = viewing ? `/learner/${uid}` : '';

  const [plan, setPlan] = useState(null);
  const [progress, setProgress] = useState({});
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(false);
  const [subj, setSubj] = useState('all');
  const [learnerName, setLearnerName] = useState('');
  const [menu, setMenu] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const loadPlan = useCallback(() => api.get('/plan').then(setPlan), []);
  const loadStats = useCallback(() => api.get(`/progress/${uid}/stats${subj === 'all' ? '' : `?subject=${subj}`}`).then(setStats), [uid, subj]);
  const reloadAll = useCallback(() => Promise.all([loadPlan(), loadStats()]).catch((e) => setError(e.message)), [loadPlan, loadStats]);

  useEffect(() => {
    setError('');
    Promise.all([loadPlan(), api.get(`/progress/${uid}`).then((r) => setProgress(r.progress)), loadStats()]).catch((e) => setError(e.message));
  }, [uid, loadPlan, loadStats]);

  useEffect(() => {
    if (plan && subj !== 'all' && !plan.subjects.some((s) => s.id === subj)) setSubj('all');
  }, [plan, subj]);

  useEffect(() => {
    if (!viewing) { setLearnerName(''); return; }
    api.get('/users').then((r) => setLearnerName(r.users.find((u) => u.id === uid)?.name || '')).catch(() => {});
  }, [viewing, uid]);

  const setItemProgress = (itemId, p) => setProgress((cur) => ({ ...cur, [itemId]: p }));

  // Learners tick once. Admins can also untick (unlock) from here.
  const tick = useCallback(async (itemId, kind, on) => {
    try {
      const r = on ? await api.post(`/progress/${uid}/${itemId}/tick`, { kind }) : await api.del(`/progress/${uid}/${itemId}/${kind}`);
      if (r.progress) setItemProgress(itemId, r.progress);
      loadStats(); setError('');
    } catch (e) { setError(e.message); }
  }, [uid, loadStats]);

  const saveNote = useCallback(async (itemId, patch) => {
    try { const r = await api.put(`/progress/${uid}/${itemId}/note`, patch); setItemProgress(itemId, r.progress); } catch (e) { setError(e.message); }
  }, [uid]);

  const tabs = useMemo(() => {
    const t = [['schedule', 'Schedule'], ['progress', 'Progress'], ['chapters', 'Chapters']];
    if (isAdmin && !viewing) t.push(['plan', 'Plan'], ['learners', 'Learners']);
    return t;
  }, [isAdmin, viewing]);

  // A tab this account may not open (for example a learner landing on /plan) shows the schedule instead.
  const tab = tabs.some(([k]) => k === wanted) ? wanted : 'schedule';

  if (!plan || !stats) return <div className="splash">{error || 'Loading'}</div>;

  const ctx = { plan, progress, stats, tick, saveNote, isAdmin, viewing, edit: isAdmin && edit, reloadPlan: loadPlan, reloadAll, setError, uid, base, subj, setSubj };
  const weeksN = new Set(plan.items.filter((i) => !i.week0 && i.date && (subj === 'all' || i.subject === subj)).map((i) => i.date.slice(0, 7))).size;

  return (
    <div className="app" id="app">
      <header className="hero">
        <div className="hbar">
          <span className="brand">Study tracker</span>
          <div className="who">
            <span className={'pill' + (isAdmin ? ' admin' : '')}>{isAdmin ? 'Admin' : 'Learner'}</span>
            {isAdmin && edit && <span className="pill edit">Editing</span>}
            <button type="button" className="btn sm" id="menu" onClick={() => setMenu(true)}>Menu</button>
          </div>
        </div>
        <div>
          <h1>Olympiad Roadmap</h1>
          <p className="sub">{user.name}{weeksN ? ` · ${weeksN} ${weeksN === 1 ? 'month' : 'months'} planned` : ' · No plan yet'}</p>
        </div>
        <Stats stats={stats} plan={plan} subj={subj} />
      </header>

      {viewing && (
        <div className="banner">
          <span>Viewing {learnerName || 'a learner'}. Ticks you change here are saved to their account.</span>
          <button className="btn sm" onClick={() => navigate('/learners')}>Back to learners</button>
        </div>
      )}
      {error && <div className="banner" role="alert"><span>{error}</span><button className="btn sm" onClick={() => setError('')}>Dismiss</button></div>}

      <nav className="tabs" role="tablist" aria-label="Sections">
        {tabs.map(([k, l]) => (
          <Link key={k} to={`${base}/${k === 'schedule' ? '' : k}`} className="tab" role="tab" aria-selected={tab === k} onClick={() => window.scrollTo(0, 0)}>
            <Icon name={k} /><span>{l}</span>
          </Link>
        ))}
      </nav>

      <main id="main">
        {tab === 'schedule' && <Schedule {...ctx} />}
        {tab === 'progress' && <ProgressTab {...ctx} />}
        {tab === 'chapters' && <ChaptersTab {...ctx} />}
        {tab === 'plan' && isAdmin && !viewing && <PlanTab {...ctx} />}
        {tab === 'learners' && isAdmin && !viewing && <LearnersTab {...ctx} />}
      </main>

      {menu && (
        <Modal title={isAdmin ? 'Admin menu' : 'Menu'} onClose={() => setMenu(false)}>
          {isAdmin && (
            <label className="sw"><input type="checkbox" id="editmode" checked={edit} onChange={(e) => { setEdit(e.target.checked); setMenu(false); }} />
              <span>Edit plan: add, change and delete lectures</span></label>
          )}
          <button className="btn" onClick={() => { setMenu(false); setShowPw(true); }}>Change password</button>
          <button className="btn" onClick={logout}>Sign out</button>
          <button className="btn" onClick={() => setMenu(false)}>Close</button>
        </Modal>
      )}
      {showPw && (
        <Modal title="Change password" onClose={() => setShowPw(false)}>
          <PasswordForm onDone={() => setShowPw(false)} />
        </Modal>
      )}
    </div>
  );
}

function Stats({ stats, plan, subj }) {
  const t = stats.totals;
  const first = plan.items.filter((i) => i.type === 'lec' && !i.week0 && (subj === 'all' || i.subject === subj)).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const total = t.lectures.total * 2, got = t.lectures.done + t.dpps.done;
  let pace = null;
  if (t.lectures.total) {
    if (stats.due === 0 && first) pace = <span className="chipm">Starts {short(first.date)}</span>;
    else pace = stats.behind === 0 ? <span className="chipm ok">On track</span>
      : <span className="chipm behind">{stats.behind} {stats.behind === 1 ? 'lecture' : 'lectures'} behind</span>;
  }
  return (
    <section className="stats" id="stats" aria-label="Progress">
      <div className="kpis">
        <div className="kpi"><b>{t.lectures.done}/{t.lectures.total}</b><small>lectures</small></div>
        <div className="kpi"><b>{t.dpps.done}/{t.dpps.total}</b><small>DPPs done</small></div>
        <div className="kpi"><b>{stats.streak}</b><small>day streak</small></div>
      </div>
      <div className="line"><i style={{ width: `${total ? (100 * got) / total : 0}%` }} /></div>
      <div className="meta">
        {pace}
        <span className="chipm"><b>{t.week0.done}/{t.week0.total}</b> Week 0</span>
        <span className="chipm"><b>{t.tests.done}/{t.tests.total}</b> Tests</span>
      </div>
    </section>
  );
}
