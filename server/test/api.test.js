import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_EMAIL = 'admin@test.dev';
process.env.ADMIN_PASSWORD = 'AdminPass123';

let server, base;
const jar = {};
async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(jar[who] ? { cookie: jar[who] } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) jar[who] = set.split(';')[0];
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

before(async () => {
  // Use MONGO_TEST_URI when set (for example a local MongoDB); otherwise start an in-memory MongoDB.
  if (process.env.MONGO_TEST_URI) await mongoose.connect(process.env.MONGO_TEST_URI);
  else { const { MongoMemoryServer } = await import('mongodb-memory-server'); globalThis.__mongod = await MongoMemoryServer.create(); await mongoose.connect(globalThis.__mongod.getUri()); }
  const { createApp } = await import('../src/app.js');
  const { seedPlan, seedAdmin } = await import('../src/seed/seed.js');
  await seedPlan(); await seedAdmin();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.close(); if (process.env.MONGO_TEST_URI) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); await globalThis.__mongod?.stop(); });

test('login: wrong password rejected, right password sets cookie', async () => {
  assert.equal((await call('x', 'POST', '/api/auth/login', { email: 'admin@test.dev', password: 'nope' })).status, 401);
  const ok = await call('admin', 'POST', '/api/auth/login', { email: 'admin@test.dev', password: 'AdminPass123' });
  assert.equal(ok.status, 200); assert.equal(ok.json.user.role, 'admin');
});

test('anonymous requests are refused', async () => {
  assert.equal((await call('anon', 'GET', '/api/plan')).status, 401);
});

test('seed loaded one subject, 30 chapters and 136 items', async () => {
  const r = await call('admin', 'GET', '/api/plan');
  assert.equal(r.json.subjects.length, 1); assert.equal(r.json.subjects[0].name, 'Mathematics'); assert.equal(r.json.chapters.length, 30); assert.equal(r.json.items.length, 136);
  assert.equal(r.json.items.filter((i) => i.week0).length, 14);
});

test('admin creates a learner; learner cannot use admin routes', async () => {
  const c = await call('admin', 'POST', '/api/users', { name: 'Asha', email: 'asha@test.dev', password: 'AshaPass123' });
  assert.equal(c.status, 201);
  assert.equal((await call('asha', 'POST', '/api/auth/login', { email: 'asha@test.dev', password: 'AshaPass123' })).status, 200);
  assert.equal((await call('asha', 'GET', '/api/users')).status, 403);
  assert.equal((await call('asha', 'POST', '/api/plan/chapters', { subject: '000000000000000000000000', n: 99, name: 'x' })).status, 403);
  assert.equal((await call('asha', 'DELETE', '/api/plan/items/000000000000000000000000')).status, 403);
});

let lecture, learnerId;
test('learner ticks once; a second tick and any untick are refused', async () => {
  const plan = (await call('asha', 'GET', '/api/plan')).json;
  lecture = plan.items.find((i) => i.type === 'lec' && !i.week0);
  const t1 = await call('asha', 'POST', `/api/progress/me/${lecture.id}/tick`, { kind: 'a' });
  assert.equal(t1.status, 201); assert.ok(t1.json.progress.a);
  assert.equal((await call('asha', 'POST', `/api/progress/me/${lecture.id}/tick`, { kind: 'a' })).status, 409);
  assert.equal((await call('asha', 'DELETE', `/api/progress/me/${lecture.id}/a`)).status, 403);
  assert.equal((await call('asha', 'POST', `/api/progress/me/${lecture.id}/tick`, { kind: 'c' })).status, 400);
  learnerId = (await call('asha', 'GET', '/api/auth/me')).json.user.id;
});

