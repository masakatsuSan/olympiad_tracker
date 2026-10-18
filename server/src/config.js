import 'dotenv/config';

const need = (k, fallback) => {
  const v = process.env[k] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var ${k}`);
  return v;
};

export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: need('MONGO_URI', 'mongodb://127.0.0.1:27017/olympiad_tracker'),
  jwtSecret: need('JWT_SECRET', process.env.NODE_ENV === 'production' ? undefined : 'dev-only-secret'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  tz: process.env.APP_TZ || 'Asia/Kolkata',
  isProd: process.env.NODE_ENV === 'production',
  cookieName: 'ot_session',
  tokenDays: 7,
};
