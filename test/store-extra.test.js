import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'nalamlink-store-extra-'));
process.env.DATA_MODE = 'demo';
process.env.DATA_FILE = path.join(tempDir, 'store.json');
const store = await import('../server/store.js');
await store.initializeStore();

after(async () => rm(tempDir, { recursive: true, force: true }));

const PATIENT = 'lakshmi-demo';

test('addRecordIfAbsent creates a record once and never duplicates it', async () => {
  const first = await store.addRecordIfAbsent(PATIENT, 'notifications', { id: 'extra-note-1', title: 'Reminder', message: 'First' });
  const second = await store.addRecordIfAbsent(PATIENT, 'notifications', { id: 'extra-note-1', title: 'Reminder', message: 'Second' });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.record.message, 'First');
  const bundle = await store.getPatientBundle(PATIENT);
  assert.equal(bundle.notifications.filter((item) => item.id === 'extra-note-1').length, 1);
});

test('transitionRecordIfStatus changes status only when the expected status matches', async () => {
  await store.addRecord(PATIENT, 'doses', { id: 'extra-dose-1', medicationName: 'Example', scheduledAt: new Date().toISOString(), status: 'pending' });
  const wrong = await store.transitionRecordIfStatus(PATIENT, 'doses', 'extra-dose-1', 'taken', { status: 'missed' });
  assert.equal(wrong, null);
  const right = await store.transitionRecordIfStatus(PATIENT, 'doses', 'extra-dose-1', 'pending', { status: 'missed' });
  assert.equal(right.status, 'missed');
  const again = await store.transitionRecordIfStatus(PATIENT, 'doses', 'extra-dose-1', 'pending', { status: 'missed' });
  assert.equal(again, null);
});

test('updateRecord changes only the given fields and reports unknown records', async () => {
  await store.addRecord(PATIENT, 'tasks', { id: 'extra-task-1', title: 'Original title', status: 'pending' });
  const updated = await store.updateRecord(PATIENT, 'tasks', 'extra-task-1', { status: 'completed' });
  assert.equal(updated.status, 'completed');
  assert.equal(updated.title, 'Original title');
  assert.equal(await store.updateRecord(PATIENT, 'tasks', 'does-not-exist', { status: 'completed' }), null);
});

test('deleteRecord removes an existing record and returns false for a missing one', async () => {
  await store.addRecord(PATIENT, 'tasks', { id: 'extra-task-2', title: 'Temporary task', status: 'pending' });
  assert.equal(await store.deleteRecord(PATIENT, 'tasks', 'extra-task-2'), true);
  assert.equal(await store.deleteRecord(PATIENT, 'tasks', 'extra-task-2'), false);
});

test('a skipped dose is final and cannot be marked taken afterwards', async () => {
  await store.addRecord(PATIENT, 'doses', { id: 'extra-dose-2', medicationName: 'Example', scheduledAt: new Date().toISOString(), status: 'pending' });
  const skipped = await store.recordDoseOutcome(PATIENT, 'extra-dose-2', 'skipped', 'Test user', 'Not needed');
  assert.equal(skipped.changed, true);
  const retry = await store.recordDoseOutcome(PATIENT, 'extra-dose-2', 'taken', 'Test user', 'Late attempt');
  assert.equal(retry.changed, false);
  assert.equal(retry.record.status, 'skipped');
});

test('unsupported dose outcomes are rejected', async () => {
  await assert.rejects(() => store.recordDoseOutcome(PATIENT, 'extra-dose-2', 'doubled', 'Test user'), /Unsupported dose outcome/);
});

test('stock never drops below zero when doses are confirmed', async () => {
  await store.addRecord(PATIENT, 'medications', { id: 'extra-med-1', name: 'Low stock medicine', times: ['08:00'], frequency: 'Daily', stock: 1, unitsPerDose: 3, active: true });
  await store.addRecord(PATIENT, 'doses', { id: 'extra-dose-3', medicationId: 'extra-med-1', medicationName: 'Low stock medicine', scheduledAt: new Date().toISOString(), status: 'pending' });
  const result = await store.recordDoseOutcome(PATIENT, 'extra-dose-3', 'taken', 'Test user');
  assert.equal(result.stockAfter, 0);
});
