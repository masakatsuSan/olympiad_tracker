import { User } from '../models/User.js';
import { seedPlan, seedAdmin } from './seed.js';

// First request on an empty database: create the admin from ADMIN_EMAIL / ADMIN_PASSWORD and load the built-in plan.
// Runs once per server instance. It only fires when there are no users at all, so a deleted account is never recreated.
let bootAttempted = false;
let bootPromise = null;
export function bootstrap() {
  if (process.env.AUTO_SEED === 'false') return Promise.resolve();
  if (!bootAttempted) {
    bootAttempted = true;
    bootPromise = (async () => {
      if (await User.estimatedDocumentCount()) return;
      await seedAdmin();
      await seedPlan();
    })().catch((e) => { bootAttempted = false; bootPromise = null; throw e; });
  }
  return bootPromise;
}
