import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';

function Actions({ onSave, onClose, onDelete, busy, saveLabel = 'Save' }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="acts">
      <button type="button" className="btn pri" onClick={onSave} disabled={busy}>{saveLabel}</button>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      {onDelete && <button type="button" className="btn warn sp" onClick={() => (armed ? onDelete() : setArmed(true))}>{armed ? 'Confirm delete' : 'Delete'}</button>}
    </div>
  );
}

// One place for the save / error / busy handling every form shares.
function useSubmit(onSaved) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); onSaved(); } catch (e) { setError(e.message); setBusy(false); }
  };
  return { error, busy, run, setError };
}

export function ItemForm({ plan, item, preset, onClose, onSaved }) {
  const isNew = !item;
  const first = plan.chapters[0];
  const [v, setV] = useState({
    type: 'lec', week0: false, subject: first?.subject || plan.subjects[0]?.id, chapter: first?.n ?? '', topic: '', name: '', text: '',
    ...(item || {}), ...(preset || {}), date: (item?.date ?? preset?.date) || '', origDate: item?.origDate || '',
  });
  const { error, busy, run } = useSubmit(onSaved);
  const set = (k) => (e) => setV((c) => ({ ...c, [k]: e.target.value }));
  const chapters = plan.chapters.filter((c) => c.subject === v.subject).sort((a, b) => a.n - b.n);
  const chapter = chapters.some((c) => c.n === Number(v.chapter)) ? v.chapter : chapters[0]?.n ?? '';
  const topics = chapters.find((c) => c.n === Number(chapter))?.topics || [];

  const save = () => run(() => {
    const body = {
      subject: v.subject, type: v.type, week0: v.week0, date: v.week0 ? null : v.date || null, origDate: v.week0 ? v.origDate || null : null,
      chapter: v.type === 'lec' ? Number(chapter) : null, topic: v.type === 'lec' ? v.topic || 'Lecture' : '',
      name: v.type === 'test' ? v.name || 'Test' : '', text: v.type === 'lec' ? '' : v.text,
    };
    return isNew ? api.post('/plan/items', body) : api.put(`/plan/items/${item.id}`, body);
  });

  return (
    <Modal title={isNew ? 'Add item' : 'Edit item'} onClose={onClose}>
      <label>Type<select className="fld" value={v.type} onChange={set('type')}><option value="lec">Lecture / sub-topic</option><option value="rev">Revision day</option><option value="test">Test</option><option value="rest">Rest day</option></select></label>
      <label>Subject<select className="fld" value={v.subject} onChange={set('subject')}>{plan.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Belongs to<select className="fld" value={v.week0 ? 'w0' : 'plan'} onChange={(e) => setV((c) => ({ ...c, week0: e.target.value === 'w0' }))}><option value="plan">The dated plan</option><option value="w0">Week 0 (self-paced)</option></select></label>
      {!v.week0 && <label>Plan date<input className="fld" type="date" value={v.date} onChange={set('date')} /></label>}
      {v.week0 && <label>Original class date<input className="fld" type="date" value={v.origDate} onChange={set('origDate')} /></label>}
      {v.type === 'lec' && <>
        <label>Chapter<select className="fld" value={chapter} onChange={set('chapter')}>{chapters.map((c) => <option key={c.id} value={c.n}>Ch {c.n} {c.name}</option>)}</select></label>
        <label>Sub-topic / lecture title<input className="fld" list="subtopics" value={v.topic} onChange={set('topic')} /></label>
        <datalist id="subtopics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
      </>}
      {v.type === 'test' && <label>Test name<input className="fld" value={v.name} onChange={set('name')} /></label>}
      {v.type !== 'lec' && <label>{v.type === 'test' ? 'Syllabus' : 'Text'}<input className="fld" value={v.text} onChange={set('text')} /></label>}
      <div className="err" role="alert">{error}</div>
      <Actions onSave={save} onClose={onClose} busy={busy} onDelete={isNew ? null : () => run(() => api.del(`/plan/items/${item.id}`))} />
    </Modal>
  );
}

export function ChapterForm({ plan, chapter, presetSubject, onClose, onSaved }) {
  const isNew = !chapter;
  const subject0 = chapter?.subject || presetSubject || plan.subjects[0]?.id;
  const nextN = (sid) => Math.max(0, ...plan.chapters.filter((c) => c.subject === sid).map((c) => c.n)) + 1;
  const [v, setV] = useState({ n: nextN(subject0), name: '', part: '', summary: '', tip: '', ...(chapter || {}), subject: subject0, topics: (chapter?.topics || []).join('\n') });
  const { error, busy, run } = useSubmit(onSaved);
  const set = (k) => (e) => setV((c) => ({ ...c, [k]: e.target.value }));

  const save = () => run(() => {
    const body = { subject: v.subject, n: Number(v.n), name: v.name, part: v.part, summary: v.summary, tip: v.tip, topics: v.topics.split('\n').map((s) => s.trim()).filter(Boolean) };
    return isNew ? api.post('/plan/chapters', body) : api.put(`/plan/chapters/${chapter.id}`, body);
  });

  return (
    <Modal title={isNew ? 'Add chapter' : `Edit chapter ${chapter.n}`} onClose={onClose}>
      <label>Subject<select className="fld" value={v.subject} onChange={(e) => { const s = e.target.value; setV((c) => ({ ...c, subject: s, ...(isNew ? { n: nextN(s) } : {}) })); }}>{plan.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Chapter number<input className="fld" type="number" min="1" value={v.n} onChange={set('n')} /></label>
      <label>Chapter name<input className="fld" value={v.name} onChange={set('name')} /></label>
      <label>Group (optional, e.g. Algebra)<input className="fld" value={v.part} onChange={set('part')} /></label>
      <label>Summary<textarea className="fld" value={v.summary} onChange={set('summary')} /></label>
      <label>Sub-topics (one per line)<textarea className="fld" value={v.topics} onChange={set('topics')} /></label>
      <label>Study tip<textarea className="fld" value={v.tip} onChange={set('tip')} /></label>
      <div className="err" role="alert">{error}</div>
      <Actions onSave={save} onClose={onClose} busy={busy} onDelete={isNew ? null : () => run(() => api.del(`/plan/chapters/${chapter.id}`))} />
    </Modal>
  );
}

export function SubjectForm({ plan, subject, onClose, onSaved }) {
  const isNew = !subject;
  const [name, setName] = useState(subject?.name || '');
  const { error, busy, run } = useSubmit(onSaved);
  return (
    <Modal title={isNew ? 'Add subject' : 'Rename subject'} onClose={onClose}>
      <label>Subject name<input className="fld" id="f-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <div className="err" role="alert">{error}</div>
      <Actions onSave={() => run(() => (isNew ? api.post('/plan/subjects', { name }) : api.put(`/plan/subjects/${subject.id}`, { name })))} onClose={onClose} busy={busy}
        onDelete={isNew || plan.subjects.length < 2 ? null : () => run(() => api.del(`/plan/subjects/${subject.id}`))} />
    </Modal>
  );
}

export function ShiftForm({ plan, onClose, onSaved }) {
  const first = plan.items.filter((i) => !i.week0 && i.date).map((i) => i.date).sort()[0] || '';
  const [v, setV] = useState({ subject: 'all', from: first, to: '' });
  const { error, busy, run } = useSubmit(onSaved);
  const set = (k) => (e) => setV((c) => ({ ...c, [k]: e.target.value }));
  const save = () => run(async () => {
    if (!v.from || !v.to) throw new Error('Pick both dates.');
    await api.post('/plan/shift', { subject: v.subject === 'all' ? null : v.subject, from: v.from, to: v.to });
  });
  return (
    <Modal title="Change dates" onClose={onClose} note="Every matching item moves by the same number of days, so the order stays and ticks are kept. Week 0 is not moved. For one item, use Edit plan on the Schedule tab.">
      <label>Subject<select className="fld" value={v.subject} onChange={set('subject')}><option value="all">All subjects</option>{plan.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Move items dated on or after<input className="fld" type="date" id="f-from" value={v.from} onChange={set('from')} /></label>
      <label>so that this date becomes<input className="fld" type="date" id="f-to" value={v.to} onChange={set('to')} /></label>
      <div className="err" role="alert">{error}</div>
      <Actions onSave={save} onClose={onClose} busy={busy} />
    </Modal>
  );
}

export function UserForm({ user, onClose, onSaved }) {
  const isNew = !user;
  const [v, setV] = useState({ name: user?.name || '', email: user?.email || '', role: user?.role || 'user', password: '' });
  const { error, busy, run } = useSubmit(onSaved);
  const set = (k) => (e) => setV((c) => ({ ...c, [k]: e.target.value }));
  const save = () => run(() => (isNew ? api.post('/users', v)
    : api.patch(`/users/${user.id}`, { name: v.name, role: v.role, ...(v.password ? { password: v.password } : {}) })));
  return (
    <Modal title={isNew ? 'Add learner' : `Edit ${user.name}`} onClose={onClose}>
      <label>Name<input className="fld" value={v.name} onChange={set('name')} /></label>
      <label>Email<input className="fld" type="email" value={v.email} onChange={set('email')} readOnly={!isNew} /></label>
      <label>Role<select className="fld" value={v.role} onChange={set('role')}><option value="user">Learner</option><option value="admin">Admin</option></select></label>
      <label>{isNew ? 'Password (8 or more characters)' : 'New password (leave empty to keep)'}<input className="fld" type="text" autoComplete="off" value={v.password} onChange={set('password')} /></label>
      <div className="err" role="alert">{error}</div>
      <Actions onSave={save} onClose={onClose} busy={busy} />
    </Modal>
  );
}
