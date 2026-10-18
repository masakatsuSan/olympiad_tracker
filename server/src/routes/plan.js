import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { PlanItem } from '../models/PlanItem.js';
import { Chapter } from '../models/Chapter.js';
import { Subject } from '../models/Subject.js';
import { Progress } from '../models/Progress.js';
import { requireAuth, requireAdmin, httpError } from '../middleware/auth.js';
import { exportCSV, planImport, CSV_TEMPLATE } from '../lib/csv.js';
import { addDays, parseDay } from '../lib/dates.js';

// Large bulk writes are sent in batches of 50 so no single request grows without bound.
async function bulk(Model, ops) {
  for (let i = 0; i < ops.length; i += 50) await Model.bulkWrite(ops.slice(i, i + 50));
}

const router = Router();
router.use(requireAuth);

const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');

const subjectBody = z.object({ name: z.string().trim().min(1, 'Give the subject a name.').max(80) });
const itemBody = z.object({
  subject: oid,
  type: z.enum(['lec', 'rev', 'test', 'rest']),
  week0: z.boolean().default(false),
  date: day.nullable().optional(),
  origDate: day.nullable().optional(),
  chapter: z.number().int().positive().nullable().optional(),
  topic: z.string().max(160).default(''),
  name: z.string().max(120).default(''),
  text: z.string().max(400).default(''),
  order: z.number().int().default(0),
}).superRefine((v, ctx) => {
  if (!v.week0 && !v.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'A dated item needs a plan date.' });
  if (v.type === 'lec' && !v.chapter) ctx.addIssue({ code: 'custom', path: ['chapter'], message: 'A lecture needs a chapter.' });
});
const chapterBody = z.object({
  subject: oid,
  n: z.number().int().positive(),
  name: z.string().trim().min(1, 'Give the chapter a name.').max(120),
  part: z.string().trim().max(60).default(''),
  summary: z.string().max(600).default(''),
  topics: z.array(z.string().trim().min(1).max(160)).max(60).default([]),
  tip: z.string().max(400).default(''),
});

const pubItem = ({ _id, __v, subject, createdAt, updatedAt, ...r }) => ({ id: _id.toString(), subject: subject.toString(), ...r });
const pubChapter = ({ _id, __v, subject, createdAt, updatedAt, ...c }) => ({ id: _id.toString(), subject: subject.toString(), ...c });
const pubSubject = ({ _id, __v, createdAt, updatedAt, ...s }) => ({ id: _id.toString(), ...s });

async function snapshot() {
  const [subjects, chapters, items] = await Promise.all([
    Subject.find().sort({ order: 1, createdAt: 1 }).lean(),
    Chapter.find().sort({ n: 1 }).lean(),
    PlanItem.find().sort({ week0: -1, date: 1, order: 1, createdAt: 1 }).lean(),
  ]);
  return { subjects: subjects.map(pubSubject), chapters: chapters.map(pubChapter), items: items.map(pubItem) };
}

// Everything a learner needs to draw the schedule and the chapter pages.
router.get('/', async (_req, res, next) => { try { res.json(await snapshot()); } catch (e) { next(e); } });

