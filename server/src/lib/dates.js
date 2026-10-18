import { config } from '../config.js';

// "2026-10-13" for the calendar day a moment falls on in the app timezone.
const fmt = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
export const dayKey = (date, tz = config.tz) => fmt(tz).format(date);
export const todayKey = () => dayKey(new Date());

export const parseDay = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const toDay = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => toDay(new Date(parseDay(s).getTime() + n * 864e5));

// Monday of the week that contains the given day key.
export const mondayOf = (s) => {
  const dow = (parseDay(s).getUTCDay() + 6) % 7;
  return addDays(s, -dow);
};

// ISO-8601 week number (1-53), computed on UTC dates so it never shifts with the server clock.
export const isoWeek = (s) => {
  const t = parseDay(s);
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
};
