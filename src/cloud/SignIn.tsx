import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Phase = 'email' | 'sending' | 'code' | 'verifying' | 'google';

/**
 * How long the emailed code is, is a property of the Supabase project — its
 * "Email OTP Length" setting, anywhere from 6 to 10 digits — and nothing the
 * client can read at runtime. Hardcoding 6 here meant an 8-digit project had
 * its codes silently truncated to the first six, which then always failed.
 * So: accept the whole range, and let the server be the judge of the value.
 */
const MIN_CODE = 6;
const MAX_CODE = 10;

/**
 * Supabase appends `error`/`error_description` to the redirect when a tapped
 * link fails server-side — expired, or already used. Read it once and strip
 * it, or a stale link left in someone's inbox reads as a silent bounce back to
 * the email box with no explanation, which is exactly the symptom this whole
 * file exists to avoid.
 *
 * Deliberately not a `useState(fn)` lazy initializer: that function runs
 * inside React 18 Strict Mode's dev-only double-invoke, and the side effect
 * here (clearing the URL) makes the two calls disagree — the first reads and
 * clears the error, the second finds nothing and wins. A `useEffect` runs
 * exactly once and is the correct place for a read-and-clear.
 */
function readAndClearLinkError(): string | null {
  const fromParams = (params: URLSearchParams) => {
    if (params.get('error')) {
      return (
        params.get('error_description')?.replace(/\+/g, ' ') ?? 'That sign-in link didn’t work.'
      );
    }
    return null;
  };

  const query = fromParams(new URLSearchParams(window.location.search));
  const hash = fromParams(new URLSearchParams(window.location.hash.replace(/^#/, '')));
  const found = query ?? hash;

  if (found) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  return found;
}

/**
 * Two ways in: Google, or a code typed back into the same tab.
 *
 * Google is offered first because it sends no mail at all, which sidesteps
 * every way email can fail here — a sender that can only reach its own account
 * holder, a per-hour rate limit, a spam folder. For a second person on a
 * project with no domain of its own, it is usually the only thing that works.
 *
 * The email path deliberately has no tappable link. That was the first version
 * and it failed hard on mobile: mail apps and their security scanners
 * (Outlook's Safe Links chief among them) routinely pre-visit links in incoming
 * mail to check them for malware before a human ever taps one. Supabase's
 * confirmation link is single-use, so that automated visit burns the token —
 * the human's tap then hits an already-spent link and bounces back to sign-in
 * with no error to explain why. A typed code has nothing to pre-fetch.
 */
export default function SignIn({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('email');
  const [error, setError] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const found = readAndClearLinkError();
    if (!found) return;

    const sentence = /[.!?]$/.test(found) ? found : `${found}.`;
    // A failure coming back from Google is about the provider, not about a
    // stale emailed link — telling someone to type a code they never
    // requested is worse than saying nothing.
    const aboutALink = /link|otp|token|expired/i.test(found);
    setError(
      aboutALink
        ? `${sentence} Type the code from the email instead of tapping the link.`
        : sentence,
    );
  }, []);

  const signInWithGoogle = async () => {
    setError('');
    setPhase('google');

    const { error: oauthError } = await client.auth.signInWithOAuth({
      provider: 'google',
      // Back to whichever deployment this is. Supabase only honours it when it
      // matches the project's redirect allow-list, so a preview URL that isn't
      // listed lands on the production site rather than here.
      options: { redirectTo: window.location.origin },
    });

    if (oauthError) {
      setPhase('email');
      setError(
        /not enabled|unsupported provider/i.test(oauthError.message)
          ? 'Google sign-in isn’t switched on for this project yet — enable it under Authentication → Sign In / Providers in Supabase.'
          : oauthError.message,
      );
      return;
    }
    // On success the browser is already navigating to Google; the session
    // arrives back in the URL and CloudBoot picks it up.
  };

  const sendCode = async () => {
    const address = email.trim();
    if (!address) return;

    setError('');
    setPhase('sending');
    // No emailRedirectTo: this flow never uses the link, only the code the
    // same template carries alongside it.
    const { error: sendError } = await client.auth.signInWithOtp({ email: address });

    if (sendError) {
      setPhase('email');
      setError(sendError.message);
      return;
    }
    setCode('');
    setPhase('code');
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  const verify = async () => {
    const token = code.trim();
    if (token.length < MIN_CODE) return;

    setError('');
    setPhase('verifying');

    // Supabase labels the token by what the address is: `email` for a first
    // sign-up, `magiclink` for an address it already knows. The code in the
    // mail looks identical either way, so rather than guess which side of that
    // line an address falls on, try the common one and fall back. A wrong
    // *type* is rejected without spending the token, so the retry is free —
    // only a wrong *code* burns it.
    const attempt = (type: 'email' | 'magiclink') =>
      client.auth.verifyOtp({ email: email.trim(), token, type });

    let { error: verifyError } = await attempt('email');
    if (verifyError && /invalid|expired|token/i.test(verifyError.message)) {
      const retry = await attempt('magiclink');
      if (!retry.error) verifyError = null;
    }

    if (verifyError) {
      // Stay on the code screen — a mistyped digit shouldn't cost a fresh
      // email and another bite out of the rate limit.
      setPhase('code');
      // Supabase answers a mistyped code and a stale one with the same string
      // ("Token has expired or is invalid"), so claiming to know which it was
      // sends half of these people to request an email they didn't need — into
      // a rate limit that then locks them out for an hour. Say both.
      setError(
        /invalid|expired|token/i.test(verifyError.message)
          ? 'That code didn’t work. Check the digits against the email — if it’s an old code, send a new one below.'
          : verifyError.message,
      );
      requestAnimationFrame(() => codeRef.current?.focus());
      return;
    }
    // Success: the auth state change fires on its own and CloudBoot takes it from here.
  };

  const onCode = 'code' === phase || phase === 'verifying';

  return (
    <div className="gate">
      <div className="gate__card">
        <h1 className="gate__title">Daytime</h1>

        {onCode ? (
          <>
            <p className="gate__text">
              Code sent to <strong>{email.trim()}</strong>. Enter it below — it's the number in the
              email, not the link.
            </p>
            <div className="gate__row">
              <input
                ref={codeRef}
                className="field field--code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code"
                value={code}
                onChange={(e) => {
                  setError('');
                  setCode(e.target.value.replace(/\D/g, '').slice(0, MAX_CODE));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void verify();
                }}
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void verify()}
                disabled={code.trim().length < MIN_CODE || phase === 'verifying'}
              >
                {phase === 'verifying' ? 'Checking…' : 'Verify'}
              </button>
            </div>
            <button type="button" className="gate__alt" onClick={() => void sendCode()}>
              Send a new code
            </button>
          </>
        ) : (
          <>
            <p className="gate__text">Sign in to sync across your devices.</p>

            <button
              type="button"
              className="btn btn--google"
              onClick={() => void signInWithGoogle()}
              disabled={phase === 'google'}
            >
              <svg viewBox="0 0 48 48" width="17" height="17" aria-hidden>
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              {phase === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>

            <div className="gate__or">
              <span>or</span>
            </div>

            <div className="gate__row">
              <input
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setError('');
                  setEmail(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void sendCode();
                }}
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void sendCode()}
                disabled={!email.trim() || phase === 'sending'}
              >
                {phase === 'sending' ? 'Sending…' : 'Send code'}
              </button>
            </div>
          </>
        )}

        {error && <p className="gate__error">{error}</p>}
      </div>
    </div>
  );
}
