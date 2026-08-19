# Putting Daytime in the cloud

**This is done and running.** Supabase holds the data, Vercel serves the app, and signing in works. What follows is the record of how it was set up — for redeploying, moving to another Supabase project, or onboarding someone else.

The database schema was also run against a real PostgreSQL 16 server before deployment: it applies cleanly, re-runs cleanly, and passes 15 checks covering the access rules and the concurrent-write handling.

If no credentials are set, the app quietly falls back to running entirely in one browser — no auth, no network. That is what keeps `npm run dev` and the single-file embed working with no backend at all.

---

## The values it needs

| # | Value | Where it comes from | Safe to share? |
|---|---|---|---|
| 1 | **Project URL** | Supabase → Settings → **Data API** | Yes |
| 2 | **Publishable / anon key** | Supabase → Settings → **API Keys** | Yes — it's designed to be public |
| 3 | ~~secret / service_role key~~ | Same page | **No. Never. It bypasses every security rule.** |

The anon key being public is not an oversight: it identifies the app, not you. What actually protects the data is row-level security in the database, written in `supabase/schema.sql`.

**Check the URL character by character.** It reads `https://<project-ref>.supabase.co`, and the ref is exactly **20 lowercase characters**. A hand-typed copy that drops one produces a hostname that does not exist, and the app will say so on boot rather than failing obscurely. Use the dashboard's copy button.

---

## Step 1 — Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is plenty).
2. **New project.** Name it `daytime`. Pick the region closest to you — East US if you're in Massachusetts.
3. It gives you a database password. Save it in your password manager. You won't need it for this, but you'll want it later.
4. Wait about two minutes for it to finish provisioning.

## Step 2 — Create the tables

**The file to copy is here:**

<https://github.com/michaellhill812/Daytime-/blob/claude/new-session-pn540o/supabase/schema.sql>

