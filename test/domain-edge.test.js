import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDailyAdherence, buildCareSignals, validateCheckin, validateHandoff, buildVisitBrief } from '../server/domain.js';

test('daily adherence ignores doses from other days and invalid dates', () => {
  const now = new Date('2026-11-15T10:00:00');
  const result = calculateDailyAdherence([
    { scheduledAt: '2026-11-15T08:00:00', status: 'taken' },
    { scheduledAt: '2026-11-14T08:00:00', status: 'missed' },
    { scheduledAt: 'not-a-date', status: 'missed' },
  ], now);
  assert.equal(result.total, 1);
  assert.equal(result.taken, 1);
  assert.equal(result.missed, 0);
  assert.equal(result.adherencePercent, 100);
});

test('daily adherence handles an empty dose list safely', () => {
  const result = calculateDailyAdherence([], new Date('2026-11-15T10:00:00'));
  assert.equal(result.total, 0);
  assert.equal(result.adherencePercent, null);
});

test('check-in accepts every supported wellbeing status and trims the note', () => {
  for (const status of ['good', 'okay', 'tired', 'need-help']) {
    const result = validateCheckin({ status, note: '  feeling fine  ' });
    assert.equal(result.valid, true);
    assert.equal(result.value.note, 'feeling fine');
  }
});

test('check-in rejects missing input without throwing', () => {
  assert.equal(validateCheckin().valid, false);
  assert.equal(validateCheckin({}).valid, false);
});

test('handoff rejects an empty summary and trims a valid one', () => {
  const members = [{ userId: 'u1', status: 'active' }, { userId: 'u2', status: 'active' }];
  assert.equal(validateHandoff({ fromMemberId: 'u1', toMemberId: 'u2', summary: '   ' }, members).valid, false);
  const ok = validateHandoff({ fromMemberId: 'u1', toMemberId: 'u2', summary: '  Evening tablets given  ' }, members);
  assert.equal(ok.valid, true);
  assert.equal(ok.value.summary, 'Evening tablets given');
});

test('handoff rejects missing members', () => {
  assert.equal(validateHandoff({ summary: 'Hello' }, []).valid, false);
});

test('care signals always return a list, even for an empty record', () => {
  assert.ok(Array.isArray(buildCareSignals({}, new Date('2026-11-15T10:00:00Z'))));
});

test('visit brief leaves out inactive medications and old check-ins', () => {
  const now = new Date('2026-11-15T12:00:00.000Z');
  const bundle = {
    id: 'p1', name: 'Example Patient',
    appointments: [{ id: 'a1', doctor: 'Dr. Example', scheduledAt: '2026-11-17T10:00:00.000Z', status: 'scheduled' }],
    medications: [
      { id: 'm1', name: 'Active Medicine', active: true },
      { id: 'm2', name: 'Stopped Medicine', active: false },
    ],
    checkins: [
      { status: 'good', createdAt: '2026-11-14T09:00:00.000Z' },
      { status: 'tired', createdAt: '2026-09-01T09:00:00.000Z' },
    ],
  };
  const brief = buildVisitBrief(bundle, 'a1', now);
  assert.equal(brief.medicationReview.length, 1);
  assert.equal(brief.medicationReview[0].name, 'Active Medicine');
  assert.equal(brief.recentPatientCheckins.length, 1);
  assert.match(brief.disclaimer, /not a diagnosis/i);
});
