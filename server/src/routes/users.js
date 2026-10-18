import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Progress } from '../models/Progress.js';
import { requireAuth, requireAdmin, httpError } from '../middleware/auth.js';
import { userStats } from '../lib/stats.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const createBody = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8, 'Use at least 8 characters.').max(100),
  role: z.enum(['admin', 'user']).default('user'),
});
const patchBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(['admin', 'user']).optional(),
  password: z.string().min(8, 'Use at least 8 characters.').max(100).optional(),
});

router.get('/', async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    const rows = await Promise.all(users.map(async (u) => {
      const s = await userStats(u._id);
      return { ...u.toSafe(), lectures: s.totals.lectures, dpps: s.totals.dpps, streak: s.streak, behind: s.behind, lastTick: s.lastTick };
    }));
    res.json({ users: rows });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = createBody.parse(req.body);
    const user = await User.create({ name: b.name, email: b.email, role: b.role, passwordHash: await bcrypt.hash(b.password, 11) });
    res.status(201).json({ user: user.toSafe() });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const b = patchBody.parse(req.body);
    const user = await User.findById(req.params.id).select('+passwordHash');
    if (!user) throw httpError(404, 'Learner not found.');
    if (b.role && b.role !== user.role) {
      if (user._id.equals(req.user._id)) throw httpError(400, 'You cannot change your own role.');
      user.role = b.role; user.tokenVersion += 1;
    }
    if (b.name) user.name = b.name;
    if (b.password) { user.passwordHash = await bcrypt.hash(b.password, 11); user.tokenVersion += 1; }
    await user.save();
    res.json({ user: user.toSafe() });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user._id.equals(req.params.id)) throw httpError(400, 'You cannot delete your own account.');
    const user = await User.findById(req.params.id);
    if (!user) throw httpError(404, 'Learner not found.');
    await user.deleteOne();
    await Progress.deleteMany({ user: user._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
