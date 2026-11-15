import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_MODE = (process.env.DATA_MODE || 'demo').toLowerCase();
if (!['demo', 'supabase'].includes(DATA_MODE)) throw new Error('Unsupported DATA_MODE. Choose demo or supabase.');
const DEMO_FILE = process.env.DATA_FILE || (process.env.NODE_ENV === 'production' ? '/tmp/nalamlink-demo-data.json' : path.resolve('.data/nalamlink-demo-data.json'));
let supabaseStore = null;
const SUPABASE_MODE = DATA_MODE === 'supabase';

function makeSeed() {
  const now = new Date();
  const ago = (mins) => new Date(now.getTime() - mins * 60000).toISOString();
  const ahead = (mins) => new Date(now.getTime() + mins * 60000).toISOString();
  const med1 = 'med-amlodipine';
  const med2 = 'med-metformin';
  const med3 = 'med-vitd';
  return {
    patients: {
      'lakshmi-demo': {
        id: 'lakshmi-demo', name: 'Lakshmi Raman', age: 72, language: 'Tamil', city: 'Chennai',
        emergencyContact: 'Meena Raman · Daughter', careNotes: 'Prefers Tamil reminders and large text. Daughter checks in every evening.',
        createdAt: ago(60 * 24 * 90),
        members: [
          { id: 'member-patient', userId: 'patient', name: 'Lakshmi Raman', email: 'lakshmi.demo@example.com', role: 'patient', status: 'active', joinedAt: ago(60 * 24 * 90) },
          { id: 'member-daughter', userId: 'family', name: 'Meena Raman', email: 'meena.demo@example.com', role: 'family', status: 'active', joinedAt: ago(60 * 24 * 70) },
          { id: 'member-caregiver', userId: 'caregiver', name: 'Revathi Kumar', email: 'revathi.demo@example.com', role: 'caregiver', status: 'active', joinedAt: ago(60 * 24 * 30) },
          { id: 'member-doctor', userId: 'clinician', name: 'Dr. Anand', email: 'anand.demo@example.com', role: 'clinician', status: 'active', joinedAt: ago(60 * 24 * 20) }
        ],
        medications: [
          { id: med1, name: 'Amlodipine', strength: '5 mg', form: 'Tablet', instructions: 'Take after breakfast as prescribed.', times: ['08:00'], frequency: 'Daily', stock: 18, refillAt: 7, prescriber: 'Dr. Anand', active: true, createdAt: ago(60 * 24 * 20) },
          { id: med2, name: 'Metformin', strength: '500 mg', form: 'Tablet', instructions: 'Take with food as prescribed.', times: ['08:30', '20:00'], frequency: 'Twice daily', stock: 24, refillAt: 8, prescriber: 'Dr. Anand', active: true, createdAt: ago(60 * 24 * 20) },
          { id: med3, name: 'Vitamin D3', strength: '60,000 IU', form: 'Capsule', instructions: 'Weekly on Sunday, as prescribed.', times: ['09:00'], frequency: 'Weekly', stock: 3, refillAt: 1, prescriber: 'Dr. Anand', active: true, createdAt: ago(60 * 24 * 15) }
        ],
        doses: [
          { id: 'dose-taken', medicationId: med1, medicationName: 'Amlodipine', strength: '5 mg', scheduledAt: ago(160), status: 'taken', confirmedAt: ago(145), confirmedBy: 'patient', instructions: 'After breakfast', createdAt: ago(200) },
          { id: 'dose-missed', medicationId: med2, medicationName: 'Metformin', strength: '500 mg', scheduledAt: ago(95), status: 'missed', instructions: 'With food', createdAt: ago(110) },
          { id: 'dose-pending', medicationId: med3, medicationName: 'Vitamin D3', strength: '60,000 IU', scheduledAt: ahead(35), status: 'pending', instructions: 'Weekly dose', createdAt: ago(20) },
          { id: 'dose-evening', medicationId: med2, medicationName: 'Metformin', strength: '500 mg', scheduledAt: ahead(600), status: 'pending', instructions: 'With dinner', createdAt: ago(10) }
        ],
        appointments: [
          { id: 'appt-next', doctor: 'Dr. Anand', specialty: 'General Physician', location: 'Apollo Clinic, T. Nagar', scheduledAt: ahead(60 * 24 * 2), reason: 'Routine follow-up', status: 'scheduled', notes: 'Bring current medication list.' },
          { id: 'appt-old', doctor: 'Dr. Priya', specialty: 'Ophthalmology', location: 'Vision Care Centre', scheduledAt: ago(60 * 24 * 12), reason: 'Vision review', status: 'completed', notes: 'Follow-up as advised.' }
        ],
        tasks: [
          { id: 'task-1', title: 'Confirm evening medication', assignedTo: 'Meena Raman', dueAt: ahead(540), status: 'pending', priority: 'high', createdAt: ago(60) },
          { id: 'task-2', title: 'Prepare questions for doctor visit', assignedTo: 'Revathi Kumar', dueAt: ahead(60 * 24), status: 'pending', priority: 'medium', createdAt: ago(120) },
          { id: 'task-3', title: 'Check remaining tablet stock', assignedTo: 'Meena Raman', dueAt: ago(60), status: 'completed', priority: 'low', createdAt: ago(60 * 24), completedAt: ago(20) }
        ],
        events: [
          { id: 'event-1', type: 'dose_taken', title: 'Morning medication confirmed', description: 'Amlodipine 5 mg was marked as taken.', actor: 'Lakshmi Raman', createdAt: ago(145) },
          { id: 'event-2', type: 'dose_missed', title: 'Dose needs follow-up', description: 'Metformin 500 mg is unconfirmed. Care circle should check in.', actor: 'NalamLink system', createdAt: ago(10) },
          { id: 'event-3', type: 'task_completed', title: 'Medicine stock checked', description: 'Meena Raman updated the remaining stock count.', actor: 'Meena Raman', createdAt: ago(20) }
        ],
        notifications: [
          { id: 'notification-1', title: 'Care follow-up needed', message: 'Metformin 500 mg is still unconfirmed. Please check with Lakshmi.', level: 'warning', read: false, createdAt: ago(8) },
          { id: 'notification-2', title: 'Appointment coming up', message: 'Dr. Anand appointment is in two days.', level: 'info', read: false, createdAt: ago(60) }
        ],
        invitations: [],
        checkins: [
          { id: 'checkin-demo-today', userId: 'patient', userName: 'Lakshmi Raman', status: 'okay', note: 'Feeling comfortable today.', createdAt: now.toISOString() }
        ],
        handoffs: [
          { id: 'handoff-demo-open', fromMemberId: 'family', fromName: 'Meena Raman', toMemberId: 'caregiver', toName: 'Revathi Kumar', summary: 'Please confirm the evening routine and check the appointment documents are ready.', status: 'pending', createdAt: ago(35), createdBy: 'family' }
        ],
        shifts: []
      }
    }
  };
}

