import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'nalamlink-store-test-'));
process.env.DATA_MODE = 'demo';
process.env.DATA_FILE = path.join(tempDir, 'store.json');
const store = await import('../server/store.js');
await store.initializeStore();

after(async () => rm(tempDir, { recursive: true, force: true }));

test('dose outcome is idempotent and decrements stock only once', async () => {
  await store.addRecord('lakshmi-demo', 'medications', {
    id: 'test-stock-med', name: 'Demo medicine', strength: '1 unit', times: ['23:00'], frequency: 'Daily', stock: 5, unitsPerDose: 2.5, stockUnit: 'mL', active: true,
  });
  await store.addRecord('lakshmi-demo', 'doses', {
    id: 'test-stock-dose', medicationId: 'test-stock-med', medicationName: 'Demo medicine', scheduledAt: new Date().toISOString(), status: 'pending',
  });
  const [first, second] = await Promise.all([
    store.recordDoseOutcome('lakshmi-demo', 'test-stock-dose', 'taken', 'Test user', 'Confirmed in test'),
    store.recordDoseOutcome('lakshmi-demo', 'test-stock-dose', 'taken', 'Test user', 'Concurrent duplicate request'),
  ]);
  const bundle = await store.getPatientBundle('lakshmi-demo');
  const medication = bundle.medications.find((item) => item.id === 'test-stock-med');
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(medication.stock, 2.5);
});

test('notification email claim allows only one active sender lease', async () => {
  await store.addRecord('lakshmi-demo', 'notifications', {
    id: 'test-email-notification', title: 'Test', message: 'Test', read: false,
  });
  const claims = await Promise.all([
    store.claimNotificationEmail('lakshmi-demo', 'test-email-notification'),
    store.claimNotificationEmail('lakshmi-demo', 'test-email-notification'),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
});


test('concurrent demo writes are serialized without losing independent records', async () => {
  await Promise.all([
    store.addRecord('lakshmi-demo', 'tasks', { id: 'parallel-task-a', title: 'Parallel task A', status: 'pending' }),
    store.addRecord('lakshmi-demo', 'tasks', { id: 'parallel-task-b', title: 'Parallel task B', status: 'pending' }),
  ]);
  const bundle = await store.getPatientBundle('lakshmi-demo');
  assert.ok(bundle.tasks.some((item) => item.id === 'parallel-task-a'));
  assert.ok(bundle.tasks.some((item) => item.id === 'parallel-task-b'));
});
