import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, Clock3, Download, FileText, HeartPulse,
  Home, Languages, LogOut, Mail, Menu, MessageCircle, Mic, Pill, Plus, RefreshCw, Search,
  Send, Settings, ShieldCheck, Sparkles, Stethoscope, UserRound, Users, WandSparkles, X,
  CalendarClock, Camera, Copy, CircleCheck, AlertTriangle, Phone, Volume2, MoreHorizontal, Pencil,
  HeartHandshake, ClipboardList, ArrowRightLeft, BarChart3, TrendingUp,
} from 'lucide-react';
import type { Appointment, Bootstrap, CareAnalytics, CareHandoff, CareTask, Dose, Health, Medication, Patient, Role, VisitBrief } from './types';
import { initializeSupabase, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type Auth } from './auth';

const ROLE_LABELS: Record<string, string> = { patient: 'Patient', family: 'Family member', caregiver: 'Caregiver', clinician: 'Clinician' };
const DEMO_ROLES: Role[] = ['patient', 'family', 'caregiver', 'clinician'];
const NAV = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'medications', label: 'Medications', icon: Pill },
  { id: 'care-circle', label: 'Care circle', icon: Users },
  { id: 'operations', label: 'Care intelligence', icon: Activity },
  { id: 'insights', label: 'Insights & reports', icon: BarChart3 },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'mitra', label: 'Mitra AI', icon: Sparkles },
  { id: 'passport', label: 'Care passport', icon: FileText },
];

