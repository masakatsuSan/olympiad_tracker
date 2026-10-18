import { useEffect, useMemo, useState } from 'react';
import { monday, addDays, isoWeek, dow, dm, long, monthLabel, todayStr, DAYF } from '../dates.js';
import TickBox from '../components/TickBox.jsx';
import TextField from '../components/TextField.jsx';
import SubjectChips from '../components/SubjectChips.jsx';
import { ItemForm, ChapterForm } from './Forms.jsx';

export default function Schedule(ctx) {
  const { plan, progress, edit, isAdmin, subj, setSubj } = ctx;
  const today = todayStr();
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(null);
  const multi = plan.subjects.length > 1;
  const subjName = (id) => plan.subjects.find((s) => s.id === id)?.name || '';
  const chapterOf = (it) => plan.chapters.find((c) => c.subject === it.subject && c.n === it.chapter);

  const rowDone = (it) => {
    const p = progress[it.id] || {};
    return it.type === 'lec' ? !!(p.a && p.b) : it.type === 'rest' ? false : !!p.c;
  };

  const weeks = useMemo(() => {
    const items = plan.items.filter((i) => subj === 'all' || i.subject === subj);
    const out = [];
    const w0 = items.filter((i) => i.week0);
    if (w0.length) {
      const ds = w0.map((i) => i.origDate).filter(Boolean).sort();
      out.push({ key: 'w0', num: '0', items: w0, w0: true, month: 'Week 0', range: ds.length ? `${long(ds[0])} to ${long(ds[ds.length - 1])}` : 'Self-paced' });
    }
    const map = new Map();
    items.filter((i) => !i.week0 && i.date).forEach((i) => { const k = monday(i.date); if (!map.has(k)) map.set(k, []); map.get(k).push(i); });
    [...map.keys()].sort().forEach((k) => out.push({ key: k, num: String(isoWeek(k)), items: map.get(k), w0: false, month: monthLabel(k), range: `${dm(k)} to ${long(addDays(k, 6))}` }));
    return out;
  }, [plan.items, subj]);

  useEffect(() => {
    if (!weeks.length) return;
    if (!weeks.some((w) => w.key === sel)) {
      const cur = monday(today);
      setSel((weeks.find((w) => !w.w0 && w.key === cur) || weeks.find((w) => !w.w0 && addDays(w.key, 6) >= today) || weeks[weeks.length - 1]).key);
    }
  }, [weeks, sel, today]);

  const counts = (w) => { const rs = w.items.filter((r) => r.type !== 'rest'); return { done: rs.filter(rowDone).length, total: rs.length }; };
  const title = (w) => {
    const names = [];
    w.items.filter((r) => r.type === 'lec').forEach((r) => { const n = chapterOf(r)?.name || `Chapter ${r.chapter}`; if (!names.includes(n)) names.push(n); });
    if (!names.length) return 'Revision and tests';
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} and more` : names.join(', ');
  };
  const subline = (w) => {
    const lec = w.items.filter((r) => r.type === 'lec').length;
    const parts = [w.range, `${lec} ${lec === 1 ? 'lecture' : 'lectures'}`];
    if (w.w0) parts.push('self-paced');
    if (w.items.some((r) => r.type === 'rev')) parts.push('revision');
    if (w.items.some((r) => r.type === 'test')) parts.push('test');
    return parts.join(' · ');
  };

  const addPreset = () => (subj === 'all' ? {} : { subject: subj });

  if (!weeks.length) {
    return (
      <>
        <SubjectChips subjects={plan.subjects} value={subj} onChange={setSubj} />
        <div className="empty">{edit ? 'The plan is empty.' : 'No plan yet.'}</div>
        {edit && isAdmin && <button className="btn pri" onClick={() => setForm({ kind: 'item', item: null, preset: addPreset() })}>+ Add item</button>}
        {form?.kind === 'item' && <ItemForm plan={plan} item={form.item} preset={form.preset} onClose={() => setForm(null)} onSaved={() => { setForm(null); ctx.reloadAll(); }} />}
      </>
    );
  }

  const idx = Math.max(0, weeks.findIndex((w) => w.key === sel));
  const w = weeks[idx];
  const go = (i) => { setSel(weeks[i].key); window.scrollTo(0, 0); };
  const ck = (r) => `${r.subject}|${r.chapter}`;
  const cnt = {}; w.items.forEach((r) => { if (r.type === 'lec') cnt[ck(r)] = (cnt[ck(r)] || 0) + 1; });
  let lastMonth = null, lastCh = null;

  return (
    <>
      <SubjectChips subjects={plan.subjects} value={subj} onChange={(v) => { setSel(null); setSubj(v); }} />
      <div className="sched">
        <nav className="wlist" aria-label="Weeks">
          {weeks.map((x) => {
            const c = counts(x);
            const head = x.month !== lastMonth ? <span key={`m${x.key}`} className="wm">{x.month}</span> : null;
            lastMonth = x.month;
            return [head,
              <button key={x.key} type="button" data-k={x.key} className={'wc' + (x.key === w.key ? ' sel' : '') + (c.total && c.done === c.total ? ' full' : '')}
                aria-label={`Week ${x.num}, ${c.done} of ${c.total} days done`} onClick={() => setSel(x.key)}>
                <b>{x.num}</b><span className="wt"><span className="t1">{title(x)}</span><small>{c.done}/{c.total}</small></span>
              </button>];
          })}
        </nav>
        <section className="wp">
          <div className="wk"><div className="big">{w.num}</div><div className="wkt"><h2>{title(w)}</h2><p className="wks">{subline(w)}</p></div></div>
          <div className="tl">
            {w.items.map((r) => {
              const out = [];
              if (r.type === 'lec' && ck(r) !== lastCh) {
                lastCh = ck(r);
                const c = chapterOf(r);
                out.push(
                  <div className="cht" key={`h${r.id}`}>Ch {r.chapter}
                    <span>{multi ? `${subjName(r.subject)} · ` : ''}{c?.part ? `${c.part} · ` : ''}{cnt[ck(r)]} {cnt[ck(r)] === 1 ? 'lecture' : 'lectures'}</span>
                    {edit && isAdmin && c && <button className="btn sm" onClick={() => setForm({ kind: 'chapter', chapter: c })}>Edit chapter</button>}
                  </div>);
              }
              out.push(<Day key={r.id} r={r} ctx={ctx} today={today} done={rowDone(r)} chapter={chapterOf(r)} onEdit={() => setForm({ kind: 'item', item: r })} />);
              return out;
            })}
          </div>
          <div className="wnav">
            {idx > 0 && <button className="btn" onClick={() => go(idx - 1)}>Previous week</button>}
            {idx < weeks.length - 1 && <button className="btn pri" onClick={() => go(idx + 1)}>Next week</button>}
            {edit && isAdmin && <>
              <button className="btn" onClick={() => setForm({ kind: 'item', item: null, preset: { ...addPreset(), ...(w.w0 ? { week0: true } : { date: w.items[0]?.date }) } })}>+ Add to this week</button>
              <button className="btn" onClick={() => setForm({ kind: 'item', item: null, preset: addPreset() })}>+ Add item</button>
            </>}
          </div>
        </section>
      </div>
      {form?.kind === 'item' && <ItemForm plan={plan} item={form.item} preset={form.preset} onClose={() => setForm(null)} onSaved={() => { setForm(null); ctx.reloadAll(); }} />}
      {form?.kind === 'chapter' && <ChapterForm plan={plan} chapter={form.chapter} onClose={() => setForm(null)} onSaved={() => { setForm(null); ctx.reloadAll(); }} />}
    </>
  );
}

function Day({ r, ctx, today, done, chapter, onEdit }) {
  const { progress, tick, saveNote, isAdmin, edit, viewing } = ctx;
  const p = progress[r.id] || {};
  const ds = r.week0 ? r.origDate : r.date;
  const isToday = !r.week0 && r.date === today;
  const missed = !r.week0 && !!r.date && r.date < today && r.type !== 'rest' && !done;
  const readOnly = viewing && !isAdmin;
  const tb = (kind, label) => <TickBox id={`c-${r.id}-${kind}`} label={label} ticked={p[kind]} isAdmin={isAdmin} onChange={(on) => tick(r.id, kind, on)} />;
  return (
    <article className={`day ${r.type}${done ? ' done' : ''}${isToday ? ' today' : ''}${missed ? ' missed' : ''}`} data-id={r.id}>
      <span className="node" />
      <div className="dh">
        <div className="dtop">
          <b>{ds ? DAYF[dow(ds)] : 'No date'}</b><span className="dd">{ds ? dm(ds) + (r.week0 ? ' ' + ds.slice(0, 4) : '') : ''}</span>
          {isToday && <span className="tag today">Today</span>}
          {missed && <span className="tag miss">Missed</span>}
          {edit && isAdmin && <button className="btn sm" onClick={onEdit}>Edit</button>}
        </div>
        <div className="dsub">
          {r.type === 'lec' && `${chapter ? chapter.name + ' · ' : ''}${r.topic || 'Lecture'}`}
          {r.type === 'rev' && <><span className="tag rev">Revision</span>{r.text}</>}
          {r.type === 'test' && <><span className="tag test">Test</span>{r.name || 'Test'}</>}
          {r.type === 'rest' && (r.text || 'Rest')}
        </div>
        {r.type === 'test' && r.text && <div className="dsub2">{r.text}</div>}
      </div>
      {r.type !== 'rest' && (
        <div className="dc">
          <div className={'checks' + (r.type === 'lec' ? '' : ' one')}>
            {r.type === 'lec' && <>{tb('a', 'Lecture')}{tb('b', 'DPP')}</>}
            {r.type === 'rev' && tb('c', 'Revised')}
            {r.type === 'test' && tb('c', 'Test taken')}
          </div>
          <div className="nr">
            {r.type === 'test' && <TextField id={`s-${r.id}`} className="score" placeholder="Score" value={p.score} readOnly={readOnly} onSave={(v) => saveNote(r.id, { score: v })} />}
            <TextField id={`n-${r.id}`} className="note" placeholder={r.type === 'lec' ? 'Add a note' : r.type === 'rev' ? 'Weak topics' : 'Mistakes'} value={p.note} readOnly={readOnly} onSave={(v) => saveNote(r.id, { note: v })} />
          </div>
        </div>
      )}
    </article>
  );
}
