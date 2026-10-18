import { Router } from 'express';
import { z } from 'zod';
import { PlanItem, KINDS_FOR } from '../models/PlanItem.js';
import { Progress } from '../models/Progress.js';
import { requireAuth, requireAdmin, resolveTarget, httpError } from '../middleware/auth.js';
import { userStats } from '../lib/stats.js';

const router = Router();
router.use(requireAuth);

const out = (p) => ({ a: p.a || null, b: p.b || null, c: p.c || null, note: p.note || '', score: p.score || '' });

router.get('/:uid', resolveTarget, async (req, res, next) => {
  try {
    const rows = await Progress.find({ user: req.targetId }).lean();
    res.json({ progress: Object.fromEntries(rows.map((p) => [p.item.toString(), out(p)])) });
  } catch (e) { next(e); }
});

router.get('/:uid/stats', resolveTarget, async (req, res, next) => {
  try { const sub = /^[a-f\d]{24}$/i.test(String(req.query.subject || '')) ? String(req.query.subject) : null; res.json(await userStats(req.targetId, sub)); } catch (e) { next(e); }
});

// Tick once. The filter only matches while the box is still empty, so two requests can never both win,
// and a learner can never overwrite or clear a tick. A duplicate key means "already ticked".
router.post('/:uid/:itemId/tick', resolveTarget, async (req, res, next) => {
  try {
    const { kind } = z.object({ kind: z.enum(['a', 'b', 'c']) }).parse(req.body);
    const item = await PlanItem.findById(req.params.itemId).lean();
    if (!item) throw httpError(404, 'Item not found.');
    if (!KINDS_FOR[item.type].includes(kind)) throw httpError(400, 'That box does not exist for this item.');
    try {
      const doc = await Progress.findOneAndUpdate(
        { user: req.targetId, item: item._id, [kind]: null },
        { $set: { [kind]: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      res.status(201).json({ progress: out(doc) });
    } catch (e) {
      if (e.code === 11000) throw httpError(409, 'Already ticked. Ask an admin to unlock it.');
      throw e;
    }
  } catch (e) { next(e); }
});

// Admin only: unlock a box.
router.delete('/:uid/:itemId/:kind', requireAdmin, resolveTarget, async (req, res, next) => {
  try {
    const kind = z.enum(['a', 'b', 'c']).parse(req.params.kind);
    const doc = await Progress.findOneAndUpdate({ user: req.targetId, item: req.params.itemId }, { $set: { [kind]: null } }, { new: true });
    res.json({ progress: doc ? out(doc) : null });
  } catch (e) { next(e); }
});

const noteBody = z.object({ note: z.string().max(500).optional(), score: z.string().max(20).optional() });
router.put('/:uid/:itemId/note', resolveTarget, async (req, res, next) => {
  try {
    const body = noteBody.parse(req.body);
    if (!(await PlanItem.exists({ _id: req.params.itemId }))) throw httpError(404, 'Item not found.');
    const doc = await Progress.findOneAndUpdate({ user: req.targetId, item: req.params.itemId }, { $set: body }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ progress: out(doc) });
  } catch (e) { next(e); }
});

router.delete('/:uid', requireAdmin, resolveTarget, async (req, res, next) => {
  try { const r = await Progress.deleteMany({ user: req.targetId }); res.json({ removed: r.deletedCount }); } catch (e) { next(e); }
});

export default router;