function formatTime(value?: string) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date);
}
function formatDate(value?: string, withTime = false) {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not set';
  return new Intl.DateTimeFormat('en-IN', withTime ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' } : { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}
function initials(name = '') { return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'NL'; }
function isToday(value: string) { return new Date(value).toDateString() === new Date().toDateString(); }
function classNames(...values: Array<string | false | undefined>) { return values.filter(Boolean).join(' '); }

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-heading"><div><span className="eyebrow">NALAMLINK WORKSPACE</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
      {children}
    </section>
  </div>;
}

function StatusPill({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`status-pill status-${status.toLowerCase()}`}><span className="status-dot"/>{label}</span>;
}

function Avatar({ name, color = 'teal', size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`avatar avatar-${color} avatar-${size}`} aria-label={name}>{initials(name)}</span>;
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof CircleHelp; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22}/></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [analytics, setAnalytics] = useState<CareAnalytics | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authClient, setAuthClient] = useState<Auth | null>(null);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [demoRole, setDemoRole] = useState<Role>(() => (localStorage.getItem('nalam-demo-role') as Role) || 'family');
  const [page, setPage] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'medication' | 'appointment' | 'task' | 'invite' | null>(null);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [inviteResult, setInviteResult] = useState<{ code: string; email: string; expiresAt: string } | null>(null);
  const [medForm, setMedForm] = useState({ name: '', strength: '', form: 'Tablet', instructions: '', time1: '08:00', time2: '', frequency: 'Daily', stock: '20', unitsPerDose: '1', stockUnit: 'tablets', prescriber: 'Dr. Anand' });
  const [appointmentForm, setAppointmentForm] = useState({ doctor: '', specialty: 'General Physician', location: '', date: '', time: '10:00', reason: '', notes: '' });
  const [taskForm, setTaskForm] = useState({ title: '', assignedTo: 'Meena Raman', due: '', priority: 'medium' });
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'family' });
  const [aiQuestion, setAiQuestion] = useState('Prepare a clear care-circle summary for today. Highlight any unconfirmed or missed medication.');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiSource, setAiSource] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginName, setLoginName] = useState('');
  const [newPatient, setNewPatient] = useState({ name: '', age: '72', language: 'Tamil', city: 'Chennai', emergencyContact: '' });
  const [joinCode, setJoinCode] = useState('');
  const [registerMode, setRegisterMode] = useState(false);

  const user = bootstrap?.user;
  const patient = bootstrap?.patient;
  const currentRole = (health?.mode === 'demo' ? demoRole : user?.role || 'member') as Role;
  const canEdit = currentRole !== 'clinician';
  const unreadNotifications = patient?.notifications?.filter((n) => !n.read) || [];

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (health?.mode === 'demo') headers.set('x-demo-user', demoRole);
    if (health?.mode === 'production' && authUser) headers.set('Authorization', `Bearer ${authUser.accessToken}`);
    const response = await fetch(path, { ...options, headers });
    return readResponse<any>(response);
  }, [health?.mode, demoRole, authUser]);

  const refresh = useCallback(async (patientId?: string) => {
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    const data = await request(`/api/bootstrap${query}`) as Bootstrap;
    setBootstrap(data);
    if (data.patient?.id) {
      try { const result = await request(`/api/patients/${data.patient.id}/analytics`); setAnalytics(result.analytics as CareAnalytics); }
      catch { setAnalytics(null); }
    } else setAnalytics(null);
    return data;
  }, [request]);

  useEffect(() => {
    fetch('/api/health').then((r) => readResponse<Health>(r)).then(setHealth).catch((e) => setError(`Cannot reach the application server: ${e.message}`));
  }, []);

  useEffect(() => {
    if (!health || health.mode !== 'production') return;
    let unsubscribe: (() => void) | undefined;
    initializeSupabase().then((client) => {
      setAuthClient(client);
      setAuthConfigured(Boolean(client));
      setAuthReady(true);
      if (client) unsubscribe = onAuthStateChanged(client, (u) => setAuthUser(u));
    });
    return () => unsubscribe?.();
  }, [health?.mode]);

  useEffect(() => {
    if (!health || (health.mode === 'production' && !authUser)) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    refresh().then(() => { if (active) setError(''); }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [health, authUser, demoRole, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const todayDoses = useMemo(() => (patient?.doses || []).filter((d) => isToday(d.scheduledAt)).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)), [patient]);
  const takenCount = todayDoses.filter((d) => d.status === 'taken').length;
  const missedCount = todayDoses.filter((d) => d.status === 'missed').length;
  const pendingCount = todayDoses.filter((d) => d.status === 'pending').length;
  const decidedDoses = takenCount + missedCount;
  const adherence = decidedDoses ? Math.round((takenCount / decidedDoses) * 100) : null;
  const upcomingAppointment = useMemo(() => (patient?.appointments || []).filter((a) => a.status === 'scheduled' && new Date(a.scheduledAt).getTime() >= Date.now()).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))[0], [patient]);
  const recentEvents = useMemo(() => [...(patient?.events || [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5), [patient]);
  const globalSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query || !patient) return [];
    const rows = [
      ...patient.medications.map((item) => ({ id: item.id, title: `${item.name} ${item.strength || ''}`.trim(), detail: `Medication · ${item.times?.join(', ') || 'No schedule'}`, page: 'medications' })),
      ...patient.appointments.map((item) => ({ id: item.id, title: item.doctor, detail: `Appointment · ${formatDate(item.scheduledAt, true)}`, page: 'appointments' })),
      ...patient.tasks.map((item) => ({ id: item.id, title: item.title, detail: `Care task · ${item.assignedTo || 'Unassigned'}`, page: 'care-circle' })),
      ...(patient.events || []).map((item) => ({ id: item.id, title: item.title, detail: `Activity · ${item.description || item.actor || ''}`, page: 'care-circle' })),
    ];
    return rows.filter((row) => `${row.title} ${row.detail}`.toLowerCase().includes(query)).slice(0, 7);
  }, [globalSearch, patient]);

  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      const result = await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      await refresh(patient?.id);
      setToast('Changes saved successfully');
      return result;
    } catch (e: any) {
      setError(e.message);
      setToast(e.message);
      throw e;
    } finally { setBusy(false); }
  }

  async function handleDose(dose: Dose, status: 'taken' | 'skipped') {
    await mutate(`/api/patients/${patient!.id}/doses/${dose.id}`, 'PATCH', { status });
  }

  function openMedicationEditor(med?: Medication) {
    setEditingMedication(med || null);
    setMedForm(med ? {
      name: med.name, strength: med.strength || '', form: med.form || 'Tablet', instructions: med.instructions || '',
      time1: med.times?.[0] || '08:00', time2: med.times?.[1] || '', frequency: med.frequency || 'Daily',
      stock: String(med.stock ?? 0), unitsPerDose: String(med.unitsPerDose ?? 1), stockUnit: med.stockUnit || (med.form === 'Liquid' ? 'mL' : med.form === 'Capsule' ? 'capsules' : med.form === 'Tablet' ? 'tablets' : 'units'), prescriber: med.prescriber || '',
    } : { name: '', strength: '', form: 'Tablet', instructions: '', time1: '08:00', time2: '', frequency: 'Daily', stock: '20', unitsPerDose: '1', stockUnit: 'tablets', prescriber: 'Dr. Anand' });
    setModal('medication');
  }

  async function addMedication(e: FormEvent) {
    e.preventDefault();
    const times = [medForm.time1, medForm.time2].filter(Boolean);
    const body = { name: medForm.name, strength: medForm.strength, form: medForm.form, instructions: medForm.instructions, times, frequency: medForm.frequency, stock: Number(medForm.stock || 0), unitsPerDose: Number(medForm.unitsPerDose || 1), stockUnit: medForm.stockUnit, prescriber: medForm.prescriber, refillAt: 7 };
    if (editingMedication) await mutate(`/api/patients/${patient!.id}/medications/${editingMedication.id}`, 'PATCH', body);
    else await mutate(`/api/patients/${patient!.id}/medications`, 'POST', body);
    setModal(null);
    setEditingMedication(null);
    setMedForm({ name: '', strength: '', form: 'Tablet', instructions: '', time1: '08:00', time2: '', frequency: 'Daily', stock: '20', unitsPerDose: '1', stockUnit: 'tablets', prescriber: 'Dr. Anand' });
  }

  async function addAppointment(e: FormEvent) {
    e.preventDefault();
    const scheduledAt = new Date(`${appointmentForm.date}T${appointmentForm.time}:00`).toISOString();
    await mutate(`/api/patients/${patient!.id}/appointments`, 'POST', { doctor: appointmentForm.doctor, specialty: appointmentForm.specialty, location: appointmentForm.location, scheduledAt, reason: appointmentForm.reason, notes: appointmentForm.notes, status: 'scheduled' });
    setModal(null);
    setAppointmentForm({ doctor: '', specialty: 'General Physician', location: '', date: '', time: '10:00', reason: '', notes: '' });
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    const dueAt = taskForm.due ? new Date(taskForm.due).toISOString() : '';
    await mutate(`/api/patients/${patient!.id}/tasks`, 'POST', { title: taskForm.title, assignedTo: taskForm.assignedTo, dueAt, priority: taskForm.priority, status: 'pending' });
    setModal(null);
    setTaskForm({ title: '', assignedTo: 'Meena Raman', due: '', priority: 'medium' });
  }

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await request(`/api/patients/${patient!.id}/invitations`, { method: 'POST', body: JSON.stringify(inviteForm) });
      setInviteResult({ code: result.code, email: result.invitation.email, expiresAt: result.invitation.expiresAt });
      setToast(result.delivery?.sent ? 'Invitation email sent' : 'Invitation created — share its code securely');
    } catch (e: any) { setToast(e.message); } finally { setBusy(false); }
  }

  async function askMitra(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setAiAnswer('');
    try {
      const result = await request(`/api/patients/${patient!.id}/ai/summary`, { method: 'POST', body: JSON.stringify({ question: aiQuestion, patientId: patient?.id }) });
      setAiAnswer(result.answer); setAiSource(result.source);
    } catch (e: any) { setAiAnswer(`I couldn't create the summary: ${e.message}`); setAiSource('error'); }
    finally { setBusy(false); }
  }

  async function scanPrescription(file?: File) {
    if (!file || !patient) return;
    setBusy(true); setOcrText('');
    try {
      const form = new FormData(); form.append('file', file);
      const result = await request(`/api/patients/${patient.id}/ocr/extract`, { method: 'POST', body: form });
      setOcrText(result.text || result.message);
      setToast(result.message || 'Review extracted text before using it');
    } catch (e: any) { setOcrText(e.message); }
    finally { setBusy(false); }
  }

  async function downloadPassport() {
    try {
      const data = await request(`/api/passport/${patient!.id}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `nalamlink-care-passport-${patient!.id}.json`; a.click(); URL.revokeObjectURL(url);
      setToast('Care passport exported');
    } catch (e: any) { setToast(e.message); }
  }

  async function submitCheckin(payload: { status: string; note: string }) {
    await mutate(`/api/patients/${patient!.id}/checkins`, 'POST', payload);
  }

  async function createHandoff(payload: { fromMemberId: string; toMemberId: string; summary: string }) {
    await mutate(`/api/patients/${patient!.id}/handoffs`, 'POST', payload);
  }

  async function acknowledgeHandoff(handoff: CareHandoff) {
    await mutate(`/api/patients/${patient!.id}/handoffs/${handoff.id}/acknowledge`, 'POST', {});
  }

  async function acknowledgeNotification(notificationId: string) {
    await mutate(`/api/patients/${patient!.id}/notifications/${notificationId}/acknowledge`, 'POST', {});
  }

  async function finishTask(task: CareTask) {
    await mutate(`/api/patients/${patient!.id}/tasks/${task.id}`, 'PATCH', { status: 'completed', completedAt: new Date().toISOString() });
  }

  async function revokeMember(member: Patient['members'][number]) {
    if (!confirm(`Revoke ${member.name}'s access to this care profile?`)) return;
    await mutate(`/api/patients/${patient!.id}/members/${member.id}`, 'DELETE');
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!authClient) return;
    setBusy(true);
    try {
      if (registerMode) {
        await createUserWithEmailAndPassword(authClient, loginEmail, loginPassword, loginName.trim());
      } else await signInWithEmailAndPassword(authClient, loginEmail, loginPassword);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!health && !error) return <div className="loading-screen"><div className="brand-mark large"><HeartPulse size={26}/></div><p>Connecting to NalamLink...</p></div>;
  if (health?.mode === 'production' && authReady && !authConfigured) return <div className="auth-screen"><div className="auth-card"><Brand/><h1>Connect your Supabase sign-in</h1><p>This deployment is in production mode, but Supabase Auth is not configured. Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in your hosting environment and redeploy.</p><p className="muted">For a public hackathon demo, use <code>DEMO_MODE=true</code> and redeploy.</p></div></div>;
  if (health?.mode === 'production' && !authReady) return <div className="loading-screen"><div className="brand-mark large"><HeartPulse size={26}/></div><p>Connecting secure sign-in…</p></div>;
  if (health?.mode === 'production' && !authUser) return <div className="auth-screen"><div className="auth-card"><Brand/><span className="eyebrow">SECURE CARE ACCESS</span><h1>{registerMode ? 'Create your account' : 'Welcome back'}</h1><p>Sign in to access your authorized care circle.</p><form className="stack-form" onSubmit={handleLogin}>{registerMode && <Field label="Full name" value={loginName} onChange={setLoginName} required/>}<Field label="Email address" value={loginEmail} onChange={setLoginEmail} type="email" required/><Field label="Password" value={loginPassword} onChange={setLoginPassword} type="password" required/><button className="primary-button full" disabled={busy}>{busy ? 'Please wait…' : registerMode ? 'Create account' : 'Sign in'}</button></form><button className="text-button" onClick={() => setRegisterMode(!registerMode)}>{registerMode ? 'Already registered? Sign in' : 'New here? Create an account'}</button>{error && <p className="form-error">{error}</p>}</div></div>;
  if (loading) return <div className="loading-screen"><div className="brand-mark large"><HeartPulse size={26}/></div><p>Loading your care workspace…</p></div>;
  if (!patient && health?.mode === 'production') return <div className="auth-screen"><div className="auth-card onboarding-card"><Brand/><span className="eyebrow">GETTING STARTED</span><h1>Set up your care circle</h1><p>Create a patient profile or join an existing circle with an invitation code.</p><form className="stack-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await request('/api/patients', { method: 'POST', body: JSON.stringify({ ...newPatient, age: Number(newPatient.age) }) }); await refresh(); } catch (err: any) { setError(err.message); } finally { setBusy(false); } }}><Field label="Patient name" value={newPatient.name} onChange={(v) => setNewPatient({ ...newPatient, name: v })} required/><div className="form-grid"><Field label="Age" type="number" value={newPatient.age} onChange={(v) => setNewPatient({ ...newPatient, age: v })} required/><SelectField label="Preferred language" value={newPatient.language} onChange={(v) => setNewPatient({ ...newPatient, language: v })} options={['Tamil', 'English', 'Hindi', 'Telugu', 'Malayalam']}/></div><Field label="City" value={newPatient.city} onChange={(v) => setNewPatient({ ...newPatient, city: v })}/><Field label="Emergency contact" value={newPatient.emergencyContact} onChange={(v) => setNewPatient({ ...newPatient, emergencyContact: v })}/><button className="primary-button full" disabled={busy}>{busy ? 'Creating…' : 'Create patient profile'}</button></form><div className="onboarding-divider"><span>OR JOIN AN EXISTING CIRCLE</span></div><form className="stack-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await request('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ code: joinCode }) }); await refresh(); } catch (err: any) { setError(err.message); } finally { setBusy(false); } }}><Field label="Six-digit invitation code" value={joinCode} onChange={setJoinCode} placeholder="000000" required/><button className="secondary-button full" disabled={busy}>Join care circle</button></form>{error && <p className="form-error">{error}</p>}</div></div>;
  if (!patient) return <div className="loading-screen"><div className="brand-mark large"><HeartPulse size={26}/></div><p>No care profile is available.</p>{error && <p className="form-error">{error}</p>}</div>;

  return <div className="app-shell">
    <aside className={classNames('sidebar', mobileNav && 'sidebar-open')}>
      <div className="sidebar-brand"><Brand/><button className="icon-button mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">CARE WORKSPACE</div>
      <button className="patient-switcher"><Avatar name={patient.name} color="sage"/><span className="patient-switch-text"><strong>{patient.name}</strong><small>{patient.age} years · {patient.city || 'Care profile'}</small></span><ChevronDown size={15}/></button>
      <div className="nav-section-label">MENU</div>
      <nav className="side-nav" aria-label="Main navigation">{NAV.map((item) => <button key={item.id} className={classNames('nav-item', page === item.id && 'active')} onClick={() => { setPage(item.id); setMobileNav(false); }}><item.icon size={18}/><span>{item.label}</span>{item.id === 'mitra' && <span className="nav-new">AI</span>}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="safety-card"><span className="safety-icon"><ShieldCheck size={17}/></span><strong>Your care circle is connected</strong><p>Access is limited by each member's role.</p><button onClick={() => setPage('care-circle')}>Manage access <ChevronRight size={13}/></button></div>
      <div className="sidebar-footer"><div className="signed-in"><Avatar name={user?.name || 'Demo user'} color="lavender" size="sm"/><div><strong>{user?.name || 'Demo user'}</strong><small>{ROLE_LABELS[currentRole] || 'Member'}</small></div><button className="icon-button tiny" title="Sign out" onClick={() => authClient && signOut(authClient)}><LogOut size={15}/></button></div><div className="build-label"><span className="live-dot"/> {health?.mode === 'demo' ? 'Interactive demo environment' : 'Secure connected workspace'}</div></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <ChevronRight size={13}/><strong>{NAV.find((n) => n.id === page)?.label || 'Settings'}</strong></div><div className="global-search-wrap"><Search size={16}/><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search medicines, tasks, appointments…" aria-label="Search care records"/>{globalSearch.trim() && <div className="global-search-results">{globalSearchResults.length ? globalSearchResults.map((result) => <button key={`${result.page}-${result.id}`} onClick={() => { setPage(result.page); setGlobalSearch(''); }}><span className="search-result-icon"><Search size={14}/></span><span><strong>{result.title}</strong><small>{result.detail}</small></span><ChevronRight size={14}/></button>) : <div className="search-no-results">No matching care records found.</div>}</div>}</div></div>
        <div className="topbar-actions">
          {health?.mode === 'demo' && <label className="role-select"><span>Viewing as</span><select value={demoRole} onChange={(e) => { setDemoRole(e.target.value as Role); localStorage.setItem('nalam-demo-role', e.target.value); }} aria-label="Switch demo role">{DEMO_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select><ChevronDown size={13}/></label>}
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)}><Bell size={18}/>{unreadNotifications.length > 0 && <span className="notification-count">{unreadNotifications.length}</span>}</button>
          <Avatar name={user?.name || 'NalamLink'} color="teal" size="sm"/>
        </div>
        {showNotifications && <div className="notification-popover"><div className="popover-title"><strong>Notifications</strong><span>{unreadNotifications.length} new</span></div>{(patient.notifications || []).slice(0, 5).map((n) => <div className="notification-row" key={n.id}><span className={`notification-symbol ${n.level}`}><Bell size={14}/></span><div><strong>{n.title}</strong><p>{n.message}</p><small>{formatDate(n.createdAt, true)}{n.emailStatus ? ` · Email ${n.emailStatus}` : ''}</small>{!n.read && <button className="text-button notification-ack" onClick={() => acknowledgeNotification(n.id)}>Acknowledge</button>}</div></div>)}{patient.notifications.length === 0 && <p className="muted small-pad">You're all caught up.</p>}</div>}
      </header>

      <div className="page-content">
        {error && <div className="inline-error"><AlertCircle size={16}/><span>{error}</span><button onClick={() => setError('')}><X size={14}/></button></div>}
        {page === 'overview' && <Dashboard patient={patient} doses={todayDoses} taken={takenCount} missed={missedCount} pending={pendingCount} adherence={adherence} appointment={upcomingAppointment} events={recentEvents} onNavigate={setPage} onDose={handleDose} onAddTask={() => setModal('task')} onAddMedication={() => openMedicationEditor()}/>}
        {page === 'medications' && <MedicationPage patient={patient} todayDoses={todayDoses} onAdd={() => openMedicationEditor()} onEdit={(med) => openMedicationEditor(med)} onDose={handleDose} onDelete={async (med) => { if (confirm(`Delete ${med.name} from the medication list?`)) await mutate(`/api/patients/${patient.id}/medications/${med.id}`, 'DELETE'); }} canEdit={canEdit}/>}
        {page === 'care-circle' && <CareCirclePage patient={patient} canEdit={canEdit} canManageMembers={currentRole === 'patient'} onRevoke={revokeMember} onInvite={() => { setInviteResult(null); setModal('invite'); }} onAddTask={() => setModal('task')} onFinishTask={finishTask}/>}
        {page === 'operations' && <CareOperationsPage patient={patient} analytics={analytics} currentUserId={user?.id || ''} currentRole={currentRole} canWrite={canEdit} busy={busy} onCheckin={submitCheckin} onHandoff={createHandoff} onAcknowledgeHandoff={acknowledgeHandoff}/>}
        {page === 'insights' && <InsightsPage patient={patient} analytics={analytics} onNavigate={setPage}/>} 
        {page === 'appointments' && <AppointmentsPage patient={patient} onAdd={() => setModal('appointment')} canEdit={canEdit} onPrepare={async (appt) => (await request(`/api/patients/${patient.id}/appointments/${appt.id}/brief`)).brief as VisitBrief} onDelete={async (appt) => { if (confirm(`Delete appointment with ${appt.doctor}?`)) await mutate(`/api/patients/${patient.id}/appointments/${appt.id}`, 'DELETE'); }}/>}
        {page === 'mitra' && <MitraPage question={aiQuestion} setQuestion={setAiQuestion} answer={aiAnswer} source={aiSource} busy={busy} onAsk={askMitra} onSpeak={() => { if (aiAnswer && 'speechSynthesis' in window) { const utterance = new SpeechSynthesisUtterance(aiAnswer); utterance.lang = patient.language?.toLowerCase().startsWith('tamil') ? 'ta-IN' : 'en-IN'; window.speechSynthesis.speak(utterance); } }} ocrText={ocrText} onScan={scanPrescription}/>}
        {page === 'passport' && <PassportPage patient={patient} onDownload={downloadPassport}/>}
      </div>
      <footer className="page-footer"><span>© 2026 NalamLink AI</span><span><ShieldCheck size={13}/> Care coordination support · Not a medical device</span><span className="footer-version">v3.1.0 · Enhanced edition</span></footer>
    </main>

    {modal === 'medication' && <Modal title={editingMedication ? 'Edit medication' : 'Add medication'} onClose={() => setModal(null)}><form className="modal-form" onSubmit={addMedication}><div className="form-grid"><Field label="Medication name" value={medForm.name} onChange={(v) => setMedForm({ ...medForm, name: v })} placeholder="e.g. Amlodipine" required/><Field label="Strength" value={medForm.strength} onChange={(v) => setMedForm({ ...medForm, strength: v })} placeholder="e.g. 5 mg" required/><SelectField label="Form" value={medForm.form} onChange={(v) => setMedForm({ ...medForm, form: v, stockUnit: v === 'Liquid' ? 'mL' : v === 'Capsule' ? 'capsules' : v === 'Tablet' ? 'tablets' : 'units' })} options={['Tablet', 'Capsule', 'Liquid', 'Other']}/><SelectField label="Frequency" value={medForm.frequency} onChange={(v) => setMedForm({ ...medForm, frequency: v })} options={['Daily', 'Twice daily', 'Weekly']}/><Field label="First reminder time" type="time" value={medForm.time1} onChange={(v) => setMedForm({ ...medForm, time1: v })} required/><Field label={medForm.frequency === 'Twice daily' ? "Second time (required)" : "Second time (optional)"} type="time" value={medForm.time2} onChange={(v) => setMedForm({ ...medForm, time2: v })} required={medForm.frequency === 'Twice daily'}/><Field label={`Current stock (${medForm.stockUnit})`} type="number" step="0.1" min="0" value={medForm.stock} onChange={(v) => setMedForm({ ...medForm, stock: v })}/><Field label={`Units consumed per dose (${medForm.stockUnit})`} type="number" step="0.1" min="0.01" value={medForm.unitsPerDose} onChange={(v) => setMedForm({ ...medForm, unitsPerDose: v })} required/><Field label="Prescriber" value={medForm.prescriber} onChange={(v) => setMedForm({ ...medForm, prescriber: v })}/></div><label className="field-label">Instructions<textarea value={medForm.instructions} onChange={(e) => setMedForm({ ...medForm, instructions: e.target.value })} placeholder="Enter the instructions exactly as prescribed" rows={2}/></label><p className="form-hint"><ShieldCheck size={14}/> Verify the medicine and schedule against the clinician's prescription before saving.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editingMedication ? 'Save changes' : 'Save medication'}</button></div></form></Modal>}

    {modal === 'appointment' && <Modal title="Schedule appointment" onClose={() => setModal(null)}><form className="modal-form" onSubmit={addAppointment}><div className="form-grid"><Field label="Doctor name" value={appointmentForm.doctor} onChange={(v) => setAppointmentForm({ ...appointmentForm, doctor: v })} required/><Field label="Specialty" value={appointmentForm.specialty} onChange={(v) => setAppointmentForm({ ...appointmentForm, specialty: v })}/><Field label="Date" type="date" value={appointmentForm.date} onChange={(v) => setAppointmentForm({ ...appointmentForm, date: v })} required/><Field label="Time" type="time" value={appointmentForm.time} onChange={(v) => setAppointmentForm({ ...appointmentForm, time: v })} required/><Field label="Clinic / location" value={appointmentForm.location} onChange={(v) => setAppointmentForm({ ...appointmentForm, location: v })}/><Field label="Reason for visit" value={appointmentForm.reason} onChange={(v) => setAppointmentForm({ ...appointmentForm, reason: v })}/></div><label className="field-label">Notes<textarea rows={2} value={appointmentForm.notes} onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save appointment'}</button></div></form></Modal>}

    {modal === 'task' && <Modal title="Create a care task" onClose={() => setModal(null)}><form className="modal-form" onSubmit={addTask}><Field label="Task title" value={taskForm.title} onChange={(v) => setTaskForm({ ...taskForm, title: v })} placeholder="e.g. Confirm evening medication" required/><div className="form-grid"><SelectField label="Assign to" value={taskForm.assignedTo} onChange={(v) => setTaskForm({ ...taskForm, assignedTo: v })} options={patient.members.filter((m) => ['family', 'caregiver'].includes(m.role)).map((m) => m.name)}/><SelectField label="Priority" value={taskForm.priority} onChange={(v) => setTaskForm({ ...taskForm, priority: v })} options={['low', 'medium', 'high']}/><Field label="Due date and time" type="datetime-local" value={taskForm.due} onChange={(v) => setTaskForm({ ...taskForm, due: v })}/></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Create task'}</button></div></form></Modal>}

    {modal === 'invite' && <Modal title="Invite to care circle" onClose={() => setModal(null)}>{inviteResult ? <div className="invite-success"><span className="success-icon"><CheckCircle2 size={27}/></span><h3>Invitation code created</h3><p>Share this six-digit code with <strong>{inviteResult.email}</strong>. It expires {formatDate(inviteResult.expiresAt, true)}.</p><div className="invite-code">{inviteResult.code}<button className="icon-button" onClick={() => { navigator.clipboard?.writeText(inviteResult.code); setToast('Invitation code copied'); }}><Copy size={16}/></button></div><p className="muted">Email delivery: {health?.integrations.email ? 'configured; check delivery status' : 'not configured — share the code securely yourself'}.</p><button className="primary-button full" onClick={() => setModal(null)}>Done</button></div> : <form className="modal-form" onSubmit={createInvite}><p className="muted">Invite someone who helps coordinate care. Invitations expire after 24 hours.</p><Field label="Email address" type="email" value={inviteForm.email} onChange={(v) => setInviteForm({ ...inviteForm, email: v })} required/><SelectField label="Access role" value={inviteForm.role} onChange={(v) => setInviteForm({ ...inviteForm, role: v })} options={['family', 'caregiver', 'clinician']}/><div className="form-hint"><ShieldCheck size={14}/> Only share access with trusted people. You can revoke access from the care circle.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create invitation'}</button></div></form>}</Modal>}

    {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}

function Brand() { return <div className="brand"><span className="brand-mark"><HeartPulse size={20}/></span><span className="brand-name">nalam<span>link</span><small>AI CARE COORDINATION</small></span></div>; }
function Field({ label, value, onChange, type = 'text', placeholder, required = false, step, min, max }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; step?: string; min?: string; max?: string }) { return <label className="field-label">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} step={step} min={min} max={max}/></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) { return <label className="field-label">{label}<select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>; }

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

function CareOperationsPage({ patient, analytics, currentUserId, currentRole, canWrite, busy, onCheckin, onHandoff, onAcknowledgeHandoff }: {
  patient: Patient; analytics: CareAnalytics | null; currentUserId: string; currentRole: Role; canWrite: boolean; busy: boolean;
  onCheckin: (payload: { status: string; note: string }) => Promise<void>;
  onHandoff: (payload: { fromMemberId: string; toMemberId: string; summary: string }) => Promise<void>;
  onAcknowledgeHandoff: (handoff: CareHandoff) => Promise<void>;
}) {
  const activeMembers = patient.members.filter((member) => member.status === 'active');
  const caregivers = activeMembers.filter((member) => ['family', 'caregiver'].includes(member.role));
  const sender = activeMembers.find((member) => member.userId === currentUserId) || activeMembers.find((member) => member.role === currentRole) || activeMembers[0];
  const defaultRecipient = caregivers.find((member) => member.userId !== sender?.userId) || activeMembers.find((member) => member.userId !== sender?.userId);
  const [checkinStatus, setCheckinStatus] = useState('okay');
  const [checkinNote, setCheckinNote] = useState('');
  const [fromMemberId, setFromMemberId] = useState(sender?.userId || '');
  const [toMemberId, setToMemberId] = useState(defaultRecipient?.userId || '');
  const [handoffSummary, setHandoffSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const handoffs = [...(patient.handoffs || [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const checkins = [...(patient.checkins || [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const runCheckin = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setLocalError('');
    try { await onCheckin({ status: checkinStatus, note: checkinNote }); setCheckinNote(''); }
    catch (error: any) { setLocalError(error.message || 'Could not save check-in.'); }
    finally { setSaving(false); }
  };
  const runHandoff = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setLocalError('');
    try { await onHandoff({ fromMemberId, toMemberId, summary: handoffSummary }); setHandoffSummary(''); }
    catch (error: any) { setLocalError(error.message || 'Could not create handoff.'); }
    finally { setSaving(false); }
  };
  const todayAdherence = analytics?.today.adherencePercent;
  const metric = (value: number | string, label: string, detail: string, Icon: typeof Activity, tone: string) => <div className="ops-metric"><span className={`ops-metric-icon ${tone}`}><Icon size={17}/></span><div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div></div>;
  return <>
    <PageHeading eyebrow="CARE OPERATIONS CENTER" title="Care intelligence" subtitle="A shared operational view of adherence, open care loops, wellbeing check-ins and caregiver handoffs." action={<span className="ai-status"><span className="live-dot"/> Live workspace data</span>}/>
    {localError && <div className="inline-error"><AlertCircle size={15}/>{localError}</div>}
    <div className="ops-metric-grid">
      {metric(todayAdherence == null ? '—' : `${todayAdherence}%`, "Today's recorded adherence", `${analytics?.today.taken || 0} taken · ${analytics?.today.missed || 0} missed`, Activity, 'teal')}
      {metric(analytics?.unresolvedMissedCount ?? 0, 'Unresolved missed doses', 'Follow-up still open', AlertTriangle, 'amber')}
      {metric(analytics?.openTaskCount ?? patient.tasks.filter((task) => task.status !== 'completed').length, 'Open care tasks', 'Shared responsibilities', ClipboardList, 'blue')}
      {metric(analytics?.pendingHandoffCount ?? handoffs.filter((handoff) => handoff.status !== 'acknowledged').length, 'Pending handoffs', 'Awaiting acknowledgement', ArrowRightLeft, 'violet')}
      {metric(analytics?.totalActiveMedications ?? patient.medications.filter((med) => med.active !== false).length, 'Active medicines', 'Current medication records', Pill, 'teal')}
      {metric(analytics?.checkinsLastSevenDays ?? checkins.length, 'Wellbeing check-ins', 'Recorded in the last seven days', HeartHandshake, 'blue')}
    </div>
    <section className="panel care-signals-panel">
      <div className="panel-heading"><div><span className="eyebrow">EXPLAINABLE RULE ENGINE</span><h2>Care signals & next actions</h2><p className="panel-subtitle">Every signal links to a recorded event or threshold. These are coordination prompts, not medical predictions.</p></div><span className="period-chip">{analytics?.careSignals?.length || 0} active signals</span></div>
      <div className="care-signal-grid">
        {(analytics?.careSignals || []).map((signal) => <article className={`care-signal signal-${signal.severity}`} key={signal.id}>
          <div className="care-signal-top"><span className={`signal-severity severity-${signal.severity}`}>{signal.severity}</span><small>{signal.category}</small></div>
          <strong>{signal.title}</strong><p>{signal.reason}</p><div className="signal-action"><b>Suggested next action</b><span>{signal.suggestedAction}</span></div>
        </article>)}
        {!analytics?.careSignals?.length && <div className="care-signals-empty"><CheckCircle2 size={22}/><div><strong>No active coordination signals</strong><p>New signals appear when a recorded care event needs attention.</p></div></div>}
      </div>
    </section>
    <div className="ops-grid">
      <section className="panel ops-panel">
        <div className="panel-heading"><div><span className="eyebrow">CARE TREND</span><h2>Seven-day adherence</h2></div><span className="period-chip">Recorded outcomes</span></div>
        <div className="ops-chart">{(analytics?.lastSevenDays || []).map((day) => <div className="ops-chart-day" key={day.date}><div className="ops-bar-track"><span className="ops-bar-taken" style={{ height: `${day.taken + day.missed ? day.taken / (day.taken + day.missed) * 100 : 0}%` }}/><span className="ops-bar-missed" style={{ height: `${day.taken + day.missed ? day.missed / (day.taken + day.missed) * 100 : 0}%` }}/></div><strong>{day.adherencePercent == null ? '—' : `${day.adherencePercent}%`}</strong><small>{day.label}</small><span className="ops-chart-count">{day.taken}/{day.taken + day.missed}</span></div>)}</div>
        <div className="ops-legend"><span><i className="legend-taken"/> Taken</span><span><i className="legend-missed"/> Missed</span><small>Pending and skipped doses are excluded from the adherence denominator.</small></div>
      </section>
      <section className="panel ops-panel">
        <div className="panel-heading"><div><span className="eyebrow">PROACTIVE FOLLOW-UP</span><h2>Attention queue</h2></div><span className="period-chip">Actionable</span></div>
        <div className="ops-attention-list">
          {(analytics?.lowStock || []).map((item) => <div className="ops-attention-item" key={item.id}><span className="ops-attention-icon amber"><Pill size={15}/></span><div><strong>{item.name} · low stock</strong><small>{item.stock} {patient.medications.find((med) => med.id === item.id)?.stockUnit || 'units'} recorded · refill threshold {item.refillAt}</small></div><span className="priority-pill priority-high">Review</span></div>)}
          {(analytics?.upcomingAppointments || []).slice(0, 3).map((appt) => <div className="ops-attention-item" key={appt.id}><span className="ops-attention-icon blue"><CalendarDays size={15}/></span><div><strong>{appt.doctor} · appointment</strong><small>{formatDate(appt.scheduledAt, true)} · {appt.location || 'Location not added'}</small></div></div>)}
          {(analytics?.unresolvedMissedCount || 0) > 0 && <div className="ops-attention-item"><span className="ops-attention-icon red"><AlertTriangle size={15}/></span><div><strong>{analytics?.unresolvedMissedCount} missed dose follow-up(s)</strong><small>Check in with the patient and record the outcome.</small></div></div>}
          {!analytics?.lowStock?.length && !analytics?.upcomingAppointments?.length && !analytics?.unresolvedMissedCount && <div className="ops-empty"><CheckCircle2 size={20}/><strong>No open attention items</strong><small>New actionable care items will appear here.</small></div>}
        </div>
      </section>
    </div>
    <div className="ops-grid ops-grid-bottom">
      <section className="panel ops-panel">
        <div className="panel-heading"><div><span className="eyebrow">PATIENT-CENTERED SIGNAL</span><h2>Daily wellbeing check-in</h2></div><span className="period-chip">Self-reported</span></div>
        {canWrite ? <form className="ops-form" onSubmit={runCheckin}>
          <label className="field-label">How are you feeling today?<select value={checkinStatus} onChange={(event) => setCheckinStatus(event.target.value)}><option value="good">Good</option><option value="okay">Okay</option><option value="tired">Tired</option><option value="need-help">I need someone to check in</option></select></label>
          <label className="field-label">Optional note<textarea rows={2} maxLength={500} value={checkinNote} onChange={(event) => setCheckinNote(event.target.value)} placeholder="Share a short note with your care circle…"/></label>
          <button className="primary-button" disabled={saving || busy}><HeartHandshake size={15}/>{saving ? 'Saving…' : 'Submit check-in'}</button>
        </form> : <p className="muted">This role has view-only access to patient wellbeing check-ins.</p>}
        <div className="ops-recent-checkins"><strong>Recent check-ins</strong>{checkins.slice(0, 4).map((checkin) => <div className="ops-checkin-row" key={checkin.id}><span className={`checkin-status status-${checkin.status}`}>{checkin.status.replace('-', ' ')}</span><div><strong>{checkin.userName}</strong><small>{checkin.note || 'No additional note'} · {formatDate(checkin.createdAt, true)}</small></div></div>)}{!checkins.length && <small>No check-ins recorded yet.</small>}</div>
        <p className="ops-safety-note">A check-in is a self-reported coordination signal, not a clinical assessment or emergency monitoring service. For immediate danger, contact local emergency services.</p>
      </section>
      <section className="panel ops-panel">
        <div className="panel-heading"><div><span className="eyebrow">CONTINUITY OF CARE</span><h2>Caregiver handoff</h2></div><span className="period-chip">Shared responsibility</span></div>
        {canWrite ? <form className="ops-form" onSubmit={runHandoff}>
          <div className="form-grid"><label className="field-label">From<select value={fromMemberId} onChange={(event) => setFromMemberId(event.target.value)}>{activeMembers.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label><label className="field-label">To<select value={toMemberId} onChange={(event) => setToMemberId(event.target.value)}>{caregivers.filter((member) => member.userId !== fromMemberId).map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label></div>
          <label className="field-label">Handoff summary<textarea rows={2} maxLength={1200} value={handoffSummary} onChange={(event) => setHandoffSummary(event.target.value)} placeholder="What should the next caregiver know or follow up on?" required/></label>
          <button className="primary-button" disabled={saving || busy || !fromMemberId || !toMemberId || fromMemberId === toMemberId}><ArrowRightLeft size={15}/>{saving ? 'Creating…' : 'Create handoff'}</button>
        </form> : <p className="muted">This role has view-only access to caregiver handoffs.</p>}
        <div className="ops-recent-checkins"><strong>Handoff history</strong>{handoffs.slice(0, 4).map((handoff) => <div className="ops-handoff-row" key={handoff.id}><div><strong>{handoff.fromName} <span>→</span> {handoff.toName}</strong><small>{handoff.summary}</small><small>{formatDate(handoff.createdAt, true)}</small></div>{handoff.status === 'acknowledged' ? <StatusPill status="completed"/> : canWrite && (currentRole === 'patient' || handoff.toMemberId === currentUserId || currentRole === 'family') ? <button className="secondary-button tiny-button" onClick={() => onAcknowledgeHandoff(handoff)} disabled={busy}>Acknowledge</button> : <StatusPill status="pending" />}</div>)}{!handoffs.length && <small>No care handoffs recorded yet.</small>}</div>
      </section>
    </div>
    <div className="ops-disclaimer"><ShieldCheck size={15}/><span>Analytics are calculated from the records in this workspace. They are coordination indicators, not a diagnosis, prediction or substitute for clinical review.</span></div>
  </>;
}

function Dashboard({ patient, doses, taken, missed, pending, adherence, appointment, events, onNavigate, onDose, onAddTask, onAddMedication }: { patient: Patient; doses: Dose[]; taken: number; missed: number; pending: number; adherence: number | null; appointment?: Appointment; events: Patient['events']; onNavigate: (page: string) => void; onDose: (dose: Dose, status: 'taken' | 'skipped') => void; onAddTask: () => void; onAddMedication: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const openTasks = patient.tasks.filter((t) => t.status !== 'completed');
  const stockAlerts = patient.medications.filter((m) => m.active !== false && m.stock <= (m.refillAt ?? 7));
  const week = [6, 5, 4, 3, 2, 1, 0].map((back) => {
    const day = new Date(); day.setDate(day.getDate() - back);
    const records = patient.doses.filter((d) => new Date(d.scheduledAt).toDateString() === day.toDateString());
    const decided = records.filter((d) => d.status === 'taken' || d.status === 'missed');
    return { label: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(day), total: decided.length, completed: decided.filter((d) => d.status === 'taken').length };
  });
  const activeMeds = patient.medications.filter((m) => m.active !== false).length;
  const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return <>
    <section className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <span className="hero-kicker"><span className="hero-kicker-dot"/> YOUR CONNECTED CARE SPACE</span>
        <h1>{greeting}, {patient.name.split(' ')[0]}<span className="hero-wave">✦</span></h1>
        <p>One calm place for medicines, appointments and the people who make care happen.</p>
        <div className="hero-date"><CalendarDays size={15}/>{dateLabel}</div>
        <div className="hero-actions"><button className="hero-primary" onClick={() => onNavigate('operations')}>Open care intelligence <ArrowUpRight size={16}/></button><button className="hero-secondary" onClick={onAddMedication}><Plus size={16}/> Add medication</button></div>
      </div>
      <div className="hero-visual" aria-label="Care overview illustration">
        <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/>
        <div className="hero-glow-card"><span className="hero-heart"><HeartPulse size={28}/></span><span className="hero-card-label">TODAY'S CARE PULSE</span><AdherenceRing value={adherence} compact/><small>{pending} awaiting · {missed} need follow-up</small></div>
        <div className="hero-float hero-float-top"><span><ShieldCheck size={14}/></span><div><strong>Care circle</strong><small>{patient.members.filter((m) => m.status === 'active').length} active members</small></div></div>
        <div className="hero-float hero-float-bottom"><span><Pill size={14}/></span><div><strong>{activeMeds} active medicines</strong><small>Shared medication plan</small></div></div>
      </div>
      <div className="hero-decoration hero-decoration-a"/><div className="hero-decoration hero-decoration-b"/>
    </section>

    <div className="metric-grid enhanced-metric-grid">
      <MetricCard label="Today's recorded adherence" value={adherence == null ? '—' : `${adherence}%`} detail={`${taken} taken · ${missed} missed`} icon={Activity} tone="teal" trend="Based on confirmed outcomes"/>
      <MetricCard label="Pending doses" value={String(pending)} detail="Awaiting confirmation" icon={Clock3} tone="amber" trend="Review today's routine"/>
      <MetricCard label="Care follow-ups" value={String(missed + stockAlerts.length + openTasks.length)} detail={`${missed} missed · ${stockAlerts.length} low stock · ${openTasks.length} tasks`} icon={AlertTriangle} tone="coral" trend={missed + stockAlerts.length + openTasks.length ? 'Items are ready to review' : 'No open items recorded'}/>
      <MetricCard label="Connected care circle" value={String(patient.members.filter((m) => m.status === 'active').length)} detail="Authorized members" icon={Users} tone="violet" trend={`${openTasks.length} shared tasks in progress`}/>
    </div>

    <div className="dashboard-grid dashboard-main-grid">
      <section className="panel schedule-panel redesigned-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR DAILY ROUTINE</span><h2>Medication timeline</h2><p className="panel-subtitle">A simple view of what is scheduled and what still needs confirmation.</p></div><button className="text-button" onClick={() => onNavigate('medications')}>All medicines <ChevronRight size={14}/></button></div>
        {doses.length ? <div className="dose-timeline">{doses.slice(0, 5).map((dose) => <DoseTimelineItem key={dose.id} dose={dose} onAction={onDose}/>)}</div> : <EmptyState icon={Pill} title="No doses scheduled today" description="Add a medication to create the first dose schedule." action={<button className="secondary-button small" onClick={onAddMedication}>Add medication</button>}/>}
        <div className="routine-footer"><span><CheckCircle2 size={15}/>{taken} confirmed</span><span><Clock3 size={15}/>{pending} waiting</span><span><AlertTriangle size={15}/>{missed} to review</span></div>
      </section>
      <section className="panel adherence-panel redesigned-panel"><div className="panel-heading"><div><span className="eyebrow">SEVEN-DAY VIEW</span><h2>Adherence trend</h2></div><span className="period-chip">This week</span></div>
        <div className="trend-summary"><div><strong>{week.filter((d) => d.total).length ? Math.round(week.reduce((sum, d) => sum + (d.total ? d.completed / d.total * 100 : 0), 0) / week.filter((d) => d.total).length) : '—'}{week.some((d) => d.total) ? '%' : ''}</strong><span>Average across days with records</span></div><span className="trend-icon"><TrendingUp size={18}/></span></div>
        <div className="bar-chart enhanced-week-chart">{week.map((d, i) => { const percent = d.total ? d.completed / d.total * 100 : 0; return <div className="chart-column" key={`${d.label}-${i}`}><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(4, percent)}%` }}/></div><span>{d.label}</span><small>{d.total ? `${d.completed}/${d.total}` : '—'}</small></div>; })}</div>
        <div className="chart-foot"><span className="chart-caption"><i className="legend-dot teal-dot"/> Confirmed outcomes only</span><button className="text-button" onClick={() => onNavigate('insights')}>Explore insights <ChevronRight size={13}/></button></div>
      </section>
    </div>

    <div className="dashboard-grid lower-grid dashboard-lower-grid">
      <section className="panel redesigned-panel"><div className="panel-heading"><div><span className="eyebrow">COMING UP</span><h2>Next appointment</h2></div><button className="icon-button" onClick={() => onNavigate('appointments')}><MoreHorizontal size={18}/></button></div>{appointment ? <div className="appointment-feature appointment-feature-rich"><div className="appointment-date"><strong>{new Date(appointment.scheduledAt).getDate()}</strong><span>{new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(appointment.scheduledAt))}</span></div><div className="appointment-info"><strong>{appointment.doctor}</strong><span>{appointment.specialty || 'Appointment'} · {formatTime(appointment.scheduledAt)}</span><small><CalendarClock size={13}/>{appointment.location || 'Location not added'}</small></div><StatusPill status="scheduled"/></div> : <EmptyState icon={CalendarDays} title="No upcoming appointment" description="Add a doctor visit so the care circle can prepare." action={<button className="secondary-button small" onClick={() => onNavigate('appointments')}>Manage appointments</button>}/>}</section>
      <section className="panel attention-panel redesigned-panel"><div className="panel-heading"><div><span className="eyebrow">THE NEXT BEST ACTIONS</span><h2>Care attention</h2></div><span className="count-badge">{missed + stockAlerts.length + openTasks.length}</span></div>{missed > 0 && <div className="attention-row"><span className="attention-icon coral"><AlertTriangle size={15}/></span><div><strong>{missed} dose{missed > 1 ? 's' : ''} need follow-up</strong><p>Check with the patient and record the outcome.</p></div><button onClick={() => onNavigate('medications')}><ChevronRight size={15}/></button></div>}{stockAlerts.slice(0, 2).map((m) => <div className="attention-row" key={m.id}><span className="attention-icon amber"><Pill size={15}/></span><div><strong>{m.name} stock is low</strong><p>{m.stock} {m.stockUnit || 'units'} recorded in stock.</p></div><button onClick={() => onNavigate('medications')}><ChevronRight size={15}/></button></div>)}{openTasks.slice(0, 2).map((t) => <div className="attention-row" key={t.id}><span className="attention-icon violet"><ClipboardCheck size={15}/></span><div><strong>{t.title}</strong><p>Assigned to {t.assignedTo || 'care circle'}.</p></div><button onClick={() => onNavigate('care-circle')}><ChevronRight size={15}/></button></div>)}{missed === 0 && stockAlerts.length === 0 && openTasks.length === 0 && <div className="all-clear"><CircleCheck size={18}/>No outstanding care items right now.</div>}<button className="attention-footer" onClick={() => onNavigate('operations')}>Review care intelligence <ArrowUpRight size={14}/></button></section>
    </div>

    <section className="panel activity-panel redesigned-panel"><div className="panel-heading"><div><span className="eyebrow">SHARED CARE HISTORY</span><h2>Recent activity</h2></div><button className="text-button" onClick={() => onNavigate('care-circle')}>Open care circle <ChevronRight size={14}/></button></div>{events.length ? <div className="activity-list">{events.slice(0, 5).map((event) => <div className="activity-row" key={event.id}><span className="activity-icon"><Activity size={15}/></span><div className="activity-copy"><strong>{event.title}</strong><p>{event.description}</p></div><div className="activity-meta"><span>{event.actor}</span><small>{formatDate(event.createdAt, true)}</small></div></div>)}</div> : <EmptyState icon={Activity} title="No activity recorded" description="Care actions will appear here as your circle uses NalamLink."/>}</section>
  </>;
}

function AdherenceRing({ value, compact = false }: { value: number | null; compact?: boolean }) {
  const circumference = 2 * Math.PI * 42;
  const percentage = value == null ? 0 : Math.max(0, Math.min(100, value));
  return <div className={`adherence-ring ${compact ? 'adherence-ring-compact' : ''}`}>
    <svg viewBox="0 0 100 100" role="img" aria-label={value == null ? 'No recorded adherence' : `${value}% recorded adherence`}><circle className="ring-track" cx="50" cy="50" r="42"/><circle className="ring-progress" cx="50" cy="50" r="42" strokeDasharray={`${circumference * percentage / 100} ${circumference}`} transform="rotate(-90 50 50)"/></svg>
    <div className="ring-center"><strong>{value == null ? '—' : `${value}%`}</strong><span>{value == null ? 'No data' : 'recorded'}</span></div>
  </div>;
}

function InsightsPage({ patient, analytics, onNavigate }: { patient: Patient; analytics: CareAnalytics | null; onNavigate: (page: string) => void }) {
  const [rangeDays, setRangeDays] = useState(7);
  const days = useMemo(() => Array.from({ length: rangeDays }, (_, index) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (rangeDays - 1 - index));
    const records = patient.doses.filter((dose) => new Date(dose.scheduledAt).toDateString() === day.toDateString());
    const dayTaken = records.filter((dose) => dose.status === 'taken').length;
    const dayMissed = records.filter((dose) => dose.status === 'missed').length;
    const shortMonth = new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(day);
    return {
      date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
      label: rangeDays === 7 ? new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(day) : `${day.getDate()} ${shortMonth}`,
      taken: dayTaken, missed: dayMissed,
      skipped: records.filter((dose) => dose.status === 'skipped').length,
      pending: records.filter((dose) => dose.status === 'pending').length,
      adherencePercent: dayTaken + dayMissed ? Math.round(dayTaken / (dayTaken + dayMissed) * 100) : null,
    };
  }), [patient.doses, rangeDays]);
  const hasTrendData = days.some((day) => day.adherencePercent != null);
  const taken = days.reduce((sum, day) => sum + day.taken, 0);
  const missed = days.reduce((sum, day) => sum + day.missed, 0);
  const skipped = days.reduce((sum, day) => sum + day.skipped, 0);
  const pending = days.reduce((sum, day) => sum + day.pending, 0);
  const activeMeds = patient.medications.filter((med) => med.active !== false);
  const lowStock = activeMeds.filter((med) => med.stock <= (med.refillAt ?? 7));
  const checkins = patient.checkins || [];
  const checkinGroups = [
    { label: 'Good', key: 'good', count: checkins.filter((item) => item.status === 'good').length },
    { label: 'Okay', key: 'okay', count: checkins.filter((item) => item.status === 'okay').length },
    { label: 'Tired', key: 'tired', count: checkins.filter((item) => item.status === 'tired').length },
    { label: 'Need help', key: 'need-help', count: checkins.filter((item) => item.status === 'need-help').length },
  ];
  const workload = analytics?.caregiverWorkload || [];
  const maxWorkload = Math.max(1, ...workload.map((member) => member.openTasks));
  const outcomeTotal = taken + missed + skipped + pending;
  const exportReport = () => {
    const rows = [
      ['section', 'name', 'detail', 'status', 'date'],
      ...patient.medications.map((med) => ['medication', med.name, `${med.strength || ''} · ${med.times?.join(', ') || ''} · Stock ${med.stock} ${med.stockUnit || 'units'}`, med.active === false ? 'inactive' : 'active', '']),
      ...patient.doses.map((dose) => ['dose', dose.medicationName, dose.strength || '', dose.status, dose.scheduledAt]),
      ...patient.appointments.map((appt) => ['appointment', appt.doctor, appt.specialty || '', appt.status, appt.scheduledAt]),
      ...patient.tasks.map((task) => ['task', task.title, task.assignedTo || '', task.status, task.dueAt || '']),
      ...checkins.map((item) => ['check-in', item.userName, item.note || '', item.status, item.createdAt]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `nalamlink-care-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const trendPoints = days.map((day, index) => {
    const pct = day.adherencePercent ?? 0;
    const x = days.length <= 1 ? 300 : 32 + index * (536 / (days.length - 1));
    const y = 176 - (pct / 100) * 142;
    return `${x},${y}`;
  }).join(' ');
  return <>
    <PageHeading eyebrow="CARE ANALYTICS STUDIO" title="Insights & reports" subtitle="Understand patterns in the records your care circle has captured, then export a shareable operational report." action={<button className="primary-button" onClick={exportReport}><Download size={16}/> Export CSV report</button>}/>
    <section className="insights-hero">
      <div className="insights-hero-copy"><span className="hero-kicker"><span className="hero-kicker-dot"/> RECENT CARE SNAPSHOT</span><h2>Small signals.<br/><em>Better coordination.</em></h2><p>These views summarize recorded activity only. They are not clinical predictions or a measure of health.</p><div className="insights-hero-meta"><span><CalendarDays size={14}/> Last {rangeDays} days</span><span><Users size={14}/> {patient.members.filter((m) => m.status === 'active').length} active care-circle members</span></div></div>
      <div className="insights-hero-ring"><span>RECORDED ADHERENCE TODAY</span><AdherenceRing value={analytics?.today.adherencePercent ?? null}/><small>{analytics?.today.taken || 0} confirmed · {analytics?.today.missed || 0} missed</small></div>
      <div className="insights-hero-orb"/>
    </section>
    <div className="insight-stat-grid">
      <div className="insight-stat"><span className="insight-stat-icon stat-teal"><Pill size={18}/></span><div><small>Active medicines</small><strong>{activeMeds.length}</strong><span>Current records</span></div></div>
      <div className="insight-stat"><span className="insight-stat-icon stat-blue"><CheckCircle2 size={18}/></span><div><small>Confirmed doses</small><strong>{taken}</strong><span>Past {rangeDays} days</span></div></div>
      <div className="insight-stat"><span className="insight-stat-icon stat-coral"><AlertTriangle size={18}/></span><div><small>Missed doses</small><strong>{missed}</strong><span>Past {rangeDays} days</span></div></div>
      <div className="insight-stat"><span className="insight-stat-icon stat-violet"><ClipboardList size={18}/></span><div><small>Open tasks</small><strong>{analytics?.openTaskCount ?? patient.tasks.filter((task) => task.status !== 'completed').length}</strong><span>Shared responsibilities</span></div></div>
    </div>
    <div className="insights-grid">
      <section className="panel insight-panel insight-trend-panel"><div className="panel-heading"><div><span className="eyebrow">CONSISTENCY OVER TIME</span><h2>{rangeDays}-day adherence trend</h2><p className="panel-subtitle">A day-by-day view of doses with a recorded outcome.</p></div><div className="chart-range-controls">{[7, 30, 90].map((range) => <button key={range} className={rangeDays === range ? 'active' : ''} onClick={() => setRangeDays(range)}>{range}D</button>)}</div></div>
        {hasTrendData ? <div className="line-chart-wrap"><svg viewBox="0 0 600 220" role="img" aria-label="Seven-day recorded dose adherence trend"><defs><linearGradient id="insightArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#45b99a" stopOpacity=".25"/><stop offset="100%" stopColor="#45b99a" stopOpacity="0"/></linearGradient></defs>{[34, 105, 176].map((y) => <line key={y} x1="28" y1={y} x2="572" y2={y} className="chart-gridline"/>)}<polygon points={`28,176 ${trendPoints} 572,176`} fill="url(#insightArea)"/><polyline points={trendPoints} fill="none" className="trend-line-svg"/>{days.map((day, index) => { const pct = day.adherencePercent ?? 0; const x = days.length <= 1 ? 300 : 32 + index * (536 / (days.length - 1)); const y = 176 - (pct / 100) * 142; const labelStep = Math.max(1, Math.ceil(days.length / 7)); return <g key={day.date}><circle cx={x} cy={y} r={rangeDays === 7 ? 5 : 2.8} className="trend-point"/><title>{day.label}: {day.adherencePercent == null ? 'No recorded outcomes' : `${day.adherencePercent}%`}</title>{(index % labelStep === 0 || index === days.length - 1) && <text x={x} y="205" textAnchor="middle" className="chart-axis-label">{day.label}</text>}</g>; })}<text x="5" y="38" className="chart-axis-label">100%</text><text x="8" y="109" className="chart-axis-label">50%</text><text x="15" y="180" className="chart-axis-label">0%</text></svg></div> : <EmptyState icon={TrendingUp} title="Trend data will appear here" description="Dose outcomes from the care schedule will populate this chart."/>}
        <div className="chart-foot"><span className="chart-caption"><i className="legend-dot teal-dot"/> Confirmed doses / recorded outcomes</span><button className="text-button" onClick={() => onNavigate('medications')}>Review medication records <ChevronRight size={13}/></button></div>
      </section>
      <section className="panel insight-panel"><div className="panel-heading"><div><span className="eyebrow">DOSE OUTCOMES</span><h2>Recorded activity mix</h2></div><span className="period-chip">{rangeDays} days</span></div>
        <div className="outcome-layout"><div className="outcome-donut" style={{ background: `conic-gradient(#198b78 0 ${outcomeTotal ? taken / outcomeTotal * 100 : 0}%, #df9877 ${outcomeTotal ? taken / outcomeTotal * 100 : 0}% ${outcomeTotal ? (taken + missed) / outcomeTotal * 100 : 0}%, #9c8bc7 ${outcomeTotal ? (taken + missed) / outcomeTotal * 100 : 0}% ${outcomeTotal ? (taken + missed + skipped) / outcomeTotal * 100 : 0}%, #e5ece8 ${outcomeTotal ? (taken + missed + skipped) / outcomeTotal * 100 : 0}% 100%)` }}><div><strong>{outcomeTotal}</strong><span>events</span></div></div><div className="outcome-legend"><div><i className="outcome-taken"/><span>Taken</span><strong>{taken}</strong></div><div><i className="outcome-missed"/><span>Missed</span><strong>{missed}</strong></div><div><i className="outcome-skipped"/><span>Skipped</span><strong>{skipped}</strong></div><div><i className="outcome-pending"/><span>Pending</span><strong>{pending}</strong></div></div></div>
        <p className="insight-footnote">Pending and skipped entries are shown separately and are not counted as confirmed doses.</p>
      </section>
      <section className="panel insight-panel"><div className="panel-heading"><div><span className="eyebrow">INVENTORY WATCH</span><h2>Medication stock</h2><p className="panel-subtitle">Based on stock values entered in each medication record.</p></div><button className="text-button" onClick={() => onNavigate('medications')}>Manage <ChevronRight size={13}/></button></div>
        {activeMeds.length ? <div className="stock-insight-list">{activeMeds.map((med) => { const threshold = med.refillAt ?? 7; const ratio = Math.min(100, Math.max(0, med.stock / Math.max(threshold * 3, 1) * 100)); const low = med.stock <= threshold; return <div className="stock-insight-row" key={med.id}><div className="stock-insight-heading"><strong>{med.name}</strong><span className={low ? 'stock-low-label' : ''}>{med.stock} {med.stockUnit || 'units'}</span></div><div className="stock-track"><span className={low ? 'stock-fill stock-fill-low' : 'stock-fill'} style={{ width: `${ratio}%` }}/></div><small>{low ? `At or below refill threshold (${threshold})` : `Refill reminder at ${threshold} ${med.stockUnit || 'units'}`}</small></div>; })}</div> : <EmptyState icon={Pill} title="No active medication records" description="Add a prescription record to track stock."/>}
        {lowStock.length > 0 && <div className="insight-callout"><AlertTriangle size={15}/><span>{lowStock.length} medicine record{lowStock.length === 1 ? '' : 's'} at or below the configured refill threshold.</span></div>}
      </section>
      <section className="panel insight-panel"><div className="panel-heading"><div><span className="eyebrow">CARE-CIRCLE CAPACITY</span><h2>Open task distribution</h2><p className="panel-subtitle">Tasks grouped by assigned member, where assignments are recorded.</p></div><span className="period-chip">By member</span></div>
        {workload.length ? <div className="workload-list">{workload.map((member) => <div className="workload-row" key={member.memberId}><div className="workload-name"><Avatar name={member.name} color="teal" size="sm"/><div><strong>{member.name}</strong><small>{member.role}</small></div><b>{member.openTasks}</b></div><div className="workload-track"><span style={{ width: `${member.openTasks / maxWorkload * 100}%` }}/></div></div>)}</div> : <div className="empty-insight"><Users size={20}/><strong>No assigned work to compare</strong><small>Assign care tasks to members to see the distribution.</small></div>}
        <div className="insight-mini-link"><button className="text-button" onClick={() => onNavigate('care-circle')}>Manage shared tasks <ChevronRight size={13}/></button></div>
      </section>
      <section className="panel insight-panel"><div className="panel-heading"><div><span className="eyebrow">PATIENT-REPORTED</span><h2>Wellbeing check-ins</h2><p className="panel-subtitle">A summary of recent self-reported check-ins.</p></div><span className="period-chip">{checkins.length} total</span></div>
        {checkins.length ? <><div className="checkin-bars">{checkinGroups.map((group) => <div key={group.key} className="checkin-bar-row"><span>{group.label}</span><div className="checkin-bar-track"><i className={`checkin-bar-fill checkin-${group.key}`} style={{ width: `${group.count / Math.max(1, checkins.length) * 100}%` }}/></div><strong>{group.count}</strong></div>)}</div><div className="recent-checkin-strip">{checkins.slice(0, 3).map((item) => <div key={item.id}><span className={`checkin-status status-${item.status}`}>{item.status.replace('-', ' ')}</span><small>{formatDate(item.createdAt, true)}</small></div>)}</div></> : <EmptyState icon={HeartHandshake} title="No check-ins captured yet" description="Use Care Intelligence to record a daily wellbeing check-in."/>}
      </section>
      <section className="panel insight-panel report-panel"><div className="report-icon"><FileText size={23}/></div><span className="eyebrow">FAMILY-READY REPORT</span><h2>Take the care picture with you.</h2><p>Export medication records, dose outcomes, appointments, care tasks and check-ins as a CSV spreadsheet.</p><button className="primary-button" onClick={exportReport}><Download size={15}/> Download care report</button><small>Includes only information currently recorded in this workspace. Store and share it carefully.</small></section>
    </div>
    <div className="ops-disclaimer"><ShieldCheck size={15}/><span>Insights are descriptive summaries of entered records. They do not diagnose, predict health outcomes or replace advice from a qualified clinician.</span></div>
  </>;
}

function MetricCard({ label, value, detail, icon: Icon, tone, trend }: { label: string; value: string; detail: string; icon: typeof Activity; tone: string; trend: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17}/></span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div><div className="metric-trend"><span className="trend-line"/>{trend}</div></div>;
}

function DoseTimelineItem({ dose, onAction }: { dose: Dose; onAction: (dose: Dose, status: 'taken' | 'skipped') => void }) {
  return <div className={`dose-item dose-${dose.status}`}><div className="dose-time"><strong>{formatTime(dose.scheduledAt)}</strong><span className="dose-line"/></div><div className="dose-body"><div className="dose-icon"><Pill size={17}/></div><div className="dose-info"><strong>{dose.medicationName}</strong><span>{dose.strength || 'Medication'}{dose.instructions ? ` · ${dose.instructions}` : ''}</span></div><StatusPill status={dose.status}/>{['pending', 'missed'].includes(dose.status) && <div className="dose-actions"><button className="done-button" onClick={() => onAction(dose, 'taken')} title={dose.status === 'missed' ? 'Record later confirmation after checking with the patient' : 'Mark taken'}><Check size={15}/></button><button className="skip-button" onClick={() => onAction(dose, 'skipped')} title="Record as skipped">{dose.status === 'missed' ? 'Resolve' : 'Skip'}</button></div>}</div></div>;
}

function MedicationPage({ patient, todayDoses, onAdd, onEdit, onDose, onDelete, canEdit }: { patient: Patient; todayDoses: Dose[]; onAdd: () => void; onEdit: (med: Medication) => void; onDose: (dose: Dose, status: 'taken' | 'skipped') => void; onDelete: (med: Medication) => void; canEdit: boolean }) {
  return <><PageHeading eyebrow="MEDICATION MANAGEMENT" title="Medication center" subtitle="Keep schedules, dose confirmations and stock information together." action={canEdit && <button className="primary-button" onClick={onAdd}><Plus size={16}/> Add medication</button>}/>
    <div className="medication-summary"><div><span className="summary-icon teal"><Pill size={18}/></span><div><strong>{patient.medications.filter((m) => m.active !== false).length}</strong><span>Active medicines</span></div></div><div><span className="summary-icon amber"><Clock3 size={18}/></span><div><strong>{todayDoses.filter((d) => d.status === 'pending').length}</strong><span>Pending today</span></div></div><div><span className="summary-icon coral"><AlertTriangle size={18}/></span><div><strong>{todayDoses.filter((d) => d.status === 'missed').length}</strong><span>Need follow-up</span></div></div></div>
    <section className="panel medication-list-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVE PRESCRIPTIONS</span><h2>Medication list</h2></div><span className="period-chip">{patient.medications.length} records</span></div>{patient.medications.length ? <div className="medication-list">{patient.medications.map((med) => <div className="medication-card" key={med.id}><span className="medicine-illustration"><Pill size={21}/></span><div className="medication-main"><div className="medication-title"><strong>{med.name}</strong><span>{med.strength}</span></div><p>{med.instructions || 'Follow the instructions provided by the prescriber.'}</p><div className="medication-meta"><span><Clock3 size={13}/>{med.times?.join(' · ') || 'No times set'}</span><span><CalendarDays size={13}/>{med.frequency}</span><span><Stethoscope size={13}/>{med.prescriber || 'Prescriber not set'}</span></div></div><div className="stock-indicator"><strong className={med.stock <= (med.refillAt || 7) ? 'stock-low' : ''}>{med.stock}</strong><span>{med.stockUnit || 'units'} left</span></div>{canEdit && <><button className="icon-button" onClick={() => onEdit(med)} title="Edit medication"><Pencil size={15}/></button><button className="icon-button delete-med" onClick={() => onDelete(med)} title="Delete medication"><X size={16}/></button></>}</div>)}</div> : <EmptyState icon={Pill} title="No medications added" description="Create the first medication record to generate an individual dose timeline." action={canEdit && <button className="primary-button" onClick={onAdd}>Add medication</button>}/>}</section>
    <section className="panel dose-history-panel"><div className="panel-heading"><div><span className="eyebrow">DOSE CONFIRMATION</span><h2>Today's dose timeline</h2></div><span className="period-chip">{formatDate(new Date().toISOString())}</span></div>{todayDoses.length ? <div className="dose-timeline">{todayDoses.map((d) => <DoseTimelineItem key={d.id} dose={d} onAction={onDose}/>)}</div> : <EmptyState icon={Clock3} title="No dose events" description="Dose events are generated when medication schedules are saved."/>}</section>
  </>;
}

function CareCirclePage({ patient, canEdit, canManageMembers, onRevoke, onInvite, onAddTask, onFinishTask }: { patient: Patient; canEdit: boolean; canManageMembers: boolean; onRevoke: (member: Patient['members'][number]) => void; onInvite: () => void; onAddTask: () => void; onFinishTask: (task: CareTask) => void }) {
  return <><PageHeading eyebrow="COLLABORATIVE CARE" title="Your care circle" subtitle="The people, responsibilities and shared actions supporting this care plan." action={canEdit && <button className="primary-button" onClick={onInvite}><Plus size={16}/> Invite member</button>}/>
    <div className="circle-overview"><div className="circle-patient"><Avatar name={patient.name} color="sage" size="lg"/><div><span className="eyebrow">PATIENT AT THE CENTER</span><h2>{patient.name}</h2><p>{patient.age} years · {patient.language || 'Language not set'} · {patient.city || 'Location not set'}</p></div><span className="patient-status"><span className="live-dot"/> Care profile active</span></div><div className="circle-member-avatars">{patient.members.slice(0, 5).map((m) => <Avatar key={m.id} name={m.name} color={m.role === 'caregiver' ? 'lavender' : m.role === 'clinician' ? 'blue' : 'teal'} size="md"/>)}<span>{patient.members.length} members</span></div></div>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">AUTHORIZED MEMBERS</span><h2>People in this circle</h2></div><span className="period-chip">{patient.members.length} members</span></div><div className="member-grid">{patient.members.map((m) => <div className="member-card" key={m.id}><Avatar name={m.name} color={m.role === 'caregiver' ? 'lavender' : m.role === 'clinician' ? 'blue' : 'teal'} size="lg"/><div className="member-info"><strong>{m.name}</strong><span>{m.email}</span><small>{ROLE_LABELS[m.role] || m.role}</small></div><StatusPill status={m.status}/>{canManageMembers && m.role !== 'patient' && m.status === 'active' && <button className="icon-button member-remove" title={`Revoke ${m.name}'s access`} onClick={() => onRevoke(m)}><X size={15}/></button>}</div>)}</div></section>
    <section className="panel tasks-panel"><div className="panel-heading"><div><span className="eyebrow">SHARED RESPONSIBILITIES</span><h2>Care tasks</h2></div>{canEdit && <button className="secondary-button small" onClick={onAddTask}><Plus size={14}/> Add task</button>}</div>{patient.tasks.length ? <div className="task-list">{[...patient.tasks].sort((a,b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0)).map((task) => <div className="task-row" key={task.id}><span className={classNames('task-check', task.status === 'completed' && 'checked')}>{task.status === 'completed' && <Check size={14}/>}</span><div className="task-copy"><strong className={task.status === 'completed' ? 'task-complete' : ''}>{task.title}</strong><span>Assigned to {task.assignedTo || 'care circle'} · {task.dueAt ? formatDate(task.dueAt, true) : 'No due date'}</span></div><span className={`priority-pill priority-${task.priority || 'medium'}`}>{task.priority || 'medium'}</span>{task.status !== 'completed' && canEdit && <button className="secondary-button tiny-button" onClick={() => onFinishTask(task)}>Mark done</button>}{task.status === 'completed' && <StatusPill status="completed"/>}</div>)}</div> : <EmptyState icon={ClipboardCheck} title="No shared tasks yet" description="Create responsibilities so everyone knows who is following up." action={canEdit && <button className="secondary-button small" onClick={onAddTask}>Create first task</button>}/>}</section>
    <div className="privacy-note"><ShieldCheck size={18}/><div><strong>Patient-centered access</strong><p>Only active care-circle members should access this profile. Review permissions regularly and remove access when it is no longer needed.</p></div></div>
  </>;
}

function AppointmentsPage({ patient, onAdd, canEdit, onDelete, onPrepare }: { patient: Patient; onAdd: () => void; canEdit: boolean; onDelete: (a: Appointment) => void; onPrepare: (a: Appointment) => Promise<VisitBrief> }) {
  const appointments = [...patient.appointments].sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const [brief, setBrief] = useState<VisitBrief | null>(null);
  const [briefingId, setBriefingId] = useState('');
  const [briefError, setBriefError] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const visibleAppointments = appointments.filter((appointment) => showCompleted || appointment.status !== 'completed');
  async function prepare(appointment: Appointment) {
    setBriefingId(appointment.id); setBriefError('');
    try { setBrief(await onPrepare(appointment)); }
    catch (error: any) { setBriefError(error.message || 'Could not prepare the visit brief.'); }
    finally { setBriefingId(''); }
  }
  function downloadBrief() {
    if (!brief) return;
    const lines = [
      'NALAMLINK AI — DOCTOR VISIT BRIEF',
      `Patient: ${brief.patient.name} · Age: ${brief.patient.age ?? 'Not recorded'}`,
      `Appointment: ${brief.appointment.doctor} · ${brief.appointment.specialty || 'Medical visit'}`,
      `When: ${formatDate(brief.appointment.scheduledAt, true)} · ${brief.appointment.location || 'Location not recorded'}`,
      '', 'CURRENT MEDICATION RECORDS',
      ...brief.medicationReview.map((item) => `- ${item.name} ${item.strength} · ${item.frequency} · ${item.times.join(', ')} · ${item.instructions}`),
      '', 'LAST 7 DAYS — RECORDED DOSE OUTCOMES',
      `Taken: ${brief.doseReview.taken}; missed: ${brief.doseReview.missed}; skipped: ${brief.doseReview.skipped}; pending: ${brief.doseReview.pending}; adherence: ${brief.doseReview.adherencePercent == null ? 'Not enough confirmed outcomes' : `${brief.doseReview.adherencePercent}%`}`,
      '', 'OPEN CARE TASKS',
      ...brief.openCareTasks.map((item) => `- ${item.title} · ${item.assignedTo} · ${item.priority}`),
      '', 'RECENT PATIENT-REPORTED CHECK-INS',
      ...brief.recentPatientCheckins.map((item) => `- ${item.status} · ${item.note} · ${formatDate(item.createdAt, true)}`),
      '', 'RECENT CARE EVENTS',
      ...brief.recentCareEvents.map((item) => `- ${item.title}: ${item.description} (${item.actor})`),
      '', brief.disclaimer, `Prepared: ${formatDate(brief.generatedAt, true)}`
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `nalamlink-visit-brief-${brief.appointment.id}.txt`; link.click();
    URL.revokeObjectURL(url);
  }
  return <><PageHeading eyebrow="HEALTHCARE ROUTINES" title="Appointments" subtitle="Keep doctor visits, preparation notes and follow-ups visible to the care circle." action={canEdit && <button className="primary-button" onClick={onAdd}><Plus size={16}/> Add appointment</button>}/>
    <div className="appointment-banner"><span className="banner-icon"><CalendarDays size={22}/></span><div><strong>One shared appointment calendar</strong><p>Appointments added here become visible to authorized care-circle members.</p></div></div>
    {briefError && <div className="inline-error"><AlertCircle size={15}/>{briefError}</div>}
    {brief && <section className="panel visit-brief-panel"><div className="panel-heading"><div><span className="eyebrow">MITRA VISIT PREPARATION</span><h2>Doctor visit brief · {brief.patient.name}</h2></div><div className="visit-brief-actions"><button className="secondary-button small" onClick={downloadBrief}><Download size={14}/> Download brief</button><button className="icon-button" aria-label="Close visit brief" onClick={() => setBrief(null)}><X size={16}/></button></div></div><p className="muted">{brief.appointment.doctor} · {formatDate(brief.appointment.scheduledAt, true)} · {brief.appointment.location || 'Location not recorded'}</p><div className="visit-brief-stats"><div><strong>{brief.doseReview.taken}</strong><span>Taken</span></div><div><strong>{brief.doseReview.missed}</strong><span>Missed</span></div><div><strong>{brief.doseReview.skipped}</strong><span>Skipped</span></div><div><strong>{brief.doseReview.pending}</strong><span>Pending</span></div><div><strong>{brief.doseReview.adherencePercent == null ? '—' : `${brief.doseReview.adherencePercent}%`}</strong><span>Recorded adherence</span></div></div><div className="visit-brief-grid"><div><h3>Current medication list</h3>{brief.medicationReview.length ? brief.medicationReview.map((item, index) => <p key={`${item.name}-${index}`}><strong>{item.name} {item.strength}</strong><small>{item.frequency} · {item.times.join(', ')} · {item.instructions || 'No instructions recorded'}</small></p>) : <p className="muted">No active medication records.</p>}</div><div><h3>Topics to review</h3>{brief.doseReview.unresolvedMisses.map((item, index) => <p key={`${item.medicationName}-${index}`}>Unresolved: {item.medicationName} · {formatDate(item.scheduledAt, true)}</p>)}{brief.openCareTasks.map((item, index) => <p key={`${item.title}-${index}`}>{item.title} · {item.assignedTo}</p>)}{!brief.doseReview.unresolvedMisses.length && !brief.openCareTasks.length && <p className="muted">No unresolved missed doses or open tasks in the current records.</p>}</div></div><p className="visit-brief-disclaimer"><ShieldCheck size={14}/>{brief.disclaimer}</p></section>}
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">VISIT SCHEDULE</span><h2>All appointments</h2></div><div className="visit-brief-actions"><label className="muted small"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)}/> Include completed</label><span className="period-chip">{visibleAppointments.length} records</span></div></div>{visibleAppointments.length ? <div className="appointment-list">{visibleAppointments.map((a) => <div className="appointment-card" key={a.id}><div className="appointment-date large-date"><strong>{new Date(a.scheduledAt).getDate()}</strong><span>{new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(a.scheduledAt))}</span></div><div className="appointment-main"><div className="appointment-title"><strong>{a.doctor}</strong><StatusPill status={a.status}/></div><span>{a.specialty || 'Medical appointment'} · {formatTime(a.scheduledAt)}</span><p><MapPinIcon/> {a.location || 'Location not provided'}</p>{a.reason && <small>Reason: {a.reason}</small>}{a.notes && <small>Notes: {a.notes}</small>}<div className="appointment-actions"><button className="secondary-button tiny-button" onClick={() => prepare(a)} disabled={briefingId === a.id}><FileText size={14}/>{briefingId === a.id ? 'Preparing…' : 'Prepare visit brief'}</button>{canEdit && <button className="icon-button" onClick={() => onDelete(a)} title="Delete appointment"><X size={16}/></button>}</div></div></div>)}</div> : <EmptyState icon={CalendarDays} title="No appointments recorded" description="Add the next doctor visit to keep everyone aligned." action={canEdit && <button className="primary-button" onClick={onAdd}>Schedule appointment</button>}/>}</section>
  </>;
}
function MapPinIcon() { return <span className="inline-map-pin">⌖</span>; }

function MitraPage({ question, setQuestion, answer, source, busy, onAsk, onSpeak, ocrText, onScan }: { question: string; setQuestion: (v: string) => void; answer: string; source: string; busy: boolean; onAsk: (e: FormEvent) => void; onSpeak: () => void; ocrText: string; onScan: (file?: File) => void }) {
  const suggestions = ["Summarize today's medication status", "What needs follow-up in the care circle?", "Prepare a brief for the next doctor appointment"];
  return <><PageHeading eyebrow="CARE INTELLIGENCE" title="Meet Mitra AI" subtitle="A careful assistant that explains recorded care information and helps coordinate the next step." action={<span className="ai-status"><span className="live-dot"/> Assistant ready</span>}/>
    <div className="ai-layout"><section className="panel ai-chat-panel"><div className="ai-chat-header"><span className="mitra-avatar"><Sparkles size={21}/></span><div><strong>Mitra</strong><span>Care coordination assistant · {source === 'configured-openai-compatible-provider' ? 'AI provider connected' : 'Grounded assistant'}</span></div><span className="ai-shield"><ShieldCheck size={15}/> Safety-first</span></div><div className="chat-thread"><div className="chat-message assistant-message"><span className="chat-avatar"><Sparkles size={15}/></span><div><p>Vanakkam! I'm Mitra. I can help you understand the care records in this workspace, prepare summaries and organize follow-up tasks.</p><p className="muted">I don't diagnose or prescribe, and I won't change medication instructions.</p></div></div>{answer && <div className="chat-message assistant-message"><span className="chat-avatar"><Sparkles size={15}/></span><div><p>{answer}</p><small className="source-label">Source: {source === 'configured-openai-compatible-provider' ? 'Configured AI provider · Authorized care data' : source === 'rules-based-grounded' ? 'Recorded application data · Grounded summary' : 'Assistant response'}</small><button className="speak-button" onClick={onSpeak}><Volume2 size={14}/> Read aloud</button></div></div>}{busy && <div className="chat-message assistant-message"><span className="chat-avatar"><Sparkles size={15}/></span><div className="typing-dots"><i/><i/><i/></div></div>}</div><div className="suggestion-chips">{suggestions.map((s) => <button key={s} onClick={() => setQuestion(s)}>{s}</button>)}</div><form className="chat-compose" onSubmit={onAsk}><textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} placeholder="Ask Mitra about the recorded care plan…"/><div className="compose-footer"><span><ShieldCheck size={13}/> Uses care records only</span><button className="primary-button" disabled={busy || !question.trim()}><Send size={15}/> Ask Mitra</button></div></form></section>
      <aside className="ai-side-column"><div className="panel ai-capability-card"><span className="eyebrow">WHAT MITRA CAN DO</span><div className="capability-row"><span className="capability-icon"><ClipboardCheck size={16}/></span><div><strong>Care summaries</strong><p>Explain recorded dose and task status.</p></div></div><div className="capability-row"><span className="capability-icon"><CalendarDays size={16}/></span><div><strong>Visit preparation</strong><p>Organize notes for the next appointment.</p></div></div><div className="capability-row"><span className="capability-icon"><Languages size={16}/></span><div><strong>Voice read-out</strong><p>Read answers aloud in supported browser voices.</p></div></div></div>
        <div className="panel ocr-card"><div className="ocr-card-heading"><span className="ocr-icon"><Camera size={17}/></span><div><strong>Prescription reader</strong><p>Extract text for manual verification.</p></div></div><label className="upload-drop"><input type="file" accept=".png,.jpg,.jpeg,.webp,.tif,.tiff,image/png,image/jpeg,image/webp,image/tiff" onChange={(e) => onScan(e.target.files?.[0])}/><span><Plus size={17}/></span><strong>Upload prescription image</strong><small>PNG or JPG · Max 8 MB</small></label>{ocrText && <div className="ocr-result"><strong>Extracted text — review required</strong><pre>{ocrText}</pre></div>}<p className="tiny-disclaimer">OCR may misread medication names or strengths. Never create a schedule without checking the original prescription.</p></div></aside></div>
    <div className="ai-disclaimer"><AlertCircle size={16}/><span>Mitra provides care coordination support, not medical advice. Always confirm medication decisions with the prescribing clinician.</span></div>
  </>;
}

function PassportPage({ patient, onDownload }: { patient: Patient; onDownload: () => void }) {
  return <><PageHeading eyebrow="PORTABLE CARE RECORD" title="Care passport" subtitle="A clear, exportable snapshot of the information recorded by this care circle." action={<button className="primary-button" onClick={onDownload}><Download size={16}/> Export care passport</button>}/>
    <div className="passport-cover"><div className="passport-cover-top"><span className="passport-logo"><HeartPulse size={22}/></span><span className="passport-label">NALAMLINK · CARE PASSPORT</span></div><h2>{patient.name}</h2><p>{patient.age} years · {patient.language || 'Language not set'} · {patient.city || 'Location not set'}</p><div className="passport-cover-meta"><div><span>CARE CIRCLE</span><strong>{patient.members.length} members</strong></div><div><span>ACTIVE MEDICINES</span><strong>{patient.medications.filter((m) => m.active !== false).length} records</strong></div><div><span>APPOINTMENTS</span><strong>{patient.appointments.length} records</strong></div></div></div>
    <div className="passport-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">CURRENT PLAN</span><h2>Medication overview</h2></div></div>{patient.medications.map((m) => <div className="passport-line" key={m.id}><span className="medicine-illustration small-med"><Pill size={16}/></span><div><strong>{m.name} {m.strength}</strong><small>{m.frequency} · {m.times.join(', ')}</small></div></div>)}</section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">CARE CONTACTS</span><h2>Authorized members</h2></div></div>{patient.members.map((m) => <div className="passport-line" key={m.id}><Avatar name={m.name} color="teal" size="sm"/><div><strong>{m.name}</strong><small>{ROLE_LABELS[m.role] || m.role} · {m.email}</small></div></div>)}</section></div>
    <div className="privacy-note"><ShieldCheck size={18}/><div><strong>Share carefully</strong><p>This export contains personal health-related information. Share it only with authorized people and use your clinician's official records for medical decisions.</p></div></div>
  </>;
}
