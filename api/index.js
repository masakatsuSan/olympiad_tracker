// Vercel serverless entry. Every /api/* request lands here and is handled by the Express app.
import { createApp } from '../server/src/app.js';
import { connectDb } from '../server/src/db.js';
import { bootstrap } from '../server/src/seed/bootstrap.js';

const app = createApp();

export default async function handler(req, res) {
  // vercel.json rewrites /api/x to /api/index?__p=x; restore the original path for Express.
  try {
    const u = new URL(req.url, 'http://x');
    if (u.searchParams.has('__p')) {
      const p = u.searchParams.get('__p');
      u.searchParams.delete('__p');
      req.url = '/api/' + p + (u.search || '');
    }
  } catch { /* leave the url as it is */ }
  try {
    await connectDb();
    await bootstrap();
  } catch (e) {
    console.error(e);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: 'The database is not reachable. Check MONGO_URI.' }));
  }
  return app(req, res);
}
