import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export async function initializeSupabase(): Promise<SupabaseClient | null> {
  if (client) return client;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const response = await fetch('/api/public-config');
      const config = await response.json();
      const supabase = config.supabaseConfig;
      if (!supabase?.url || !supabase?.anonKey) return null;
      client = createClient(supabase.url, supabase.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      return client;
    } catch {
      return null;
    }
  })();
  return initPromise;
}

export function onAuthStateChanged(auth: SupabaseClient, callback: (user: any) => void) {
  const { data } = auth.auth.onAuthStateChange((_event, session) => {
    callback(session ? { ...session.user, accessToken: session.access_token } : null);
  });
  auth.auth.getSession().then(({ data: sessionData }) => {
    const session = sessionData.session;
    callback(session ? { ...session.user, accessToken: session.access_token } : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmailAndPassword(auth: SupabaseClient, email: string, password: string) {
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: data.user, session: data.session };
}

export async function createUserWithEmailAndPassword(auth: SupabaseClient, email: string, password: string, displayName = '') {
  const { data, error } = await auth.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
  if (error) throw error;
  if (!data.user) throw new Error('Account creation did not return a user.');
  return { user: data.user, session: data.session };
}

export async function signOut(auth: SupabaseClient) {
  const { error } = await auth.auth.signOut();
  if (error) throw error;
}

export type Auth = SupabaseClient;