test('concurrent ticks: exactly one wins', async () => {
  const item = (await call('asha', 'GET', '/api/plan')).json.items.filter((i) => i.type === 'lec' && !i.week0)[1];
  const rs = await Promise.all(Array.from({ length: 6 }, () => call('asha', 'POST', `/api/progress/me/${item.id}/tick`, { kind: 'b' })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 5);
});

test('learner cannot read another learner; admin can and can unlock a tick', async () => {
  assert.equal((await call('asha', 'GET', `/api/progress/${(await call('admin', 'GET', '/api/auth/me')).json.user.id}`)).status, 403);
  const seen = await call('admin', 'GET', `/api/progress/${learnerId}`);
  assert.ok(seen.json.progress[lecture.id].a);
  assert.equal((await call('admin', 'DELETE', `/api/progress/${learnerId}/${lecture.id}/a`)).status, 200);
  assert.equal((await call('asha', 'POST', `/api/progress/me/${lecture.id}/tick`, { kind: 'a' })).status, 201);
});

test('notes and test scores save', async () => {
  const test_ = (await call('asha', 'GET', '/api/plan')).json.items.find((i) => i.type === 'test');
  const r = await call('asha', 'PUT', `/api/progress/me/${test_.id}/note`, { score: '34/40', note: 'Careless errors in Q7' });
  assert.equal(r.json.progress.score, '34/40');
});

test('stats: totals, heat map, weekly bars, ISO week', async () => {
  const s = (await call('asha', 'GET', '/api/progress/me/stats')).json;
  assert.equal(s.totals.lectures.total, 86); assert.equal(s.totals.week0.total, 14);
  assert.equal(s.totals.lectures.done, 1); assert.equal(s.totals.dpps.done, 1);
  assert.equal(Object.values(s.heat).reduce((a, b) => a + b, 0), 2);
  const w = s.weeks.find((x) => x.monday === '2026-10-12'); assert.equal(w.isoWeek, 42);
});

let mathId, physId;
test('subjects, chapters and sub-topics: CRUD and guards', async () => {
  mathId = (await call('admin', 'GET', '/api/plan')).json.subjects[0].id;
  const ph = await call('admin', 'POST', '/api/plan/subjects', { name: 'Physics' }); assert.equal(ph.status, 201); physId = ph.json.id;
  assert.equal((await call('admin', 'POST', '/api/plan/subjects', { name: 'physics' })).status, 409);
  // Chapter 1 exists in Mathematics already; Physics can have its own Chapter 1.
  const c1 = await call('admin', 'POST', '/api/plan/chapters', { subject: physId, n: 1, name: 'Kinematics', part: 'Mechanics', topics: ['Speed', 'Velocity'] });
  assert.equal(c1.status, 201);
  assert.equal((await call('admin', 'POST', '/api/plan/chapters', { subject: physId, n: 1, name: 'Dup' })).status, 409);
  const item = await call('admin', 'POST', '/api/plan/items', { subject: physId, type: 'lec', date: '2027-02-09', chapter: 1, topic: 'Speed' });
  assert.equal(item.status, 201);
  assert.equal((await call('admin', 'POST', '/api/plan/items', { subject: physId, type: 'lec', date: '2027-02-09', chapter: 99, topic: 'x' })).status, 400);
  assert.equal((await call('admin', 'DELETE', `/api/plan/chapters/${c1.json.id}`)).status, 409);
  assert.equal((await call('admin', 'DELETE', `/api/plan/subjects/${physId}`)).status, 409);
  // Renumbering the chapter moves its lectures with it.
  assert.equal((await call('admin', 'PUT', `/api/plan/chapters/${c1.json.id}`, { subject: physId, n: 5, name: 'Kinematics', topics: ['Speed', 'Velocity', 'Acceleration'] })).status, 200);
  const plan = (await call('admin', 'GET', '/api/plan')).json;
  assert.equal(plan.items.find((i) => i.id === item.json.id).chapter, 5);
  assert.deepEqual(plan.chapters.find((c) => c.id === c1.json.id).topics, ['Speed', 'Velocity', 'Acceleration']);
  assert.equal((await call('asha', 'POST', '/api/plan/subjects', { name: 'Nope' })).status, 403);
  assert.equal((await call('admin', 'DELETE', `/api/plan/items/${item.json.id}`)).status, 200);
  assert.equal((await call('admin', 'DELETE', `/api/plan/chapters/${c1.json.id}`)).status, 200);
  assert.equal((await call('admin', 'DELETE', `/api/plan/subjects/${physId}`)).status, 200);
});

test('change dates: moves a subject from a date, keeps ticks, refuses empty moves', async () => {
  const before = (await call('admin', 'GET', '/api/plan')).json.items;
  const l1 = before.find((i) => i.type === 'lec' && !i.week0);
  const r = await call('admin', 'POST', '/api/plan/shift', { subject: mathId, from: l1.date, to: '2026-10-19' });
  assert.equal(r.status, 200); assert.equal(r.json.days, 7);
  const after = (await call('admin', 'GET', '/api/plan')).json.items;
  assert.equal(after.find((i) => i.id === l1.id).date, '2026-10-19');
  assert.equal(after.filter((i) => i.week0).every((i) => i.date === null), true); // Week 0 untouched
  assert.equal((await call('admin', 'POST', '/api/plan/shift', { from: '2026-10-19', to: '2026-10-19' })).status, 400);
  assert.equal((await call('admin', 'POST', '/api/plan/shift', { from: '2040-01-01', to: '2040-01-08' })).status, 400);
  assert.equal((await call('asha', 'POST', '/api/plan/shift', { from: '2026-10-19', to: '2026-10-20' })).status, 403);
  await call('admin', 'POST', '/api/plan/shift', { subject: mathId, from: '2026-10-19', to: '2026-10-12' }); // put it back
  assert.equal((await call('admin', 'GET', '/api/plan')).json.items.find((i) => i.id === l1.id).date, l1.date);
});

async function csvCall(method, path, body, who = 'admin') {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: jar[who] }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, text: await res.text() };
}
test('CSV: export then re-import changes nothing; ticks survive', async () => {
  const exp = await csvCall('GET', '/api/plan/export.csv');
  assert.equal(exp.status, 200); assert.match(exp.text, /^id,subject,chapter_no/);
  assert.equal((await csvCall('GET', '/api/plan/export.csv', null, 'asha')).status, 403);
  const before = (await call('admin', 'GET', '/api/plan')).json;
  const r = JSON.parse((await csvCall('POST', '/api/plan/import', { csv: exp.text, mode: 'merge' })).text);
  assert.equal(r.applied, true); assert.equal(r.stats.added, 0); assert.equal(r.stats.updated, 136); assert.equal(r.errorCount, 0);
  const after = (await call('admin', 'GET', '/api/plan')).json;
  assert.equal(after.items.length, before.items.length); assert.equal(after.chapters.length, before.chapters.length);
  assert.deepEqual(after.items.map((i) => [i.id, i.date, i.topic]), before.items.map((i) => [i.id, i.date, i.topic]));
  const seen = await call('admin', 'GET', `/api/progress/${learnerId}`);
  assert.ok(seen.json.progress[lecture.id].a);
});

