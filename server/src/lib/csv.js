// CSV reading and writing, plus the plan import. Pure functions: no database access here.
import { parseDay, toDay } from './dates.js';

export const CSV_COLS = ['id', 'subject', 'chapter_no', 'chapter_name', 'group', 'subtopic', 'type', 'date', 'week0', 'title', 'text'];
const ALIAS = {
  id: 'id', subject: 'subject', course: 'subject',
  chapterno: 'chapter_no', chapter: 'chapter_no', ch: 'chapter_no', chapternumber: 'chapter_no',
  chaptername: 'chapter_name', group: 'group', part: 'group', unit: 'group',
  subtopic: 'subtopic', topic: 'subtopic', lecture: 'subtopic', lecturetopic: 'subtopic', lecturetitle: 'subtopic',
  type: 'type', date: 'date', plandate: 'date', week0: 'week0', wk0: 'week0',
  title: 'title', testname: 'title', name: 'title', text: 'text', notes: 'text', syllabus: 'text',
};
const TYPES = { '': 'lec', lecture: 'lec', lec: 'lec', l: 'lec', subtopic: 'lec', revision: 'rev', rev: 'rev', revise: 'rev', test: 'test', exam: 'test', rest: 'rest', holiday: 'rest', off: 'rest' };
export const TYPE_WORD = { lec: 'lecture', rev: 'revision', test: 'test', rest: 'rest' };

