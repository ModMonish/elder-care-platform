/** Pure domain calculations shared by the API and automated tests. */
export function calculateDailyAdherence(doses = [], now = new Date()) {
  const localDay = new Date(now);
  localDay.setHours(0, 0, 0, 0);
  const nextDay = new Date(localDay);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayDoses = doses.filter((dose) => {
    const scheduled = new Date(dose.scheduledAt);
    return !Number.isNaN(scheduled.getTime()) && scheduled >= localDay && scheduled < nextDay;
  });
  const taken = dayDoses.filter((dose) => dose.status === 'taken').length;
  const missed = dayDoses.filter((dose) => dose.status === 'missed').length;
  const skipped = dayDoses.filter((dose) => dose.status === 'skipped').length;
  const pending = dayDoses.filter((dose) => dose.status === 'pending').length;
  const denominator = taken + missed;
  return {
    total: dayDoses.length,
    taken,
    missed,
    skipped,
    pending,
    adherencePercent: denominator ? Math.round((taken / denominator) * 100) : null,
  };
}


/** Explainable operational signals from user-entered records; these are not medical risk predictions. */
export function buildCareSignals(bundle = {}, now = new Date()) {
  const signals = [];
  const unresolved = (bundle.doses || []).filter((dose) => dose.status === 'missed' && !dose.followUpResolvedAt);
  if (unresolved.length) signals.push({ id: 'unresolved-missed-doses', severity: 'high', category: 'Medication follow-up', title: `${unresolved.length} missed dose follow-up${unresolved.length === 1 ? '' : 's'} open`, reason: 'These scheduled doses are marked missed and do not have a recorded follow-up resolution.', suggestedAction: 'Contact the patient, verify what happened and follow the prescriber’s instructions. Do not recommend an extra dose.', sourceCount: unresolved.length });
  const recentHelp = (bundle.checkins || []).filter((item) => item.status === 'need-help' && now - new Date(item.createdAt).getTime() <= 24 * 60 * 60 * 1000);
  if (recentHelp.length) signals.push({ id: 'patient-requested-help', severity: 'urgent', category: 'Patient request', title: 'Patient requested a check-in', reason: 'A patient-entered wellbeing check-in asked for someone to make contact within the last 24 hours.', suggestedAction: 'Contact the patient directly. This platform is not an emergency monitoring service; use local emergency services if there is immediate danger.', sourceCount: recentHelp.length });
  const overdueTasks = (bundle.tasks || []).filter((task) => task.status !== 'completed' && task.dueAt && new Date(task.dueAt).getTime() < now.getTime());
  if (overdueTasks.length) signals.push({ id: 'overdue-care-tasks', severity: 'medium', category: 'Care coordination', title: `${overdueTasks.length} overdue care task${overdueTasks.length === 1 ? '' : 's'}`, reason: 'Open tasks have a due time earlier than the current time.', suggestedAction: 'Review the owner and update the task status or due time.', sourceCount: overdueTasks.length });
  const pendingHandoffs = (bundle.handoffs || []).filter((handoff) => handoff.status !== 'acknowledged');
  if (pendingHandoffs.length) signals.push({ id: 'unacknowledged-handoffs', severity: 'medium', category: 'Caregiver continuity', title: `${pendingHandoffs.length} handoff${pendingHandoffs.length === 1 ? '' : 's'} awaiting acknowledgement`, reason: 'A care responsibility was transferred but the receiving member has not acknowledged it.', suggestedAction: 'Ask the receiving caregiver to review and acknowledge the handoff.', sourceCount: pendingHandoffs.length });
  const lowStock = (bundle.medications || []).filter((med) => med.active !== false && Number.isFinite(Number(med.stock)) && Number(med.stock) <= Number(med.refillAt ?? 7));
  if (lowStock.length) signals.push({ id: 'low-medication-stock', severity: 'medium', category: 'Supply planning', title: `${lowStock.length} medication supply alert${lowStock.length === 1 ? '' : 's'}`, reason: 'Recorded stock is at or below the refill threshold entered for the medication.', suggestedAction: 'Verify the physical stock and contact the prescribing clinician or pharmacy for refill instructions.', sourceCount: lowStock.length });
  const nextAppointment = (bundle.appointments || []).filter((appt) => appt.status === 'scheduled').map((appt) => ({ ...appt, _time: new Date(appt.scheduledAt).getTime() })).filter((appt) => appt._time >= now.getTime() && appt._time <= now.getTime() + 24 * 60 * 60 * 1000).sort((a,b) => a._time-b._time);
  if (nextAppointment.length) signals.push({ id: 'appointment-within-24h', severity: 'low', category: 'Appointment readiness', title: 'Doctor appointment within 24 hours', reason: `${nextAppointment[0].doctor} is scheduled soon.`, suggestedAction: 'Review the visit brief, appointment location and questions with the patient.', sourceCount: nextAppointment.length });
  const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
  return signals.sort((a,b) => rank[a.severity] - rank[b.severity]);
}

