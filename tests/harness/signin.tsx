import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import SignIn from '../../src/cloud/SignIn';
import '../../src/index.css';

/**
 * SignIn against a fake Supabase, so the sign-in screen can be tested without
 * a network — and, more to the point, so the failures that matter can be
 * *produced on demand*. Every interesting bug in that screen has been about
 * what it says when something goes wrong, and there is no way to make a real
 * project rate-limit itself or forget its Google provider to order.
 *
 * The query string chooses which reality to serve:
 *
 *   ?oauth=disabled    Google is not switched on for the project
 *   ?oauth=other       some other provider failure
 *   ?send=fail         signInWithOtp is rate-limited
 *   ?verify=invalid    the typed code is rejected
 *   ?verify=type       the code is right but only under type 'magiclink'
 *   ?error=…&error_description=…   an error handed back in the redirect
 *
 * Calls land on `window.__calls` and a successful verify sets
 * `window.__verified`, which is how the suite sees what was actually asked of
 * Supabase rather than only what got painted.
 */

declare global {
  interface Window {
    __calls: { fn: string; args: unknown }[];
    __verified?: boolean;
  }
}

const params = new URLSearchParams(window.location.search);
const calls: { fn: string; args: unknown }[] = [];
window.__calls = calls;

const fail = (message: string) => ({ data: null, error: { message } });
const ok = (data: unknown = {}) => ({ data, error: null });

const client = {
  auth: {
    async signInWithOAuth(args: unknown) {
      calls.push({ fn: 'signInWithOAuth', args });
      switch (params.get('oauth')) {
        case 'disabled':
          // Verbatim shape of the real thing, because SignIn matches on it.
          return fail('Unsupported provider: provider is not enabled');
        case 'other':
          return fail('Something else broke');
        default:
          // The real client would already be navigating to Google by now.
          return ok({ provider: 'google', url: 'about:blank' });
      }
    },

    async signInWithOtp(args: unknown) {
      calls.push({ fn: 'signInWithOtp', args });
      return params.get('send') === 'fail'
        ? fail('For security purposes, you can only request this after 60 seconds.')
        : ok();
    },

    async verifyOtp(args: { type?: string }) {
      calls.push({ fn: 'verifyOtp', args });
      if (params.get('verify') === 'invalid') return fail('Token has expired or is invalid');
      // The type fallback: an address Supabase already knows answers to
      // 'magiclink' and rejects 'email' with the same wording as a bad code.
      if (params.get('verify') === 'type' && args.type !== 'magiclink') {
        return fail('Token has expired or is invalid');
      }
      window.__verified = true;
      return ok({ session: { user: { email: 'someone@example.com' } } });
    },
  },
} as unknown as SupabaseClient;

const el = document.getElementById('root');
if (!el) throw new Error('#root missing');
createRoot(el).render(
  <StrictMode>
    <SignIn client={client} />
  </StrictMode>,
);
