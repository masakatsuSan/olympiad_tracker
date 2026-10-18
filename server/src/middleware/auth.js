import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';

export const httpError = (status, message) => Object.assign(new Error(message), { status });

export function signSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), v: user.tokenVersion }, config.jwtSecret, {
    expiresIn: `${config.tokenDays}d`,
  });
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.tokenDays * 864e5,
    path: '/',
  });
}

export const clearSession = (res) => res.clearCookie(config.cookieName, { path: '/' });

// Reads the cookie, loads the user and rejects stale tokens (password or role changed).
export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.[config.cookieName];
    if (!token) throw httpError(401, 'Please sign in.');
    let payload;
    try { payload = jwt.verify(token, config.jwtSecret); } catch { throw httpError(401, 'Your session expired. Please sign in again.'); }
    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.v) throw httpError(401, 'Your session expired. Please sign in again.');
    req.user = user;
    next();
  } catch (e) { next(e); }
}

export const requireAdmin = (req, _res, next) =>
  req.user?.role === 'admin' ? next() : next(httpError(403, 'Admins only.'));

// :uid is "me" or a user id. Learners may only touch their own data; admins may touch anyone's.
export async function resolveTarget(req, _res, next) {
  try {
    const uid = req.params.uid === 'me' ? req.user._id.toString() : req.params.uid;
    if (!/^[a-f\d]{24}$/i.test(uid)) throw httpError(400, 'Invalid learner id.');
    if (uid !== req.user._id.toString() && req.user.role !== 'admin') throw httpError(403, 'You can only see your own progress.');
    if (uid !== req.user._id.toString()) {
      const exists = await User.exists({ _id: uid });
      if (!exists) throw httpError(404, 'Learner not found.');
    }
    req.targetId = uid;
    req.isSelf = uid === req.user._id.toString();
    next();
  } catch (e) { next(e); }
}
