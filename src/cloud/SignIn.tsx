import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Phase = 'email' | 'sending' | 'code' | 'verifying';

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
 * Email OTP sign-in — a 6-digit code typed back into the same tab, not a link
 * to tap.
 *
 * A tappable link was the first version of this and it failed hard on mobile:
 * mail apps and their security scanners (Outlook's Safe Links chief among
 * them) routinely pre-visit links in incoming mail to check them for malware
 * before a human ever taps one. Supabase's confirmation link is single-use, so
 * that automated visit burns the token — the human's tap then hits an
 * already-spent link and silently bounces back to sign-in with no error to
 * explain why. A typed code has nothing to pre-fetch, so there's nothing for a
 * scanner to consume.
 */
export default function SignIn({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('email');
  const [error, setError] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const found = readAndClearLinkError();
    if (found) {
      const sentence = /[.!?]$/.test(found) ? found : `${found}.`;
      setError(`${sentence} Use the 6-digit code from the email instead of the link.`);
    }
  }, []);

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
    if (token.length < 6) return;

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
              Code sent to <strong>{email.trim()}</strong>. Enter it below — it's the 6-digit number
              in the email, not the link.
            </p>
            <div className="gate__row">
              <input
                ref={codeRef}
                className="field field--code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  setError('');
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void verify();
                }}
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void verify()}
                disabled={code.trim().length < 6 || phase === 'verifying'}
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
