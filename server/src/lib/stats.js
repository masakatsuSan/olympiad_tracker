import { PlanItem } from '../models/PlanItem.js';
import { Progress } from '../models/Progress.js';
import { dayKey, todayKey, addDays, mondayOf, isoWeek } from './dates.js';

const tickDays = (p) => ['a', 'b', 'c'].filter((k) => p[k]).map((k) => dayKey(p[k]));

export async function userStats(userId, subject = null) {
  const [allItems, allProgress] = await Promise.all([PlanItem.find(subject ? { subject } : {}).lean(), Progress.find({ user: userId }).lean()]);
  const ids = new Set(allItems.map((i) => i._id.toString()));
  const items = allItems;
  const progress = subject ? allProgress.filter((p) => ids.has(p.item.toString())) : allProgress;
  const byItem = new Map(progress.map((p) => [p.item.toString(), p]));
  const today = todayKey();

  const lec = items.filter((i) => i.type === 'lec' && !i.week0);
  const w0 = items.filter((i) => i.type === 'lec' && i.week0);
  const tests = items.filter((i) => i.type === 'test');
  const has = (i, k) => !!byItem.get(i._id.toString())?.[k];

  // Heat map: ticks per calendar day.
  const heat = {};
  progress.forEach((p) => tickDays(p).forEach((d) => { heat[d] = (heat[d] || 0) + 1; }));

  // Weekly bars: ticks asked for by the plan vs ticks made, keyed by the Monday of each week.
  const planned = {};
  items.filter((i) => !i.week0 && i.date && i.type !== 'rest').forEach((i) => {
    const k = mondayOf(i.date);
    planned[k] = (planned[k] || 0) + (i.type === 'lec' ? 2 : 1);
  });
  const done = {};
  Object.entries(heat).forEach(([d, n]) => { const k = mondayOf(d); done[k] = (done[k] || 0) + n; });
  const weekKeys = [...new Set([...Object.keys(planned), ...Object.keys(done)])].sort();
  const weeks = weekKeys.map((k) => ({ monday: k, isoWeek: isoWeek(k), planned: planned[k] || 0, done: done[k] || 0 }));

  // Streak: consecutive days with at least one tick, counting back from today (or yesterday).
  let cursor = heat[today] ? today : addDays(today, -1);
  let streak = 0;
  while (heat[cursor]) { streak += 1; cursor = addDays(cursor, -1); }

  const due = lec.filter((i) => i.date <= today).length;
  const lecturesDone = lec.filter((i) => has(i, 'a')).length;

  return {
    today,
    totals: {
      lectures: { done: lecturesDone, total: lec.length },
      dpps: { done: lec.filter((i) => has(i, 'b')).length, total: lec.length },
      week0: { done: w0.filter((i) => has(i, 'a')).length, total: w0.length },
      tests: { done: tests.filter((i) => has(i, 'c')).length, total: tests.length },
    },
    behind: Math.max(0, due - lecturesDone),
    due,
    streak,
    lastTick: Object.keys(heat).sort().pop() || null,
    heat,
    weeks,
  };
}
