import { ZodError } from 'zod';

export const notFound = (_req, _res, next) => next(Object.assign(new Error('Not found.'), { status: 404 }));

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: `${first.path.join('.') || 'input'}: ${first.message}`, issues: err.issues });
  }
  if (err?.code === 11000) return res.status(409).json({ error: 'That value already exists.' });
  if (err?.name === 'ValidationError') return res.status(400).json({ error: err.message });
  if (err?.name === 'CastError') return res.status(400).json({ error: 'Invalid id.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
}