export function buildCareAnalytics(bundle, now = new Date()) {
  const doses = bundle?.doses || [];
  const today = calculateDailyAdherence(doses, now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const entries = doses.filter((dose) => {
      const at = new Date(dose.scheduledAt);
      return !Number.isNaN(at.getTime()) && at >= day && at < next;
    });
    const taken = entries.filter((dose) => dose.status === 'taken').length;
    const missed = entries.filter((dose) => dose.status === 'missed').length;
    const skipped = entries.filter((dose) => dose.status === 'skipped').length;
    const denominator = taken + missed;
    return {
      date: day.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(day),
      taken,
      missed,
      skipped,
      pending: entries.filter((dose) => dose.status === 'pending').length,
      adherencePercent: denominator ? Math.round((taken / denominator) * 100) : null,
    };
  });
  const activeMeds = (bundle?.medications || []).filter((med) => med.active !== false);
  const lowStock = activeMeds
    .filter((med) => Number.isFinite(Number(med.stock)) && Number(med.stock) <= Number(med.refillAt ?? 7))
    .map((med) => ({ id: med.id, name: med.name, stock: Number(med.stock), refillAt: Number(med.refillAt ?? 7) }));
  const nowMs = now.getTime();
  const upcomingAppointments = (bundle?.appointments || [])
    .filter((appointment) => appointment.status === 'scheduled' && new Date(appointment.scheduledAt).getTime() >= nowMs)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const openTasks = (bundle?.tasks || []).filter((task) => task.status !== 'completed');
  const handoffsPending = (bundle?.handoffs || []).filter((handoff) => handoff.status !== 'acknowledged');
  const unresolvedMissed = doses.filter((dose) => dose.status === 'missed' && !dose.followUpResolvedAt);
  const members = bundle?.members || [];
  const caregiverWorkload = members
    .filter((member) => ['caregiver', 'family'].includes(member.role) && member.status === 'active')
    .map((member) => ({
      memberId: member.userId,
      name: member.name,
      role: member.role,
      openTasks: openTasks.filter((task) => task.assignedToId === member.userId || (!task.assignedToId && task.assignedTo === member.name)).length,
    }));
  const completedCheckins = (bundle?.checkins || []).filter((checkin) => checkin.createdAt && nowMs - new Date(checkin.createdAt).getTime() <= 7 * 86400000);
  return {
    generatedAt: now.toISOString(),
    today,
    lastSevenDays: days,
    lowStock,
    upcomingAppointments: upcomingAppointments.slice(0, 5),
    openTaskCount: openTasks.length,
    pendingHandoffCount: handoffsPending.length,
    unresolvedMissedCount: unresolvedMissed.length,
    caregiverWorkload,
    checkinsLastSevenDays: completedCheckins.length,
    totalActiveMedications: activeMeds.length,
    careCircleSize: members.filter((member) => member.status === 'active').length,
    careSignals: buildCareSignals(bundle, now),
  };
}

