/**
 * Cloud is opt-in through build-time env vars. With neither set the app runs
 * exactly as before — everything in localStorage, no auth, no network — which
 * is what keeps local development and the single-file embed working.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = Boolean(url && anonKey);

export function cloudCredentials(): { url: string; anonKey: string } {
  if (!url || !anonKey) throw new Error('Supabase is not configured');
  return { url, anonKey };
}