Open that, hit the **copy** button at the top right of the file (or use the [raw view](https://raw.githubusercontent.com/michaellhill812/Daytime-/claude/new-session-pn540o/supabase/schema.sql) and select all).

1. In Supabase's left sidebar: **SQL Editor** → **New query**.
2. Paste the whole file in.
3. **Run** (or ⌘/Ctrl + Enter). You should see **"Success. No rows returned."**

That one file creates the tables, the security rules, the save function, and the invite system. It is safe to run again — re-running it is how you'd apply a later change.

**If you see an error**, paste it to me rather than trying to fix it. The likely ones:

| Error mentions | What it means |
|---|---|
| `permission denied for schema auth` | You're on a restricted role — use the SQL Editor as the project owner, not a read-only member |
| `already exists` | Harmless, it means part of it ran before. It should still finish. |
| anything else | Send it to me |

## Step 3 — Turn on email sign-in

1. **Authentication** → **Providers** → **Email**.
2. Make sure **Enable Email provider** is on, along with **Allow new user signups**.

### Then change the email to send a code, not a link

**This step is required.** The app asks for a typed 6-digit code, but Supabase's stock email contains only a link — so without this change the mail arrives with no code in it and there is nothing to type.

**Editing the template body requires custom SMTP first.** Supabase's built-in sender only lets you change the subject line; the body editor's **Source** view stays greyed out with "Set up custom SMTP to edit the source" until a custom sender is configured. There's no way around this on the built-in service — a real sender has to go in before the template can change at all.

**[Resend](https://resend.com)** is the fastest way there: free tier, and it has a sandbox address (`onboarding@resend.dev`) that sends immediately with no domain to verify — right for a two-person project.

1. Sign up at resend.com. **API Keys** → **Create API Key** → copy it.
2. **Authentication** → **Emails** → **SMTP Settings** → turn on **Enable custom SMTP** and fill in:

   | Field | Value |
   |---|---|
   | Sender email | `onboarding@resend.dev` |
   | Sender name | `Daytime` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | *(the API key)* |

   Save.
3. **Templates** → **Magic Link** → **Source** is now editable. Replace the whole body with:

   ```html
   <h2>Daytime</h2>
   <p>Your code is:</p>
   <p style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 30px; font-weight: 700; letter-spacing: 2px; -webkit-user-select: all; user-select: all;">{{ .Token }}</p>
   <p>Enter it in the app. If you didn't ask for this, ignore it.</p>
   ```

   The wording and spacing here are load-bearing, not decoration. `Your code is:` immediately before the digits is the phrasing iOS and Android look for when they offer a one-time code above the keyboard — the app's input already advertises itself as a one-time-code field, so on a phone the code can usually be filled with a single tap and never copied at all. Tight letter-spacing keeps a double-tap selecting the whole number as one word instead of splitting it, and `user-select: all` makes a single tap select the lot in mail clients that honour it.

`{{ .Token }}` is the code. `{{ .ConfirmationURL }}` is the link — and it is deliberately gone.

Leaving the link in place is not merely untidy. That link **is** the credential: it carries a token that signs in whoever opens it, in any browser, on any device, with no code required. That is how magic links are specified to work, so anything that reaches the message — a forwarded mail, a shared inbox, a corporate scanner that opens links to check them — can sign in as you. Scanners consuming the link before you tap it is what broke sign-in on your phone in the first place. A typed code has nothing to open, and removing the link is what actually closes the hole.

URL configuration comes later, in Step 6 — it needs the Vercel address, which does not exist yet. Doing it now is the mistake that sends the first sign-in mail pointing at `localhost:3000`.

> **The sandbox sender only reaches you.** `onboarding@resend.dev` is Resend's shared testing address, and it delivers only to the email you signed up to Resend with. That is enough to sign yourself in — and it is why the invite in Step 7 needs the section below before it will reach anybody else. Mail from it also lands in spam more readily than mail from a domain of your own, so check junk on the first send.

### Sending to a second person

The sandbox sender can't do it, and Resend's own answer — verify a domain — means owning one. Any of these lift the restriction without a domain. All three are pure configuration; none of them touch the app.

**Gmail's SMTP.** No new account, and codes arrive from an address people recognise. Requires 2-Step Verification on the Google account, because that is what unlocks App Passwords: create one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), then in **SMTP Settings** use host `smtp.gmail.com`, port `465`, username *and* Sender email both set to that Gmail address, password the 16-character App Password. The sender has to match the account — Gmail rejects a mismatched From. The cap is around 500 messages a day.

**Brevo, Mailjet, or SendGrid.** All three offer *single sender verification*: you verify one address you already own instead of a whole domain, then send to anyone. Brevo is the most generous of them at 300/day — sign up, verify your address, and use `smtp-relay.brevo.com` on port `587` with the SMTP key it gives you.

**A domain, if you ever get one.** Still the sturdiest answer, and the only one that survives a provider changing its free tier. Verify it in Resend under **Domains → Add Domain**, add the DNS records it lists at your registrar, and change the Sender email in Supabase to an address on it. Nothing else in the SMTP settings changes.

> Worth knowing: none of this applies to an OAuth provider. "Sign in with Google" sends no mail at all, so no sender limit can reach it — see the note at the end of Step 7.

## Step 4 — Get your two values

**Project Settings → API**, and copy:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- the **publishable / anon** key — either `sb_publishable_...` (current) or `eyJ...` (legacy). Both work.

Supabase moved this page recently. If **Settings → API** looks unfamiliar, try **Settings → API Keys** for the key and **Settings → Data API** for the URL.

**Check the URL before sending it.** It reads `https://<project-ref>.supabase.co`, and the ref is exactly **20 lowercase characters**. Copies made by hand often drop one or two — use the dashboard's copy button.

Send me those two and I'll fill in `.env.local` for local development.

## Step 5 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com), sign in **with GitHub**.
2. **Add New → Project**, and pick the `Daytime-` repository.
3. Vercel reads `vercel.json` and configures itself. Don't change the build settings.
4. Before you click Deploy, open **Environment Variables** and add both:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon key |

   Tick all three environments (Production, Preview, Development).
5. **Deploy.** You get a **production** URL like `daytime-xyz.vercel.app`.

Changing an environment variable later does **not** rebuild on its own — redeploy after any change, or the old value stays baked into the bundle.

## Step 6 — Point Supabase back at the deployment

This is the step that has to come after deploying, and skipping it is what breaks the first sign-in.

**Supabase → Authentication → URL Configuration:**

- **Site URL** → the **production** Vercel URL (the stable one, no random hash in it).
- **Redirect URLs** → add that same URL with a wildcard: `https://daytime-xyz.vercel.app/**`

Optionally add `https://*.vercel.app/**` so preview deployments work too.

Why it matters: the app asks Supabase to send you back to whatever URL you signed in from. Supabase only honours that if it matches the allow-list — otherwise it silently substitutes the Site URL. Left at its default, that is `http://localhost:3000`, and the emailed link dead-ends at a page that does not exist.

**Use the production URL, not Vercel's Preview button.** Preview URLs change per deployment, and on some plans sit behind Vercel's Deployment Protection wall.

### Optional — Google sign-in

The app offers **Continue with Google** above the email box. It's optional, but it is the one route that sends no mail at all, so no sender restriction, rate limit, or spam filter can touch it — which makes it the simplest way to get a second person in without owning a domain. It has to come after Step 6, because it needs the deployed URL.

**In Google Cloud** ([console.cloud.google.com](https://console.cloud.google.com)), free:

1. Create a project, then **APIs & Services → OAuth consent screen**. Choose **External**, fill in an app name and your email, and save. Leave it in Testing mode and add both sign-in addresses under **Test users** — a Testing app is capped at 100 users and needs no review, which is ample here. (Publishing it would ask for verification you don't need.)
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application.**
3. Under **Authorised redirect URIs** add exactly one entry — your Supabase callback, not the Vercel URL:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

4. Copy the **Client ID** and **Client secret**.

**In Supabase**, go to **Authentication → Sign In / Providers → Google**, enable it, paste both values, and save.

That's it — the button starts working on the next sign-in, no redeploy needed, because the app already ships it.

The redirect URI trips people up: Google sends the user back to *Supabase*, and Supabase then forwards them to the app. Putting the Vercel URL in Google's list instead produces a `redirect_uri_mismatch` at the Google screen. If the app says Google sign-in isn't switched on, the provider toggle in Supabase is off or the credentials didn't save.

## Step 7 — First sign-in

1. Open the production URL. You'll get a sign-in screen. If you set up Google above, **Continue with Google** is the whole of it — tap it, pick your account, done. Otherwise:
2. Enter your email and tap **Send code**.
3. Open the email, read the 6-digit code, type it back into the same tab, tap **Verify**. A mistyped digit costs nothing — the code stays live, so you can correct it without requesting another mail.
4. The app opens and creates your workspace automatically.
5. Tap the round button in the top-right corner → **Invite** → enter Andrew's email.

Andrew can sign in whenever he likes; the invitation waits for him. He doesn't need an account first — but his code can only *reach* him once the sender can send to somebody other than you, which is what "Sending to a second person" in Step 3 is about. The invitation itself lives in the database and keeps waiting regardless, so inviting him early costs nothing.

**If Google sign-in is on, none of that applies to him.** He taps **Continue with Google** and is in — no mail is sent, so nothing can be restricted, rate-limited, or filtered. The invitation is matched on the email address of whichever Google account he uses, so invite the address he'd sign in with. (Remember to add him under **Test users** in the Google consent screen while the app is in Testing mode, or Google will refuse him.)

Note: on first cloud sign-in, whatever is already in that browser's local storage becomes the starting document rather than being wiped. Sign in first from the browser whose data you want to keep.

## Step 8 — Put it on your phone

Open the Vercel URL in Safari → Share → **Add to Home Screen**. It runs full-screen with no browser chrome, and it's the same workspace as your laptop.

---

## How it actually works

**One document, many devices.** Your whole Daytime state is a single JSON document in one database row. Every device reads that row and writes it back.

**Writes are checked, not assumed.** Each save carries the version number the client last saw. If someone else saved in the meantime, the database refuses the write and hands back their version instead. Your client merges the two and tries again.

**Merging is per item, against a common ancestor.** If you add a task while Andrew edits a document, both survive — the merge compares each item against the last version you both agreed on, so it can tell "added" from "deleted" from "unchanged". The one thing it can't resolve is you and Andrew editing *the same item* within the same second; there, the person who saved wins. That's a real limitation, and the honest fix if it ever bites is CRDTs, which are a much bigger build.

**Changes arrive live.** Each client subscribes to its workspace row, so Andrew's edit shows up on your screen without a refresh.

**Who can see what.** Row-level security means the database itself refuses to hand your workspace to anyone who isn't a member — that's enforced in Postgres, not in the app, so it holds even if someone pokes at the API directly. Writes only go through the save function, which checks membership before touching anything.

---

## Costs

| | Free tier | When you'd outgrow it |
|---|---|---|
| Supabase | 500 MB database, 50k monthly users | Not in any realistic future for this |
| Vercel | 100 GB bandwidth/month | Same |
| Whichever sender you settled on | Resend 100/day · Gmail ~500/day · Brevo 300/day | Same |

Two people and a few hundred KB of notes. This stays free.

One thing to know: **Supabase pauses free projects after a week of inactivity.** Opening the app wakes it, but the first load after a pause takes a few seconds. If that gets annoying it's $25/month to avoid, or a scheduled ping to keep it warm.

---

## Troubleshooting

The app translates the common database failures into plain sentences rather than error codes, so start by reading what the screen says. These four are the ones actually hit during setup:

**The email has a link but no code** — the Magic Link template was never changed, so it is still Supabase's stock link-only mail. Step 3, the template section. Nothing in the app can work around this: if `{{ .Token }}` isn't in the template, the code isn't in the message.

**Google says `redirect_uri_mismatch`** — the authorised redirect URI in Google Cloud has to be the *Supabase* callback, `https://<project-ref>.supabase.co/auth/v1/callback`, not the Vercel URL. Google returns the user to Supabase, which then forwards them to the app.

**"Google sign-in isn't switched on for this project yet"** — the provider toggle under **Authentication → Sign In / Providers → Google** is off, or the client ID and secret didn't save.

**Google refuses a second person with "app is being tested"** — the OAuth consent screen is in Testing mode, which only admits addresses listed under **Test users**. Add theirs there. The 100-user cap is the trade for skipping Google's verification review.

**The code is longer or shorter than you expect** — fine, the app takes anything from 6 to 10 digits, which is the range Supabase allows. The length is **Authentication → Sign In / Providers → Email → Email OTP Length** if you want to change it; nothing in the app needs to match it.

**"That sign-in link didn't work"** — you tapped a link instead of typing a code. Links are single-use and are often spent before you reach them, by a scanner or a preview fetch. Once the template is fixed there is no link to tap; ignore any older mail still sitting in the inbox.

**A link signs you in from a different browser without any code** — expected, and the reason the link has to go. That token authenticates whoever opens it, wherever they open it. Remove `{{ .ConfirmationURL }}` from the template (Step 3) and the exposure goes with it.

**Sign-in dead-ends at "site cannot be reached"** — an old link pointed at `localhost:3000`, because Supabase's Site URL was never aimed at the deployment. Step 6.

**No sign-in email at all** — check spam first; a sandbox sender address like `onboarding@resend.dev` is filtered more aggressively than mail from a domain of your own. Then confirm **Authentication → Providers → Email** is enabled with signups allowed, and that custom SMTP is still on with valid credentials. **Authentication → Logs** shows what happened to each attempt and beats guessing.

**Mail arrives for you but never for the other person** — the sender can only reach its own account holder. That is the sandbox restriction, not a bug in the invite; see "Sending to a second person" in Step 3. The Logs will show the send being refused rather than delivered.

**"Email rate limit exceeded"** — Supabase keeps its own default cap on top of whatever Resend allows, and it can still bite briefly right after switching on custom SMTP. It clears on its own within a few minutes. A wrong code doesn't consume it, so correct the digits rather than requesting a new mail.

**"The project ref … is 18 characters, but Supabase refs are 20"** — the URL lost a character in copying. Re-copy it from Settings → Data API with the copy button.

**"The database is missing its setup"** — `schema.sql` never ran, or ran against a different project. Redo Step 2 and watch for a red error in the SQL editor.

**"The API key was rejected"** — the key in Vercel doesn't match Supabase, or it was changed without redeploying. Env var changes need a redeploy to take effect.

**Edits don't appear on the other device** — realtime isn't on for the table. Re-run `schema.sql`; it's safe to run again.

---

## Running it locally

```bash
cp .env.example .env.local   # paste your two values in
npm run dev
```

With `.env.local` absent or empty, `npm run dev` runs the local-only version — no sign-in, no network. That's deliberate: the app has to keep working with no backend at all, which is also what lets the single-file preview build exist.
