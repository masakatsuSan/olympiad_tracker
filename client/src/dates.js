export const DAYL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const DAYF = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// All date maths runs on "YYYY-MM-DD" strings through UTC, so the browser timezone never shifts a day.
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const fmt = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => fmt(new Date(parse(s).getTime() + n * 864e5));
export const monday = (s) => addDays(s, -((parse(s).getUTCDay() + 6) % 7));
export const dow = (s) => parse(s).getUTCDay();
export const short = (s) => { const d = parse(s); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
export const long = (s) => { const d = parse(s); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const dm = (s) => { const d = parse(s); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
export const monthLabel = (s) => { const d = parse(s); return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

export function isoWeek(s) {
  const t = parse(s); const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}

// Today in the learner's timezone as a day string.
export const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
export const dayOf = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));
