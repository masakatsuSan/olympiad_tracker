import { addDays, monday, isoWeek, dow, short, DAYL, todayStr } from '../dates.js';
import SubjectChips from '../components/SubjectChips.jsx';

export default function ProgressTab({ plan, stats, subj, setSubj }) {
  const items = plan.items.filter((i) => subj === 'all' || i.subject === subj);
  const planDates = items.filter((i) => !i.week0 && i.date).map((i) => i.date).sort();
  const heatDays = Object.keys(stats.heat).sort();
  const first = [planDates[0], heatDays[0]].filter(Boolean).sort()[0] || todayStr();
  const last = [planDates[planDates.length - 1], heatDays[heatDays.length - 1]].filter(Boolean).sort().reverse()[0] || todayStr();
  const start = monday(first), end = addDays(monday(last), 6);
  const dueDays = new Set(items.filter((i) => !i.week0 && i.date && i.type !== 'rest').map((i) => i.date));
  const today = todayStr();

  const cells = [], weekLabels = [];
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const c = stats.heat[d] || 0;
    const cls = ['cell', c >= 4 ? 'l3' : c >= 2 ? 'l2' : c >= 1 ? 'l1' : '',
      !c && dueDays.has(d) && d < today ? 'miss' : '', planDates.length && (d < planDates[0] || d > planDates[planDates.length - 1]) && !c ? 'out' : ''].filter(Boolean).join(' ');
    cells.push(<div key={d} className={cls} title={`${short(d)}: ${c} ticked`} />);
    if (dow(d) === 1) { weekLabels.push(<span key={d}>{n % 2 === 0 ? isoWeek(d) : ''}</span>); n += 1; }
  }

  // Fill empty weeks so the bar chart has no gaps.
  const byMon = new Map(stats.weeks.map((w) => [w.monday, w]));
  const bars = [];
  for (let d = start; d <= end; d = addDays(d, 7)) bars.push(byMon.get(d) || { monday: d, isoWeek: isoWeek(d), planned: 0, done: 0 });
  const max = Math.max(1, ...bars.map((b) => Math.max(b.planned, b.done)));
  const curMon = monday(today);

  return (
    <>
      <SubjectChips subjects={plan.subjects} value={subj} onChange={setSubj} />
      <div className="panel">
        <h3>Consistency</h3>
        <p className="cap">One square per day. Darker means more boxes ticked that day. An amber outline marks a planned day with nothing ticked.</p>
        <div className="scroll">
          <div className="hrow">
            <div className="hd">{DAYL.map((l, i) => <span key={i}>{l}</span>)}</div>
            <div><div className="heat">{cells}</div><div className="hw">{weekLabels}</div></div>
          </div>
        </div>
        <div className="legend">Less {['', 'l1', 'l2', 'l3'].map((c) => <span key={c} className={`cell ${c}`} />)} More <span className="cell miss" /> Planned, nothing ticked</div>
      </div>
      <div className="panel">
        <h3>Ticks per week</h3>
        <p className="cap">Purple is what was ticked that week. The pale bar behind it is what the plan asked for. Labels are week numbers of the year.</p>
        <div className="scroll">
          <div className="bars">
            {bars.map((b) => (
              <div key={b.monday} className={'bc' + (b.monday === curMon ? ' cur' : '')} title={`Week ${b.isoWeek}: ${b.done} ticked, ${b.planned} planned`}>
                <div className="pair">
                  <div className="pl" style={{ height: `${(100 * b.planned) / max}%` }} />
                  <div className="dn" style={{ height: `${(100 * b.done) / max}%` }}>{b.done ? <span className="vv">{b.done}</span> : null}</div>
                </div>
                <span className="wl">{b.isoWeek}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