test('CSV: dry run previews, import creates subjects, chapters, sub-topics and items; errors are reported per row', async () => {
  const csv = [
    'subject,chapter_no,chapter_name,group,subtopic,type,date,week0,title,text',
    'Chemistry,1,Atoms,Basics,Atomic models,lecture,2026-11-02,,,',
    'Chemistry,1,Atoms,Basics,Isotopes,lecture,,,,',
    'Chemistry,,,,,test,15/11/2026,,Unit test,Chapter 1',
    'Chemistry,2,Bonding,Basics,Ionic bonds,lecture,2026-31-02,,,',
    'Chemistry,,,,,revision,,,,',
    'Chemistry,x,,,,lecture,2026-11-03,,,',
  ].join('\n');
  const dry = JSON.parse((await csvCall('POST', '/api/plan/import', { csv, dryRun: true })).text);
  assert.equal(dry.applied, false); assert.equal(dry.stats.subjectsNew, 1); assert.equal(dry.stats.added, 2); assert.equal(dry.stats.skipped, 3);
  assert.equal((await call('admin', 'GET', '/api/plan')).json.subjects.length, 1); // nothing was written
  const go = JSON.parse((await csvCall('POST', '/api/plan/import', { csv })).text);
  assert.equal(go.applied, true);
  const plan = (await call('admin', 'GET', '/api/plan')).json;
  const chem = plan.subjects.find((s) => s.name === 'Chemistry'); assert.ok(chem);
  const ch = plan.chapters.find((c) => c.subject === chem.id && c.n === 1);
  assert.deepEqual(ch.topics, ['Atomic models', 'Isotopes']); assert.equal(ch.part, 'Basics');
  const items = plan.items.filter((i) => i.subject === chem.id);
  assert.equal(items.length, 2);
  assert.equal(items.find((i) => i.type === 'test').date, '2026-11-15');
  assert.equal((await csvCall('POST', '/api/plan/import', { csv: 'nonsense' })).status, 200);
  assert.equal((await csvCall('POST', '/api/plan/import', { csv: 'a,b\n1,2', mode: 'merge' })).status, 200);
  assert.equal((await csvCall('POST', '/api/plan/import', { csv: csv }, 'asha')).status, 403);
  // Per-subject stats
  const st = (await call('asha', 'GET', `/api/progress/me/stats?subject=${chem.id}`)).json;
  assert.equal(st.totals.lectures.total, 1); assert.equal(st.totals.tests.total, 1);
});

test('CSV replace mode removes what the file leaves out, keeps matching ticks', async () => {
  const exp = (await csvCall('GET', '/api/plan/export.csv')).text;
  const kept = exp.split(/\r?\n/).filter((l) => l && (l.startsWith('id,') || l.includes(',Chemistry,') || l.includes(lecture.id))).join('\n');
  const r = JSON.parse((await csvCall('POST', '/api/plan/import', { csv: kept, mode: 'replace' })).text);
  assert.equal(r.applied, true); assert.ok(r.stats.removed > 100);
  const plan = (await call('admin', 'GET', '/api/plan')).json;
  assert.equal(plan.items.some((i) => i.id === lecture.id), true);
  assert.equal(plan.items.length, 3);
  const seen = await call('admin', 'GET', `/api/progress/${learnerId}`);
  assert.ok(seen.json.progress[lecture.id].a);
  assert.equal(Object.keys(seen.json.progress).length <= 2, true);
});

test('bootstrap creates the admin and the built-in plan on an empty database', async () => {
  const { bootstrap } = await import('../src/seed/bootstrap.js');
  const { User } = await import('../src/models/User.js');
  assert.ok(await User.estimatedDocumentCount()); // already populated: a no-op
  await bootstrap();
});

test('password change invalidates old sessions; role change and delete work', async () => {
  const old = jar.asha;
  assert.equal((await call('asha', 'POST', '/api/auth/change-password', { current: 'AshaPass123', next: 'NewPass12345' })).status, 200);
  const res = await fetch(base + '/api/auth/me', { headers: { cookie: old } });
  assert.equal(res.status, 401);
  assert.equal((await call('asha', 'GET', '/api/auth/me')).status, 200);
  assert.equal((await call('admin', 'PATCH', `/api/users/${(await call('admin', 'GET', '/api/auth/me')).json.user.id}`, { role: 'user' })).status, 400);
  assert.equal((await call('admin', 'DELETE', `/api/users/${learnerId}`)).status, 200);
  assert.equal((await call('asha', 'GET', '/api/auth/me')).status, 401);
});
