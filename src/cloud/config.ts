/**
 * Cloud is opt-in through build-time env vars. With neither set the app runs
 * exactly as before — everything in localStorage, no auth, no network — which
 * is what keeps local development and the single-file embed working.
 */
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/**
 * A mistyped project URL otherwise fails as an opaque network error at the
 * first request, long after the cause. Supabase project refs are 20 characters,
 * so a short one is nearly always a copy that dropped a character or two.
 */
export function describeUrlProblem(value: string | undefined): string | null {
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return `VITE_SUPABASE_URL is not a URL: "${value}". It should look like https://<project-ref>.supabase.co`;
  }

  if (parsed.protocol !== 'https:') return 'VITE_SUPABASE_URL must start with https://';

  const match = /^([a-z0-9]+)\.supabase\.(co|in)$/.exec(parsed.hostname);
  if (!match) return null; // self-hosted or a custom domain — not ours to judge

  const ref = match[1]!;
  if (ref.length !== 20) {
    return `The project ref in VITE_SUPABASE_URL is ${ref.length} characters ("${ref}"), but Supabase refs are 20. Re-copy the Project URL from Settings → Data API.`;
  }
  return null;
}

export const cloudUrlProblem = describeUrlProblem(rawUrl);
export const cloudEnabled = Boolean(rawUrl && anonKey);

export function cloudCredentials(): { url: string; anonKey: string } {
  if (!rawUrl || !anonKey) throw new Error('Supabase is not configured');
  if (cloudUrlProblem) throw new Error(cloudUrlProblem);
  return { url: rawUrl, anonKey };
}
