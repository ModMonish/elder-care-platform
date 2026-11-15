export type Role = 'patient' | 'family' | 'caregiver' | 'clinician' | 'member';
export type DoseStatus = 'pending' | 'taken' | 'missed' | 'skipped';

export interface Member {
  id: string; userId: string; name: string; email: string; role: Role; status: string; joinedAt?: string;
}
export interface Medication {
  id: string; name: string; strength?: string; form?: string; instructions?: string;
  times: string[]; frequency: string; stock: number; unitsPerDose?: number; stockUnit?: 'tablets' | 'capsules' | 'mL' | 'units'; refillAt?: number; prescriber?: string; active?: boolean;
}
export interface Dose {
  id: string; medicationId: string; medicationName: string; strength?: string; scheduledAt: string;
  status: DoseStatus; instructions?: string; confirmedAt?: string; confirmedBy?: string;
}
export interface Appointment {
  id: string; doctor: string; specialty?: string; location?: string; scheduledAt: string;
  reason?: string; status: string; notes?: string;
}
export interface CareTask {
  id: string; title: string; assignedTo?: string; assignedToId?: string; dueAt?: string; status: string; priority?: string; createdAt?: string;
}
export interface CareEvent {
  id: string; type: string; title: string; description?: string; actor?: string; createdAt: string;
}
export interface CareNotification {
  id: string; title: string; message: string; level: string; read: boolean; createdAt: string; emailStatus?: string; recipientId?: string;
}
export interface Patient {
  id: string; name: string; age: number; language?: string; city?: string; emergencyContact?: string; careNotes?: string;
  members: Member[]; medications: Medication[]; doses: Dose[]; appointments: Appointment[];
  tasks: CareTask[]; events: CareEvent[]; notifications: CareNotification[]; invitations?: unknown[];
  checkins?: DailyCheckin[]; handoffs?: CareHandoff[]; shifts?: Array<Record<string, unknown>>;
}
export interface Bootstrap {
  mode: 'demo' | 'production';
  user: { id: string; name: string; email: string; role: Role };
  patients: Array<{ id: string; name: string; age?: number; city?: string; role?: Role }>;
  patient: Patient | null;
}
export interface Health {
  status: string; mode: 'demo' | 'production'; dataMode: string;
  integrations: { supabaseAuth: boolean; supabaseDatabase: boolean; aiProvider: boolean; email: boolean; ocr: boolean; scheduledDispatch: boolean };
}


export interface DailyCheckin {
  id: string; userId: string; userName: string; status: 'good' | 'okay' | 'tired' | 'need-help';
  note?: string; createdAt: string;
}
export interface CareHandoff {
  id: string; fromMemberId: string; fromName: string; toMemberId: string; toName: string;
  summary: string; status: 'pending' | 'acknowledged'; createdAt: string;
  acknowledgedAt?: string; acknowledgedByName?: string;
}
export interface CareAnalytics {
  generatedAt: string;
  today: { total: number; taken: number; missed: number; skipped: number; pending: number; adherencePercent: number | null };
  lastSevenDays: Array<{ date: string; label: string; taken: number; missed: number; skipped: number; pending: number; adherencePercent: number | null }>;
  lowStock: Array<{ id: string; name: string; stock: number; refillAt: number }>;
  upcomingAppointments: Appointment[];
  openTaskCount: number; pendingHandoffCount: number; unresolvedMissedCount: number;
  caregiverWorkload: Array<{ memberId: string; name: string; role: string; openTasks: number }>;
  checkinsLastSevenDays: number; totalActiveMedications: number; careCircleSize: number;
  careSignals: Array<{ id: string; severity: 'urgent' | 'high' | 'medium' | 'low'; category: string; title: string; reason: string; suggestedAction: string; sourceCount: number }>;
}


export interface VisitBrief {
  generatedAt: string;
  patient: { id: string; name: string; age?: number; language?: string };
  appointment: Appointment;
  medicationReview: Array<{ name: string; strength: string; times: string[]; frequency: string; instructions: string; prescriber: string }>;
  doseReview: { windowDays: number; total: number; taken: number; missed: number; skipped: number; pending: number; adherencePercent: number | null; unresolvedMisses: Array<{ medicationName: string; scheduledAt: string; followUpStatus: string }> };
  openCareTasks: Array<{ title: string; assignedTo: string; dueAt: string | null; priority: string }>;
  recentPatientCheckins: Array<{ status: string; note: string; createdAt: string }>;
  recentCareEvents: Array<{ title: string; description: string; actor: string; createdAt: string }>;
  disclaimer: string;
}
