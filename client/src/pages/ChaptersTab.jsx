import { useState } from 'react';
import { ChapterForm, ItemForm } from './Forms.jsx';
import SubjectChips from '../components/SubjectChips.jsx';

export default function ChaptersTab({ plan, progress, edit, isAdmin, reloadAll, subj, setSubj }) {
  const [form, setForm] = useState(null);
  const lecs = plan.items.filter((i) => i.type === 'lec');
  const multi = plan.subjects.length > 1;

  return (
    <>
      <SubjectChips subjects={plan.subjects} value={subj} onChange={setSubj} />
      {edit && isAdmin && <div className="tools"><button className="btn pri" onClick={() => setForm({ kind: 'chapter', chapter: null, subject: subj === 'all' ? null : subj })}>+ Add chapter</button></div>}
      {plan.subjects.filter((s) => subj === 'all' || s.id === subj).map((sj) => {
        const chs = plan.chapters.filter((c) => c.subject === sj.id);
        const parts = [...new Set(chs.map((c) => c.part))];
        return (
          <div key={sj.id}>
            {(multi || !chs.length) && <div className="subh">{sj.name}</div>}
            {!chs.length && <div className="empty">No chapters in this subject yet.</div>}
            {parts.map((p) => (
              <div key={p || '_'}>
                {p && <div className="part">{p}</div>}
                <div className="cgrid">
                  {chs.filter((c) => c.part === p).sort((a, b) => a.n - b.n).map((c) => {
                    const rows = lecs.filter((l) => l.subject === c.subject && l.chapter === c.n);
                    const done = rows.filter((l) => progress[l.id]?.a).length;
                    return (
                      <div className="cc" key={c.id}>
                        <span className="cn">CHAPTER {c.n}</span>
                        <h4>{c.name}</h4>
                        {c.summary && <p className="tip">{c.summary}</p>}
                        <ul>{c.topics.map((t) => <li key={t}>{t}</li>)}</ul>
                        {c.tip && <p className="tip"><b>Tip: </b>{c.tip}</p>}
                        <div className="bar"><i style={{ width: `${rows.length ? (100 * done) / rows.length : 0}%` }} /></div>
                        <small>{done} of {rows.length} lectures ticked</small>
                        {edit && isAdmin && <>
                          <button className="btn sm" onClick={() => setForm({ kind: 'chapter', chapter: c })}>Edit chapter</button>
                          <button className="btn sm" onClick={() => setForm({ kind: 'item', preset: { subject: c.subject, chapter: c.n } })}>+ Lecture</button>
                        </>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {form?.kind === 'chapter' && <ChapterForm plan={plan} chapter={form.chapter} presetSubject={form.subject} onClose={() => setForm(null)} onSaved={() => { setForm(null); reloadAll(); }} />}
      {form?.kind === 'item' && <ItemForm plan={plan} item={null} preset={form.preset} onClose={() => setForm(null)} onSaved={() => { setForm(null); reloadAll(); }} />}
    </>
  );
}