export function validateCheckin(input = {}) {
  const allowed = new Set(['good', 'okay', 'tired', 'need-help']);
  if (!allowed.has(input.status)) return { valid: false, error: 'Choose good, okay, tired or need help.' };
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : '';
  return { valid: true, value: { status: input.status, note } };
}

export function validateHandoff(input = {}, activeMembers = []) {
  const fromMemberId = String(input.fromMemberId || '').slice(0, 128);
  const toMemberId = String(input.toMemberId || '').slice(0, 128);
  if (!fromMemberId || !toMemberId || fromMemberId === toMemberId) {
    return { valid: false, error: 'Choose two different care-circle members.' };
  }
  const ids = new Set(activeMembers.filter((member) => member.status === 'active').map((member) => member.userId));
  if (!ids.has(fromMemberId) || !ids.has(toMemberId)) {
    return { valid: false, error: 'Both handoff members must have active care-circle access.' };
  }
  const summary = typeof input.summary === 'string' ? input.summary.trim().slice(0, 1200) : '';
  if (!summary) return { valid: false, error: 'Add a short handoff summary.' };
  return { valid: true, value: { fromMemberId, toMemberId, summary } };
}


/** Build a factual, non-diagnostic appointment preparation brief from recorded data. */
export function buildVisitBrief(bundle, appointmentId, now = new Date()) {
  const appointment = (bundle?.appointments || []).find((item) => item.id === appointmentId);
  if (!appointment) return null;
  const since = new Date(now.getTime() - 7 * 86400000);
  const recentDoses = (bundle?.doses || []).filter((dose) => {
    const at = new Date(dose.scheduledAt);
    return !Number.isNaN(at.getTime()) && at >= since && at <= now;
  });
  const taken = recentDoses.filter((dose) => dose.status === 'taken').length;
  const missed = recentDoses.filter((dose) => dose.status === 'missed').length;
  const skipped = recentDoses.filter((dose) => dose.status === 'skipped').length;
  const activeMedications = (bundle?.medications || []).filter((medication) => medication.active !== false);
  const unresolvedDoses = (bundle?.doses || []).filter((dose) => dose.status === 'missed' && !dose.followUpResolvedAt);
  const openTasks = (bundle?.tasks || []).filter((task) => task.status !== 'completed');
  const recentCheckins = (bundle?.checkins || []).filter((checkin) => {
    const at = new Date(checkin.createdAt);
    return !Number.isNaN(at.getTime()) && at >= since;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const recentEvents = (bundle?.events || []).filter((event) => {
    const at = new Date(event.createdAt);
    return !Number.isNaN(at.getTime()) && at >= since;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  const denominator = taken + missed;
  return {
    generatedAt: now.toISOString(),
    patient: { id: bundle.id, name: bundle.name, age: bundle.age, language: bundle.language },
    appointment,
    medicationReview: activeMedications.map((medication) => ({ name: medication.name, strength: medication.strength || '', times: medication.times || [], frequency: medication.frequency || '', instructions: medication.instructions || '', prescriber: medication.prescriber || '' })),
    doseReview: { windowDays: 7, total: recentDoses.length, taken, missed, skipped, pending: recentDoses.filter((dose) => dose.status === 'pending').length, adherencePercent: denominator ? Math.round((taken / denominator) * 100) : null, unresolvedMisses: unresolvedDoses.map((dose) => ({ medicationName: dose.medicationName, scheduledAt: dose.scheduledAt, followUpStatus: dose.followUpStatus || 'open' })) },
    openCareTasks: openTasks.map((task) => ({ title: task.title, assignedTo: task.assignedTo || 'Care circle', dueAt: task.dueAt || null, priority: task.priority || 'medium' })),
    recentPatientCheckins: recentCheckins.map((checkin) => ({ status: checkin.status, note: checkin.note || '', createdAt: checkin.createdAt })),
    recentCareEvents: recentEvents.map((event) => ({ title: event.title, description: event.description || '', actor: event.actor || '', createdAt: event.createdAt })),
    disclaimer: 'This brief summarizes user-entered records for discussion. It is not a diagnosis, medication recommendation or certified medical record. Verify all details with the patient and clinician.'
  };
}
