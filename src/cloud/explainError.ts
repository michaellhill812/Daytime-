/**
 * Turn a Supabase/PostgREST failure into a sentence naming the likely cause.
 *
 * These arrive as codes like PGRST202 or 42P01, which say nothing about what to
 * do. Nearly all of them at this stage mean one of three things: the schema was
 * never applied, the deployment is pointed somewhere wrong, or the session
 * expired. Say which, and where to fix it.
 */
export function explainSupabaseError(err: unknown): string {
  const error = err as { code?: string; message?: string; status?: number } | null;
  const code = error?.code ?? '';
  const message = error?.message ?? String(err ?? 'Unknown error');
  const lower = message.toLowerCase();

  // The schema never ran, or ran against a different project.
  if (code === 'PGRST202' || code === '42883' || lower.includes('could not find the function')) {
    return 'The database is missing its setup. Run supabase/schema.sql in the Supabase SQL editor, then reload. (Nothing was found named ensure_workspace.)';
  }
  if (code === '42P01' || lower.includes('does not exist')) {
    return 'The database is missing its tables. Run supabase/schema.sql in the Supabase SQL editor, then reload.';
  }

  // Applied, but the app cannot use it.
  if (code === '42501' || lower.includes('permission denied')) {
    return 'Signed in, but not allowed to read the workspace. Re-run supabase/schema.sql — the grants near the end of the file are what is missing.';
  }

  // Wrong credentials, or a Vercel env var that was never redeployed.
  if (error?.status === 401 || lower.includes('invalid api key') || lower.includes('jwt')) {
    return 'The API key was rejected. Check VITE_SUPABASE_ANON_KEY in Vercel matches the publishable key in Supabase, and redeploy — changing an env var does not rebuild on its own.';
  }

  // Wrong project URL, project paused, or genuinely offline.
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return 'Could not reach the database at all. Check VITE_SUPABASE_URL is the exact Project URL from Settings → Data API, and that the Supabase project is not paused.';
  }

  return message;
}
