import mongoose from 'mongoose';
import { config } from './config.js';

// Serverless functions start cold many times, so the connection is cached on globalThis and reused.
const g = globalThis;
g.__otMongo ||= { promise: null };

export function connectDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!g.__otMongo.promise) {
    g.__otMongo.promise = mongoose
      .connect(config.mongoUri, { bufferCommands: false, serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
      .catch((e) => { g.__otMongo.promise = null; throw e; });
  }
  return g.__otMongo.promise;
}