let demoCache = null;
let demoSaveQueue = Promise.resolve();
async function ensureDemo() {
  if (demoCache) return demoCache;
  try {
    const raw = await fs.readFile(DEMO_FILE, 'utf8');
    demoCache = JSON.parse(raw);
    if (!demoCache?.patients) throw new Error('Invalid demo database');
  } catch {
    demoCache = makeSeed();
    await saveDemo();
  }
  return demoCache;
}
async function saveDemo() {
  // Serialize snapshots so concurrent demo requests do not race on the same temp file.
  const snapshot = JSON.stringify(demoCache, null, 2);
  const write = demoSaveQueue.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(DEMO_FILE), { recursive: true });
    const temp = `${DEMO_FILE}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, snapshot, 'utf8');
    await fs.rename(temp, DEMO_FILE);
  });
  demoSaveQueue = write;
  return write;
}

export async function initializeStore() {
  if (SUPABASE_MODE) {
    supabaseStore = await import('./supabase-store.js');
    await supabaseStore.initializeSupabaseStore();
  } else {
    await ensureDemo();
  }
}

// This edition intentionally uses Supabase or the local synthetic demo store; no Google Cloud services are required.
export const isSupabaseMode = () => SUPABASE_MODE;
export const getDataMode = () => SUPABASE_MODE ? 'supabase' : 'demo-file';
export async function listAllPatientIds() {
  if (SUPABASE_MODE) return supabaseStore.listAllPatientIds();
  const db = await ensureDemo();
  return Object.keys(db.patients);
}
export async function verifyAccessToken(token) {
  if (SUPABASE_MODE) return supabaseStore.verifySupabaseToken(token);
  throw new Error('Production authentication requires DATA_MODE=supabase and valid Supabase credentials.');
}
export const makeId = (prefix = 'item') => `${prefix}-${randomUUID()}`;

export async function getPatientRecord(patientId) {
  if (SUPABASE_MODE) return supabaseStore.getPatientRecord(patientId);
    const db = await ensureDemo();
  return db.patients[patientId] ? structuredClone(db.patients[patientId]) : null;
}

export async function listUserPatients(uid) {
  if (SUPABASE_MODE) return supabaseStore.listUserPatients(uid);
    const db = await ensureDemo();
  return Object.values(db.patients).filter((p) => p.members?.some((m) => m.userId === uid && m.status === 'active')).map((p) => ({ id: p.id, name: p.name, age: p.age, city: p.city, role: p.members.find((m) => m.userId === uid)?.role }));
}

export async function getMember(patientId, uid) {
  if (SUPABASE_MODE) return supabaseStore.getMember(patientId, uid);
    const p = await getPatientRecord(patientId);
  return p?.members?.find((m) => m.userId === uid) || null;
}

export async function getPatientBundle(patientId) {
  if (SUPABASE_MODE) return supabaseStore.getPatientBundle(patientId);
    const p = await getPatientRecord(patientId);
  if (!p) return null;
  for (const key of ['checkins', 'handoffs', 'shifts', 'invitations', 'notifications', 'events', 'tasks', 'doses', 'medications', 'appointments', 'members']) p[key] ||= [];
  return p;
}

export async function createPatient(data, uid, user) {
  if (SUPABASE_MODE) return supabaseStore.createPatient(data, uid, user);
  const id = makeId('patient');
  const profile = { id, name: data.name, age: Number(data.age) || null, language: data.language || 'English', city: data.city || '', emergencyContact: data.emergencyContact || '', careNotes: '', createdAt: new Date().toISOString() };
  const member = { id: uid, userId: uid, name: user.name || user.email || 'Patient owner', email: user.email || '', role: 'patient', status: 'active', joinedAt: new Date().toISOString() };
    const db = await ensureDemo();
  db.patients[id] = { ...profile, members: [member], medications: [], doses: [], appointments: [], tasks: [], events: [], notifications: [], invitations: [], checkins: [], handoffs: [], shifts: [] };
  await saveDemo();
  return profile;
}

export async function addRecord(patientId, collection, data) {
  if (SUPABASE_MODE) return supabaseStore.addRecord(patientId, collection, data);
  const id = data.id || makeId(collection.slice(0, -1) || 'item');
  const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    const db = await ensureDemo();
  db.patients[patientId][collection] ||= [];
  const existingIndex = db.patients[patientId][collection].findIndex((item) => item.id === id);
  if (existingIndex >= 0) db.patients[patientId][collection][existingIndex] = { ...db.patients[patientId][collection][existingIndex], ...record };
  else db.patients[patientId][collection].push(record);
  await saveDemo();
  return record;
}

export async function addRecordIfAbsent(patientId, collection, data) {
  if (SUPABASE_MODE) return supabaseStore.addRecordIfAbsent(patientId, collection, data);
  const id = data.id || makeId(collection.slice(0, -1) || 'item');
  const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    const db = await ensureDemo();
  db.patients[patientId][collection] ||= [];
  const existing = db.patients[patientId][collection].find((item) => item.id === id);
  if (existing) return { record: structuredClone(existing), created: false };
  db.patients[patientId][collection].push(record);
  await saveDemo();
  return { record: structuredClone(record), created: true };
}

export async function transitionRecordIfStatus(patientId, collection, id, expectedStatus, patch) {
  if (SUPABASE_MODE) return supabaseStore.transitionRecordIfStatus(patientId, collection, id, expectedStatus, patch);
    const db = await ensureDemo();
  const record = (db.patients[patientId]?.[collection] || []).find((item) => item.id === id);
  if (!record || record.status !== expectedStatus) return null;
  Object.assign(record, patch, { updatedAt: new Date().toISOString() });
  await saveDemo();
  return structuredClone(record);
}

export async function claimNotificationEmail(patientId, notificationId, leaseMs = 120_000) {
  if (SUPABASE_MODE) return supabaseStore.claimNotificationEmail(patientId, notificationId, leaseMs);
  const now = Date.now();
  const claimedAt = new Date(now).toISOString();
    const db = await ensureDemo();
  const record = (db.patients[patientId]?.notifications || []).find((item) => item.id === notificationId);
  if (!record || record.emailStatus === 'sent' || Number(record.emailAttempts || 0) >= 5) return null;
  const leaseActive = record.emailStatus === 'sending' && record.emailClaimedAt && now - new Date(record.emailClaimedAt).getTime() < leaseMs;
  if (leaseActive) return null;
  Object.assign(record, { emailStatus: 'sending', emailClaimedAt: claimedAt, emailAttempts: Number(record.emailAttempts || 0) + 1 });
  await saveDemo();
  return structuredClone(record);
}

export async function recordDoseOutcome(patientId, doseId, outcome, actorName, outcomeNote = '') {
  if (SUPABASE_MODE) return supabaseStore.recordDoseOutcome(patientId, doseId, outcome, actorName, outcomeNote);
  if (!['taken', 'skipped'].includes(outcome)) throw new Error('Unsupported dose outcome.');
  const now = new Date().toISOString();
    const db = await ensureDemo();
  const patient = db.patients[patientId];
  const dose = (patient?.doses || []).find((item) => item.id === doseId);
  if (!dose) return null;
  if (['taken', 'skipped'].includes(dose.status)) return { record: structuredClone(dose), changed: false, stockAfter: null };
  if (!['pending', 'missed'].includes(dose.status)) return null;
  Object.assign(dose, { status: outcome, outcomeNote, outcomeAt: now, outcomeBy: actorName, followUpResolvedAt: now, followUpStatus: 'resolved', updatedAt: now });
  if (outcome === 'taken') {
    dose.confirmedAt = now; dose.confirmedBy = actorName;
    const medication = (patient.medications || []).find((item) => item.id === dose.medicationId);
    if (medication && Number.isFinite(Number(medication.stock))) {
      const unitsPerDose = Number(medication.unitsPerDose ?? 1);
      medication.stock = Math.max(0, Number(medication.stock) - (Number.isFinite(unitsPerDose) && unitsPerDose > 0 ? unitsPerDose : 1));
      medication.stockUpdatedAt = now;
    }
  }
  await saveDemo();
  const medication = (patient.medications || []).find((item) => item.id === dose.medicationId);
  return { record: structuredClone(dose), changed: true, stockAfter: outcome === 'taken' && medication ? medication.stock : null };
}

export async function updateRecord(patientId, collection, id, patch) {
  if (SUPABASE_MODE) return supabaseStore.updateRecord(patientId, collection, id, patch);
    const db = await ensureDemo();
  const arr = db.patients[patientId]?.[collection] || [];
  const index = arr.findIndex((x) => x.id === id);
  if (index < 0) return null;
  arr[index] = { ...arr[index], ...patch, updatedAt: new Date().toISOString() };
  await saveDemo();
  return structuredClone(arr[index]);
}

export async function deleteRecord(patientId, collection, id) {
  if (SUPABASE_MODE) return supabaseStore.deleteRecord(patientId, collection, id);
    const db = await ensureDemo();
  const arr = db.patients[patientId]?.[collection] || [];
  const before = arr.length;
  db.patients[patientId][collection] = arr.filter((x) => x.id !== id);
  await saveDemo();
  return db.patients[patientId][collection]return db.patients[patientId][collection].length !== before;;
}

export async function addInvitation(patientId, invitation) {
  if (SUPABASE_MODE) return supabaseStore.addInvitation(patientId, invitation);
  const record = { id: makeId('invite'), ...invitation, createdAt: new Date().toISOString() };
  const db = await ensureDemo();
  db.patients[patientId].invitations.push(record);
  await saveDemo();
  return record;
}

export async function acceptInvitation(code, user) {
  if (SUPABASE_MODE) return supabaseStore.acceptInvitation(code, user);
    const db = await ensureDemo();
  for (const p of Object.values(db.patients)) {
    const invite = p.invitations.find((x) => x.codeHash === code && x.status === 'pending' && new Date(x.expiresAt).getTime() > Date.now());
    if (invite) {
      if (invite.email && invite.email.toLowerCase() !== (user.email || '').toLowerCase()) return { error: 'This invitation belongs to a different email address.' };
      const existing = p.members.find((member) => member.userId === user.id && member.status === 'active');
      if (!existing) p.members.push({ id: user.id, userId: user.id, name: user.name || user.email, email: user.email || '', role: invite.role, status: 'active', joinedAt: new Date().toISOString() });
      invite.status = 'accepted';
      invite.acceptedAt = new Date().toISOString();
      await saveDemo();
      return { patientId: p.id, role: existing?.role || invite.role, alreadyMember: Boolean(existing) };
    }
  }
  return null;
}
