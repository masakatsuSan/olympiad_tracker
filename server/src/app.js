import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import planRoutes from './routes/plan.js';
import progressRoutes from './routes/progress.js';
import userRoutes from './routes/users.js';
import { notFound, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  if (!config.isProd && process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use('/api/plan/import', express.json({ limit: '2mb' })); // CSV files are bigger than ordinary requests
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/plan', planRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api', notFound);

  // Outside Vercel the API also serves the built React app (on Vercel the CDN serves it).
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (!process.env.VERCEL && fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
