import { useEffect, useRef, useState } from 'react';
import { api, saveText } from '../api.js';
import Modal from '../components/Modal.jsx';
import { SubjectForm, ChapterForm, ItemForm, ShiftForm } from './Forms.jsx';

export default function PlanTab({ plan, reloadAll }) {
  const [form, setForm] = useState(null);
  const [csv, setCsv] = useState(null);
  const done = () => { setForm(null); reloadAll(); };

  return (
    <>
      <div className="panel">
        <h3>Subjects</h3>
        <p className="cap">Each subject has its own chapters and sub-topics. Use the chips on Schedule and Chapters to focus on one.</p>
        {plan.subjects.map((s) => {
          const nc = plan.chapters.filter((c) => c.subject === s.id).length;
          const nl = plan.items.filter((i) => i.subject === s.id && i.type === 'lec').length;
          return (
            <div className="srow" key={s.id}>
              <div><b>{s.name}</b><small>{nc} {nc === 1 ? 'chapter' : 'chapters'}, {nl} scheduled {nl === 1 ? 'lecture' : 'lectures'}</small></div>
              <button className="btn sm" onClick={() => setForm({ kind: 'subject', subject: s })}>Edit</button>
            </div>
          );
        })}
        <div className="stk">
          <button className="btn pri" onClick={() => setForm({ kind: 'subject', subject: null })}>+ Add subject</button>
          <button className="btn" onClick={() => setForm({ kind: 'chapter', chapter: null })}>+ Add chapter</button>
          <button className="btn" onClick={() => setForm({ kind: 'item' })}>+ Add lecture or item</button>
        </div>
      </div>

      <div className="panel">
        <h3>Dates</h3>
        <p className="cap">Move a whole stretch of the plan to new dates, for one subject or all.</p>
        <div className="stk"><button className="btn pri" onClick={() => setForm({ kind: 'shift' })}>Change dates</button></div>
      </div>

      <div className="panel">
        <h3>CSV</h3>
        <p className="cap">Build the plan in a spreadsheet and import it, or export the current plan to edit there. Re-importing an export updates items in place, so ticks stay.</p>
        <div className="stk">
          <button className="btn pri" onClick={() => setCsv({ kind: 'import' })}>Import CSV</button>
          <button className="btn" onClick={() => setCsv({ kind: 'export' })}>Export CSV</button>
          <button className="btn" onClick={() => setCsv({ kind: 'template' })}>CSV template</button>
        </div>
      </div>

      {form?.kind === 'subject' && <SubjectForm plan={plan} subject={form.subject} onClose={() => setForm(null)} onSaved={done} />}
      {form?.kind === 'chapter' && <ChapterForm plan={plan} chapter={form.chapter} onClose={() => setForm(null)} onSaved={done} />}
      {form?.kind === 'item' && <ItemForm plan={plan} item={null} preset={{}} onClose={() => setForm(null)} onSaved={done} />}
      {form?.kind === 'shift' && <ShiftForm plan={plan} onClose={() => setForm(null)} onSaved={done} />}
      {csv?.kind === 'import' && <ImportDialog onClose={() => setCsv(null)} onDone={() => { setCsv(null); reloadAll(); }} />}
      {csv?.kind === 'export' && <ShowCsv title="Export CSV" path="/plan/export.csv" filename="study-plan.csv" note="Copy this or download it, edit in a spreadsheet, then import it again." onClose={() => setCsv(null)} />}
      {csv?.kind === 'template' && <ShowCsv title="CSV template" path="/plan/template.csv" filename="study-plan-template.csv" note="One row per sub-topic or schedule item. Leave date empty to list a sub-topic without scheduling it yet." onClose={() => setCsv(null)} />}
    </>
  );
}

function ShowCsv({ title, path, filename, note, onClose }) {
  const [text, setText] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.text(path).then(setText).catch((e) => setErr(e.message)); }, [path]);
  return (
    <Modal title={title} note={note} onClose={onClose}>
      <textarea className="fld csvbox" readOnly value={text ?? 'Loading'} onFocus={(e) => e.target.select()} />
      <div className="err" role="alert">{err}</div>
      <div className="acts">
        <button className="btn pri" disabled={!text} onClick={() => saveText(filename, text)}>Download file</button>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

const COLS = 'subject, chapter_no, chapter_name, group, subtopic, type, date, week0, title, text';

function ImportDialog({ onClose, onDone }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('merge');
  const [pv, setPv] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  // Preview on the server (dry run) every time the text or mode changes, so the checks are the same as the real import.
  function preview(t, m) {
    const n = ++seq.current;
    setErr('');
    if (!t.trim()) { setPv(null); return; }
    api.post('/plan/import', { csv: t, mode: m, dryRun: true }).then((r) => { if (n === seq.current) setPv(r); }).catch((e) => { if (n === seq.current) { setPv(null); setErr(e.message); } });
  }
  const change = (t, m) => { setText(t); setMode(m); preview(t, m); };
  const loadFile = (e) => { const f = e.target.files?.[0]; if (f) f.text().then((t) => change(t, mode)); };
  async function template() { change(await api.text('/plan/template.csv'), mode); }
  async function go() {
    setBusy(true); setErr('');
    try { const r = await api.post('/plan/import', { csv: text, mode }); if (!r.applied) { setErr('Nothing to import.'); setBusy(false); return; } onDone(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  const s = pv?.stats;
  const ok = s && s.added + s.updated + s.chaptersNew + s.topics + s.subjectsNew + s.removed > 0;

  return (
    <Modal title="Import CSV" onClose={onClose} note={`Paste CSV or choose a file. One row per sub-topic or schedule item. Columns: ${COLS}. Dates as YYYY-MM-DD or DD/MM/YYYY.`}>
      <input type="file" className="fld" accept=".csv,text/csv,text/plain" onChange={loadFile} />
      <textarea className="fld csvbox" placeholder="Paste CSV here" value={text} onChange={(e) => change(e.target.value, mode)} />
      <label>Mode
        <select className="fld" value={mode} onChange={(e) => change(text, e.target.value)}>
          <option value="merge">Merge: add new and update matching items (ticks kept)</option>
          <option value="replace">Replace: also remove everything the CSV leaves out</option>
        </select>
      </label>
      {s && (
        <div className={'pv' + (pv.errorCount ? ' bad' : '')}>
          {s.added} new items, {s.updated} updated, {s.chaptersNew} new chapters, {s.subjectsNew} new subjects, {s.topics} new sub-topics
          {mode === 'replace' ? `, ${s.removed} removed` : ''}{s.skipped ? `, ${s.skipped} rows skipped` : ''}.
          {pv.errorCount > 0 && <ul>{pv.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}{pv.errorCount > 8 && <li>and {pv.errorCount - 8} more</li>}</ul>}
        </div>
      )}
      <div className="err" role="alert">{err}</div>
      <div className="acts">
        <button className="btn pri" disabled={!ok || busy} onClick={go}>Import</button>
        <button className="btn" onClick={template}>Template</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