export function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const count = (ch) => first.split(ch).length - 1;
  const delim = count('\t') > 0 ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const cell = (v) => {
  v = v == null ? '' : String(v);
  // A leading = + - @ can run as a formula when the file is opened in a spreadsheet, so it is prefixed.
  if (/^[=+\-@]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = "'" + v;
  return /[",\n\r;\t]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};
const line = (a) => a.map(cell).join(',');

// "2026-10-12" or "12/10/2026" (day first). Returns '' for blank and null for invalid.
export function parseDate(s) {
  s = String(s || '').trim();
  if (!s) return '';
  let y, m, d, x;
  if ((x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) [y, m, d] = [x[1], x[2], x[3]];
  else if ((x = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(s))) [d, m, y] = [x[1], x[2], x[3]];
  else return null;
  y = +y; m = +m; d = +d;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return toDay(t);
}

// state = { subjects:[{id,name}], chapters:[{id,subject,n,name,part,topics}], items:[{id,subject,type,week0,date,origDate,chapter,topic,name,text}] }
export function exportCSV(state) {
  const out = [line(CSV_COLS)];
  const subName = new Map(state.subjects.map((s) => [s.id, s.name]));
  for (const sj of state.subjects) {
    const chs = state.chapters.filter((c) => c.subject === sj.id).sort((a, b) => a.n - b.n);
    for (const c of chs) {
      const rows = state.items.filter((r) => r.type === 'lec' && r.subject === sj.id && r.chapter === c.n);
      const used = new Set(rows.map((r) => (r.topic || '').toLowerCase()));
      const base = ['', sj.name, c.n, c.name, c.part || ''];
      rows.forEach((r) => out.push(line([r.id, sj.name, c.n, c.name, c.part || '', r.topic, 'lecture', r.week0 ? r.origDate || '' : r.date, r.week0 ? 'yes' : '', '', ''])));
      (c.topics || []).filter((t) => !used.has(t.toLowerCase())).forEach((t) => out.push(line([...base, t, 'lecture', '', '', '', ''])));
      if (!rows.length && !(c.topics || []).length) out.push(line([...base, '', '', '', '', '', '']));
    }
  }
  state.items.filter((r) => r.type !== 'lec').forEach((r) =>
    out.push(line([r.id, subName.get(r.subject) || '', '', '', '', '', TYPE_WORD[r.type], r.week0 ? r.origDate || '' : r.date, r.week0 ? 'yes' : '', r.type === 'test' ? r.name : '', r.text || ''])));
  return out.join('\r\n') + '\r\n';
}

export const CSV_TEMPLATE = [
  'subject,chapter_no,chapter_name,group,subtopic,type,date,week0,title,text',
  'Mathematics,4,Factorization,Algebra,Taking common factors,lecture,2026-10-12,,,',
  'Mathematics,4,Factorization,Algebra,Grouping method,lecture,2026-10-13,,,',
  'Mathematics,,,,,revision,2026-10-17,,,Revise chapter 4',
  'Mathematics,,,,,test,2026-10-18,,Test 1,Chapters 1 to 4',
  'Physics,1,Kinematics,Mechanics,Speed and velocity,lecture,2026-10-14,,,',
  'Physics,1,Kinematics,Mechanics,Equations of motion,lecture,,,,sub-topic only: no date yet',
].join('\r\n') + '\r\n';

const idOk = (x) => typeof x === 'string' && /^[a-f\d]{24}$/i.test(x);

/**
 * Applies CSV text to a copy of the plan. Returns { errors, stats, state, touched } and never writes anywhere.
 * mode "merge" adds and updates; mode "replace" also lists everything the CSV did not mention for removal.
 * newId() makes ids for new subjects, chapters and items so the caller can insert them as they are.
 */
export function planImport(current, text, mode, newId) {
  const res = { errors: [], stats: { subjectsNew: 0, chaptersNew: 0, added: 0, updated: 0, topics: 0, skipped: 0, removed: 0 }, state: null, created: { subjects: new Set(), chapters: new Set(), items: new Set() }, changed: { subjects: new Set(), chapters: new Set(), items: new Set() }, remove: { subjects: [], chapters: [], items: [] } };
  const grid = parseCSV(text);
  if (grid.length < 2) { res.errors.push('Add a header row and at least one data row.'); return res; }
  const head = grid[0].map((h) => ALIAS[String(h).toLowerCase().replace(/[^a-z0-9]/g, '')] || null);
  if (!['subject', 'chapter_no', 'subtopic', 'type'].some((k) => head.includes(k))) {
    res.errors.push('Header not recognised. Expected columns like: ' + CSV_COLS.slice(1).join(', ') + '.');
    return res;
  }
  const S = JSON.parse(JSON.stringify(current));
  const touched = { subjects: new Set(), chapters: new Set(), items: new Set() };
  const stat = res.stats;
  const findSub = (name) => S.subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
  const last = { subject: '', chapter_no: '', chapter_name: '', group: '' };

  for (let i = 1; i < grid.length; i++) {
    const ln = i + 1;
    const rec = {};
    head.forEach((k, j) => { if (k) rec[k] = String(grid[i][j] == null ? '' : grid[i][j]).trim().replace(/^'(?=[=+\-@])/, ''); });
    CSV_COLS.forEach((k) => { if (rec[k] == null) rec[k] = ''; });
    const bad = (m) => { res.errors.push(`Row ${ln}: ${m}`); stat.skipped++; };
    const type = TYPES[rec.type.toLowerCase()];
    if (!type) { bad(`unknown type "${rec.type}" (use lecture, revision, test or rest)`); continue; }
    const date = parseDate(rec.date);
    if (date === null) { bad(`date "${rec.date}" is not YYYY-MM-DD or DD/MM/YYYY`); continue; }
    const wk0 = /^(y|yes|true|1|x)$/i.test(rec.week0);
    if (rec.subject) last.subject = rec.subject;
    const sname = rec.subject || last.subject || (S.subjects[0] ? S.subjects[0].name : 'Mathematics');
    let sj = findSub(sname);
    if (!sj) { sj = { id: newId(), name: sname }; S.subjects.push(sj); res.created.subjects.add(sj.id); stat.subjectsNew++; }
    touched.subjects.add(sj.id);

    const markItem = (row, isNew) => { touched.items.add(row.id); (isNew ? res.created.items : res.changed.items).add(row.id); isNew ? stat.added++ : stat.updated++; };
    const matchById = () => (idOk(rec.id) ? S.items.find((r) => r.id === rec.id) : null);

    if (type === 'lec') {
      if (rec.chapter_no) { last.chapter_no = rec.chapter_no; last.chapter_name = rec.chapter_name; last.group = rec.group; }
      const cn = parseInt((rec.chapter_no || last.chapter_no || '').replace(/[^\d]/g, ''), 10);
      if (!cn) { bad('chapter number is missing'); continue; }
      let c = S.chapters.find((x) => x.subject === sj.id && x.n === cn);
      const cname = rec.chapter_name || (rec.chapter_no ? '' : last.chapter_name);
      if (!c) {
        c = { id: newId(), subject: sj.id, n: cn, name: cname || `Chapter ${cn}`, part: rec.group || last.group || '', summary: '', topics: [], tip: '' };
        S.chapters.push(c); res.created.chapters.add(c.id); stat.chaptersNew++;
      } else {
        if (rec.chapter_name && rec.chapter_name !== c.name) { c.name = rec.chapter_name; res.changed.chapters.add(c.id); }
        if (rec.group && rec.group !== c.part) { c.part = rec.group; res.changed.chapters.add(c.id); }
      }
      touched.chapters.add(c.id);
      const topic = rec.subtopic;
      if (!topic) continue;
      if (!(c.topics || []).some((t) => t.toLowerCase() === topic.toLowerCase())) {
        c.topics = (c.topics || []).concat(topic); stat.topics++; res.changed.chapters.add(c.id);
      }
      if (!date && !wk0) continue; // sub-topic only, nothing scheduled
      let row = matchById() || S.items.find((r) => r.type === 'lec' && r.subject === sj.id && r.chapter === cn && (r.topic || '').toLowerCase() === topic.toLowerCase());
      const isNew = !row;
      if (isNew) { row = { id: newId() }; S.items.push(row); }
      Object.assign(row, { type: 'lec', subject: sj.id, chapter: cn, topic, order: i });
      if (wk0) { row.week0 = true; row.date = null; if (date) row.origDate = date; } else { row.week0 = false; row.origDate = null; row.date = date; }
      markItem(row, isNew);
    } else {
      if (!date) { bad(`a ${TYPE_WORD[type]} needs a date`); continue; }
      const title = rec.title || (type === 'test' ? 'Test' : '');
      let row = matchById() || S.items.find((r) => r.type === type && r.subject === sj.id && r.date === date && !r.week0 && (type !== 'test' || (r.name || '') === title));
      const isNew = !row;
      if (isNew) { row = { id: newId() }; S.items.push(row); }
      Object.assign(row, { type, subject: sj.id, chapter: null, order: i });
      if (wk0) { row.week0 = true; row.date = null; row.origDate = date; } else { row.week0 = false; row.origDate = null; row.date = date; }
      if (type === 'test') { row.name = title; row.text = rec.text; row.topic = ''; } else { row.text = rec.text || rec.title; row.name = ''; row.topic = ''; }
      markItem(row, isNew);
    }
  }
  if (mode === 'replace') {
    res.remove.items = S.items.filter((r) => !touched.items.has(r.id)).map((r) => r.id);
    res.remove.chapters = S.chapters.filter((c) => !touched.chapters.has(c.id)).map((c) => c.id);
    res.remove.subjects = S.subjects.filter((s) => !touched.subjects.has(s.id)).map((s) => s.id);
    stat.removed = res.remove.items.length;
    const gone = { i: new Set(res.remove.items), c: new Set(res.remove.chapters), s: new Set(res.remove.subjects) };
    S.items = S.items.filter((r) => !gone.i.has(r.id));
    S.chapters = S.chapters.filter((c) => !gone.c.has(c.id));
    S.subjects = S.subjects.filter((s) => !gone.s.has(s.id));
  }
  res.state = S;
  return res;
}
