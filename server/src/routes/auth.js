import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { signSession, clearSession, requireAuth, httpError } from '../middleware/auth.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again in a few minutes.' } });

const loginBody = z.object({ email: z.string().email(), password: z.string().min(1) });
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/login', limiter, async (req, res, next) => {
  try {
    const { email, password } = loginBody.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    // Compare against a dummy hash when the user does not exist so timing does not reveal accounts.
    const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
    if (!user || !ok) throw httpError(401, 'Email or password is wrong.');
    user.lastLoginAt = new Date();
    await user.save();
    signSession(res, user);
    res.json({ user: user.toSafe() });
  } catch (e) { next(e); }
});

router.post('/logout', (_req, res) => { clearSession(res); res.json({ ok: true }); });

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafe() }));

const pwBody = z.object({ current: z.string().min(1), next: z.string().min(8, 'Use at least 8 characters.').max(100) });
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { current, next: nextPw } = pwBody.parse(req.body);
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await bcrypt.compare(current, user.passwordHash))) throw httpError(400, 'Current password is wrong.');
    user.passwordHash = await bcrypt.hash(nextPw, 11);
    user.tokenVersion += 1;
    await user.save();
    signSession(res, user);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
