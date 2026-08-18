import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Email link sign-in. No password to invent, forget, or reset — you get a link,
 * you tap it, you're in. Same flow whether it's your first time or your tenth.
 */
export default function SignIn({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const send = async () => {
    const address = email.trim();
    if (!address) return;

    setState('sending');
    const { error } = await client.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      setState('error');
      setMessage(error.message);
      return;
    }
    setState('sent');
  };

  return (
    <div className="gate">
      <div className="gate__card">
        <h1 className="gate__title">Daytime</h1>

        {state === 'sent' ? (
          <>
            <p className="gate__text">
              Link sent to <strong>{email.trim()}</strong>. Open it on this device to finish signing
              in.
            </p>
            <button type="button" className="gate__alt" onClick={() => setState('idle')}>
              Use a different address
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
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send();
                }}
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void send()}
                disabled={!email.trim() || state === 'sending'}
              >
                {state === 'sending' ? 'Sending…' : 'Send link'}
              </button>
            </div>
            {state === 'error' && <p className="gate__error">{message}</p>}
          </>
        )}
      </div>
    </div>
  );
}
