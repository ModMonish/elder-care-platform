import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDailyAdherence, buildCareAnalytics, buildVisitBrief, validateCheckin, validateHandoff } from '../server/domain.js';

test('daily adherence separates taken, missed, skipped and pending doses', () => {
  const now = new Date('2026-11-15T10:00:00+05:30');
  const at = '2026-11-15T08:00:00+05:30';
  const result = calculateDailyAdherence([
    { scheduledAt: at, status: 'taken' },
    { scheduledAt: at, status: 'missed' },
    { scheduledAt: at, status: 'skipped' },
    { scheduledAt: at, status: 'pending' },
  ], now);
  assert.deepEqual(result, { total: 4, taken: 1, missed: 1, skipped: 1, pending: 1, adherencePercent: 50 });
});

test('daily adherence returns null when no dose has a taken/missed outcome', () => {
  const result = calculateDailyAdherence([{ scheduledAt: '2026-11-15T08:00:00Z', status: 'pending' }], new Date('2026-11-15T09:00:00Z'));
  assert.equal(result.adherencePercent, null);
});

test('analytics surfaces low stock, unresolved missed doses, handoffs and open tasks', () => {
  const now = new Date('2026-11-15T10:00:00Z');
  const analytics = buildCareAnalytics({
    doses: [{ scheduledAt: '2026-11-15T08:00:00Z', status: 'missed' }],
    medications: [{ id: 'm1', name: 'Example', stock: 2, refillAt: 5 }],
    tasks: [{ id: 't1', status: 'pending' }],
    handoffs: [{ id: 'h1', status: 'pending' }],
    members: [{ userId: 'u1', name: 'Caregiver', role: 'caregiver', status: 'active' }],
    checkins: [], appointments: [],
  }, now);
  assert.equal(analytics.lowStock.length, 1);
  assert.equal(analytics.unresolvedMissedCount, 1);
  assert.equal(analytics.openTaskCount, 1);
  assert.equal(analytics.pendingHandoffCount, 1);
});

test('check-in rejects unsupported wellbeing status and bounds note length', () => {
  assert.equal(validateCheckin({ status: 'diagnosed' }).valid, false);
  const result = validateCheckin({ status: 'need-help', note: 'x'.repeat(600) });
  assert.equal(result.valid, true);
  assert.equal(result.value.note.length, 500);
});

test('handoff requires two active distinct members and a summary', () => {
  const members = [
    { userId: 'u1', status: 'active' },
    { userId: 'u2', status: 'active' },
    { userId: 'u3', status: 'revoked' },
  ];
  assert.equal(validateHandoff({ fromMemberId: 'u1', toMemberId: 'u1', summary: 'handoff' }, members).valid, false);
  assert.equal(validateHandoff({ fromMemberId: 'u1', toMemberId: 'u3', summary: 'handoff' }, members).valid, false);
  assert.equal(validateHandoff({ fromMemberId: 'u1', toMemberId: 'u2', summary: 'Evening care tasks' }, members).valid, true);
});


test('visit brief is grounded in the selected appointment and recent recorded care data', () => {
  const now = new Date('2026-11-15T12:00:00.000Z');
  const bundle = {
    id: 'patient-1', name: 'Lakshmi Raman', age: 72, language: 'Tamil',
    appointments: [{ id: 'appt-1', doctor: 'Dr. Anand', scheduledAt: '2026-11-17T10:00:00.000Z', status: 'scheduled' }],
    medications: [{ id: 'med-1', name: 'Amlodipine', strength: '5 mg', times: ['08:00'], frequency: 'Daily', active: true }],
    doses: [
      { id: 'd1', medicationName: 'Amlodipine', scheduledAt: '2026-11-15T08:00:00.000Z', status: 'taken' },
      { id: 'd2', medicationName: 'Metformin', scheduledAt: '2026-11-14T20:00:00.000Z', status: 'missed' },
      { id: 'd3', medicationName: 'Vitamin D', scheduledAt: '2026-10-01T08:00:00.000Z', status: 'missed' },
    ],
    tasks: [{ title: 'Prepare medication list', assignedTo: 'Meena', status: 'pending' }],
    checkins: [{ status: 'tired', note: 'Low energy', createdAt: '2026-11-15T09:00:00.000Z' }],
    events: [{ title: 'Dose follow-up', description: 'Contact the patient', actor: 'Meena', createdAt: '2026-11-14T12:00:00.000Z' }],
  };
  const brief = buildVisitBrief(bundle, 'appt-1', now);
  assert.equal(brief.patient.name, 'Lakshmi Raman');
  assert.equal(brief.doseReview.taken, 1);
  assert.equal(brief.doseReview.missed, 1);
  assert.equal(brief.doseReview.adherencePercent, 50);
  assert.equal(brief.doseReview.unresolvedMisses.length, 2);
  assert.equal(brief.openCareTasks.length, 1);
  assert.equal(brief.recentPatientCheckins[0].status, 'tired');
  assert.equal(buildVisitBrief(bundle, 'missing', now), null);
});

test('care signals are explainable and prioritized without making diagnoses', async () => {
  const { buildCareSignals } = await import('../server/domain.js');
  const now = new Date('2026-11-15T10:00:00+05:30');
  const bundle = {
    doses: [{ id: 'd1', status: 'missed', medicationName: 'Example medicine', scheduledAt: '2026-11-15T08:00:00+05:30' }],
    checkins: [{ id: 'c1', status: 'need-help', createdAt: '2026-11-15T09:30:00+05:30' }],
    tasks: [{ id: 't1', status: 'pending', dueAt: '2026-11-15T08:00:00+05:30' }],
    handoffs: [{ id: 'h1', status: 'pending', createdAt: '2026-11-15T08:00:00+05:30' }],
    medications: [{ id: 'm1', name: 'Example medicine', active: true, stock: 2, refillAt: 5 }],
    appointments: [],
  };
  const signals = buildCareSignals(bundle, now);
  assert.equal(signals[0].id, 'patient-requested-help');
  assert.equal(signals[0].severity, 'urgent');
  assert.ok(signals.some((signal) => signal.id === 'unresolved-missed-doses'));
  assert.ok(signals.every((signal) => signal.reason && signal.suggestedAction));
  assert.ok(signals.every((signal) => !/diagnos|predict/i.test(signal.title)));
});