/* ---------- subjects ---------- */
router.post('/subjects', requireAdmin, async (req, res, next) => {
  try {
    const { name } = subjectBody.parse(req.body);
    const order = await Subject.countDocuments();
    const doc = await Subject.create({ name, order });
    res.status(201).json({ id: doc._id.toString() });
  } catch (e) { next(e); }
});
router.put('/subjects/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name } = subjectBody.parse(req.body);
    const doc = await Subject.findByIdAndUpdate(oid.parse(req.params.id), { name }, { new: true, runValidators: true });
    if (!doc) throw httpError(404, 'Subject not found.');
    res.json({ id: doc._id.toString() });
  } catch (e) { next(e); }
});
router.delete('/subjects/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = oid.parse(req.params.id);
    if ((await Chapter.exists({ subject: id })) || (await PlanItem.exists({ subject: id }))) throw httpError(409, "Remove this subject's chapters and schedule items first.");
    if ((await Subject.countDocuments()) < 2) throw httpError(409, 'Keep at least one subject.');
    const doc = await Subject.findByIdAndDelete(id);
    if (!doc) throw httpError(404, 'Subject not found.');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- schedule items ---------- */
async function checkRefs(body) {
  if (!(await Subject.exists({ _id: body.subject }))) throw httpError(400, 'That subject does not exist.');
  if (body.type === 'lec' && !(await Chapter.exists({ subject: body.subject, n: body.chapter }))) throw httpError(400, 'That chapter does not exist in this subject.');
}
const clean = (b) => ({ ...b, date: b.week0 ? null : b.date, origDate: b.week0 ? b.origDate || null : null, chapter: b.type === 'lec' ? b.chapter : null });

router.post('/items', requireAdmin, async (req, res, next) => {
  try {
    const body = itemBody.parse(req.body);
    await checkRefs(body);
    const doc = await PlanItem.create(clean(body));
    res.status(201).json({ id: doc._id.toString() });
  } catch (e) { next(e); }
});
router.put('/items/:id', requireAdmin, async (req, res, next) => {
  try {
    const body = itemBody.parse(req.body);
    await checkRefs(body);
    const doc = await PlanItem.findByIdAndUpdate(oid.parse(req.params.id), clean(body), { new: true, runValidators: true });
    if (!doc) throw httpError(404, 'Item not found.');
    res.json({ id: doc._id.toString() });
  } catch (e) { next(e); }
});
router.delete('/items/:id', requireAdmin, async (req, res, next) => {
  try {
    const doc = await PlanItem.findByIdAndDelete(oid.parse(req.params.id));
    if (!doc) throw httpError(404, 'Item not found.');
    await Progress.deleteMany({ item: doc._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- chapters (sub-topics live inside) ---------- */
router.post('/chapters', requireAdmin, async (req, res, next) => {
  try {
    const body = chapterBody.parse(req.body);
    if (!(await Subject.exists({ _id: body.subject }))) throw httpError(400, 'That subject does not exist.');
    const doc = await Chapter.create(body);
    res.status(201).json({ id: doc._id.toString() });
  } catch (e) { if (e?.code === 11000) e = httpError(409, 'That chapter number is taken in this subject.'); next(e); }
});
router.put('/chapters/:id', requireAdmin, async (req, res, next) => {
  try {
    const body = chapterBody.parse(req.body);
    const cur = await Chapter.findById(oid.parse(req.params.id));
    if (!cur) throw httpError(404, 'Chapter not found.');
    if (!(await Subject.exists({ _id: body.subject }))) throw httpError(400, 'That subject does not exist.');
    const moved = String(cur.subject) !== body.subject || cur.n !== body.n;
    const from = { subject: cur.subject, chapter: cur.n };
    cur.set(body);
    await cur.save();
    // Lectures follow the chapter when its number or subject changes.
    if (moved) await PlanItem.updateMany({ ...from, type: 'lec' }, { $set: { subject: body.subject, chapter: body.n } });
    res.json({ id: cur._id.toString() });
  } catch (e) { if (e?.code === 11000) e = httpError(409, 'That chapter number is taken in this subject.'); next(e); }
});
router.delete('/chapters/:id', requireAdmin, async (req, res, next) => {
  try {
    const c = await Chapter.findById(oid.parse(req.params.id));
    if (!c) throw httpError(404, 'Chapter not found.');
    if (await PlanItem.exists({ subject: c.subject, type: 'lec', chapter: c.n })) throw httpError(409, "Remove this chapter's lectures first.");
    await c.deleteOne();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- change dates: move everything on or after `from` so that `from` lands on `to` ---------- */
const shiftBody = z.object({ subject: oid.nullable().optional(), from: day, to: day });
router.post('/shift', requireAdmin, async (req, res, next) => {
  try {
    const b = shiftBody.parse(req.body);
    const days = Math.round((parseDay(b.to) - parseDay(b.from)) / 864e5);
    if (!days) throw httpError(400, 'The dates are the same, nothing to move.');
    const filter = { week0: false, date: { $gte: b.from }, ...(b.subject ? { subject: b.subject } : {}) };
    const items = await PlanItem.find(filter).select('date').lean();
    if (!items.length) throw httpError(400, 'No dated items on or after that date.');
    await bulk(PlanItem, items.map((i) => ({ updateOne: { filter: { _id: i._id }, update: { $set: { date: addDays(i.date, days) } } } })));
    res.json({ moved: items.length, days });
  } catch (e) { next(e); }
});

/* ---------- CSV ---------- */
router.get('/export.csv', requireAdmin, async (_req, res, next) => {
  try {
    res.type('text/csv').set('Content-Disposition', 'attachment; filename="study-plan.csv"').send(exportCSV(await snapshot()));
  } catch (e) { next(e); }
});
router.get('/template.csv', requireAdmin, (_req, res) => {
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="study-plan-template.csv"').send(CSV_TEMPLATE);
});

const importBody = z.object({ csv: z.string().min(1, 'Paste or choose a CSV first.').max(1_500_000), mode: z.enum(['merge', 'replace']).default('merge'), dryRun: z.boolean().default(false) });
router.post('/import', requireAdmin, async (req, res, next) => {
  try {
    const b = importBody.parse(req.body);
    const cur = await snapshot();
    const r = planImport(cur, b.csv, b.mode, () => new mongoose.Types.ObjectId().toString());
    const summary = { stats: r.stats, errors: r.errors.slice(0, 50), errorCount: r.errors.length };
    const nothing = !r.state || r.stats.added + r.stats.updated + r.stats.chaptersNew + r.stats.topics + r.stats.subjectsNew + r.stats.removed === 0;
    if (b.dryRun || nothing) return res.json({ ...summary, applied: false });

    const ob = (x) => new mongoose.Types.ObjectId(x);
    const S = r.state;
    const ops = { subjects: [], chapters: [], items: [] };
    S.subjects.forEach((s, i) => { if (r.created.subjects.has(s.id)) ops.subjects.push({ insertOne: { document: { _id: ob(s.id), name: s.name, key: s.name.trim().toLowerCase(), order: i } } }); });
    S.chapters.forEach((c) => {
      const doc = { subject: ob(c.subject), n: c.n, name: c.name, part: c.part || '', summary: c.summary || '', topics: c.topics || [], tip: c.tip || '' };
      if (r.created.chapters.has(c.id)) ops.chapters.push({ insertOne: { document: { _id: ob(c.id), ...doc } } });
      else if (r.changed.chapters.has(c.id)) ops.chapters.push({ updateOne: { filter: { _id: ob(c.id) }, update: { $set: { name: doc.name, part: doc.part, topics: doc.topics } } } });
    });
    S.items.forEach((it) => {
      const doc = { subject: ob(it.subject), type: it.type, week0: !!it.week0, date: it.date || null, origDate: it.origDate || null, chapter: it.chapter ?? null, topic: it.topic || '', name: it.name || '', text: it.text || '', order: it.order || 0 };
      if (r.created.items.has(it.id)) ops.items.push({ insertOne: { document: { _id: ob(it.id), ...doc } } });
      else if (r.changed.items.has(it.id)) ops.items.push({ updateOne: { filter: { _id: ob(it.id) }, update: { $set: doc } } });
    });
    if (ops.subjects.length) await bulk(Subject, ops.subjects);
    if (r.remove.items.length) {
      await PlanItem.deleteMany({ _id: { $in: r.remove.items.map(ob) } });
      await Progress.deleteMany({ item: { $in: r.remove.items.map(ob) } });
    }
    if (r.remove.chapters.length) await Chapter.deleteMany({ _id: { $in: r.remove.chapters.map(ob) } });
    if (ops.chapters.length) await bulk(Chapter, ops.chapters);
    if (ops.items.length) await bulk(PlanItem, ops.items);
    if (r.remove.subjects.length) await Subject.deleteMany({ _id: { $in: r.remove.subjects.map(ob) } });
    res.json({ ...summary, applied: true });
  } catch (e) { next(e); }
});

export default router;
