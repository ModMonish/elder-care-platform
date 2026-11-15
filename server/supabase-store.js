import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

let db;
let authClient;
const COLLECTIONS = ['members','medications','doses','appointments','tasks','events','notifications','invitations','checkins','handoffs','shifts'];
const id = (prefix='item') => `${prefix}-${randomUUID()}`;
const fail = (error, context) => { if (error) throw new Error(`${context}: ${error.message || error.details || 'Supabase request failed'}`); };

export async function initializeSupabaseStore() {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !secret) throw new Error('Supabase mode requires SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
  authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  // Fail fast if the schema has not been installed.
  const { error } = await db.from('nl_patients').select('id').limit(1);
  fail(error, 'Supabase schema check failed');
}

export async function verifySupabaseToken(token) {
  if (!authClient) throw new Error('Supabase Auth is not initialized.');
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) throw new Error('Sign-in token is invalid or expired.');
  const user = data.user;
  return { uid: user.id, email: user.email || '', name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || 'User' };
}

export async function listAllPatientIds() {
  const { data, error } = await db.from('nl_patients').select('id');
  fail(error, 'Could not list patient profiles');
  return (data || []).map((row) => row.id);
}

export async function getPatientRecord(patientId) {
  const { data, error } = await db.from('nl_patients').select('id,profile').eq('id', patientId).maybeSingle();
  fail(error, 'Could not read patient profile');
  return data ? { ...data.profile, id: data.id } : null;
}

export async function listUserPatients(uid) {
  const { data: memberships, error } = await db.from('nl_records').select('patient_id,data').eq('collection','members').eq('data->>userId', uid).eq('data->>status','active');
  fail(error, 'Could not list care memberships');
  const ids = [...new Set((memberships || []).map((row) => row.patient_id))];
  if (!ids.length) return [];
  const { data: patients, error: patientError } = await db.from('nl_patients').select('id,profile').in('id', ids);
  fail(patientError, 'Could not read patient profiles');
  const roles = new Map((memberships || []).map((row) => [row.patient_id, row.data.role]));
  return (patients || []).map((row) => ({ id: row.id, name: row.profile.name, age: row.profile.age, city: row.profile.city, role: roles.get(row.id) || 'member' }));
}

export async function getMember(patientId, uid) {
  const { data, error } = await db.from('nl_records').select('data').eq('patient_id', patientId).eq('collection','members').eq('record_id', uid).maybeSingle();
  fail(error, 'Could not read care-circle membership');
  return data?.data || null;
}

export async function getPatientBundle(patientId) {
  const patient = await getPatientRecord(patientId);
  if (!patient) return null;
  const { data, error } = await db.from('nl_records').select('collection,data').eq('patient_id', patientId);
  fail(error, 'Could not read care workspace');
  for (const collection of COLLECTIONS) patient[collection] = [];
  for (const row of data || []) if (patient[row.collection]) patient[row.collection].push(row.data);
  return patient;
}

export async function createPatient(data, uid, user) {
  const patientId = id('patient');
  const now = new Date().toISOString();
  const profile = { id: patientId, name: data.name, age: Number(data.age) || null, language: data.language || 'English', city: data.city || '', emergencyContact: data.emergencyContact || '', careNotes: '', createdAt: now };
  const member = { id: uid, userId: uid, name: user.name || user.email || 'Patient owner', email: user.email || '', role: 'patient', status: 'active', joinedAt: now };
  const { error: patientError } = await db.from('nl_patients').insert({ id: patientId, profile });
  fail(patientError, 'Could not create patient profile');
  const { error: memberError } = await db.from('nl_records').insert({ patient_id: patientId, collection: 'members', record_id: uid, data: member });
  if (memberError) { await db.from('nl_patients').delete().eq('id', patientId); fail(memberError, 'Could not create patient owner membership'); }
  return profile;
}

export async function addRecord(patientId, collection, data) {
  const recordId = data.id || id(collection.slice(0,-1) || 'item');
  const record = { ...data, id: recordId, createdAt: data.createdAt || new Date().toISOString() };
  const { error } = await db.from('nl_records').upsert({ patient_id: patientId, collection, record_id: recordId, data: record }, { onConflict: 'patient_id,collection,record_id' });
  fail(error, `Could not save ${collection} record`);
  return record;
}

export async function addRecordIfAbsent(patientId, collection, data) {
  const recordId = data.id || id(collection.slice(0,-1) || 'item');
  const record = { ...data, id: recordId, createdAt: data.createdAt || new Date().toISOString() };
  const { error } = await db.from('nl_records').insert({ patient_id: patientId, collection, record_id: recordId, data: record });
  if (!error) return { record, created: true };
  if (error.code !== '23505') fail(error, `Could not create ${collection} record`);
  const { data: existing, error: readError } = await db.from('nl_records').select('data').eq('patient_id',patientId).eq('collection',collection).eq('record_id',recordId).single();
  fail(readError, 'Could not read existing record');
  return { record: existing.data, created: false };
}

export async function transitionRecordIfStatus(patientId, collection, recordId, expectedStatus, patch) {
  const { data, error } = await db.rpc('nl_transition_record', { p_patient_id: patientId, p_collection: collection, p_record_id: recordId, p_expected_status: expectedStatus, p_patch: patch });
  fail(error, 'Could not transition record');
  return data || null;
}

export async function claimNotificationEmail(patientId, notificationId, leaseMs = 120000) {
  const { data, error } = await db.rpc('nl_claim_notification_email', { p_patient_id: patientId, p_notification_id: notificationId, p_lease_ms: leaseMs });
  fail(error, 'Could not claim notification delivery');
  return data || null;
}

export async function recordDoseOutcome(patientId, doseId, outcome, actorName, outcomeNote = '') {
  if (!['taken','skipped'].includes(outcome)) throw new Error('Unsupported dose outcome.');
  const { data, error } = await db.rpc('nl_record_dose_outcome', { p_patient_id: patientId, p_dose_id: doseId, p_outcome: outcome, p_actor_name: actorName, p_outcome_note: outcomeNote });
  fail(error, 'Could not record dose outcome');
  return data || null;
}

export async function updateRecord(patientId, collection, recordId, patch) {
  const { data, error } = await db.from('nl_records').select('data').eq('patient_id',patientId).eq('collection',collection).eq('record_id',recordId).maybeSingle();
  fail(error, 'Could not read record before update');
  if (!data) return null;
  const updated = { ...data.data, ...patch, updatedAt: new Date().toISOString() };
  const { error: updateError } = await db.from('nl_records').update({ data: updated }).eq('patient_id',patientId).eq('collection',collection).eq('record_id',recordId);
  fail(updateError, 'Could not update record');
  return updated;
}

export async function deleteRecord(patientId, collection, recordId) {
  const { data, error } = await db.from('nl_records').delete().eq('patient_id',patientId).eq('collection',collection).eq('record_id',recordId).select('record_id');
  fail(error, 'Could not delete record');
  return Boolean(data?.length);
}

export async function addInvitation(patientId, invitation) {
  return addRecord(patientId, 'invitations', { id: id('invite'), ...invitation, createdAt: new Date().toISOString() });
}

export async function acceptInvitation(codeHash, user) {
  const { data, error } = await db.rpc('nl_accept_invitation', { p_code_hash: codeHash, p_user_id: user.id, p_user_name: user.name || user.email || 'Member', p_user_email: user.email || '' });
  fail(error, 'Could not accept invitation');
  return data || null;
}
