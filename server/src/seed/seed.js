import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { Subject } from '../models/Subject.js';
import { Chapter } from '../models/Chapter.js';
import { PlanItem } from '../models/PlanItem.js';
import { Progress } from '../models/Progress.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

// Loads the built-in Mathematics plan. Does nothing when a plan already exists unless reset is true.
export async function seedPlan({ reset = false } = {}) {
  if (reset) await Promise.all([Subject.deleteMany({}), Chapter.deleteMany({}), PlanItem.deleteMany({}), Progress.deleteMany({})]);
  if (await Subject.countDocuments()) return false;
  const math = await Subject.create({ name: 'Mathematics', order: 0 });
  await Chapter.insertMany(data.chapters.map((c) => ({ ...c, subject: math._id })));
  await PlanItem.insertMany(data.rows.map((r, i) => ({
    subject: math._id, type: r.type, week0: !!r.wk0, date: r.wk0 ? null : r.date, origDate: r.orig || null,
    chapter: r.ch ?? null, topic: r.topic || '', name: r.name || '', text: r.text || '', order: i,
  })));
  return true;
}

export async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  if (await User.exists({ email })) return false;
  await User.create({ name: process.env.ADMIN_NAME || 'Admin', email, role: 'admin', passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 11) });
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await mongoose.connect(config.mongoUri);
  const reset = process.argv.includes('--reset');
  await seedPlan({ reset });
  const created = await seedAdmin();
  console.log(`Plan ${reset ? 'reset and ' : ''}seeded: ${await Subject.countDocuments()} subjects, ${await Chapter.countDocuments()} chapters, ${await PlanItem.countDocuments()} items.`);
  console.log(created ? 'Admin account created from ADMIN_EMAIL / ADMIN_PASSWORD. Change the password after first sign-in.' : 'Admin account already exists.');
  await mongoose.disconnect();
}
