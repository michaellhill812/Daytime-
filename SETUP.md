# Putting Daytime in the cloud

Everything in the app is already written, and the database schema has been run against a real PostgreSQL 16 server: it applies cleanly, re-runs cleanly, and passes 15 checks covering the access rules and the concurrent-write handling. This is the part only you can do — creating the accounts and pasting two values. Roughly 20 minutes.

Until you finish it, nothing changes: with no credentials set, the app runs exactly as it does now, entirely in one browser.

---

## What you need to give me

Four things, and **two of them are secret**. Send me the first two here; keep the last two to yourself and paste them into Vercel directly.

| # | Value | Where it comes from | Safe to paste in chat? |
|---|---|---|---|
| 1 | **Supabase project URL** | Supabase → Project Settings → API | Yes |
| 2 | **Supabase anon key** | Same page, "anon public" | Yes — it's designed to be public |
| 3 | ~~service_role key~~ | Same page | **No. Never. It bypasses every security rule.** |
| 4 | Vercel + GitHub login | — | **No** — you connect these yourself |

The anon key being public is not an oversight: it identifies the app, not you. What actually protects the data is row-level security in the database, which is already written in `supabase/schema.sql`.

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
2. Make sure it's enabled. Turn **Confirm email** on.
3. **Authentication** → **URL Configuration** → set **Site URL** to your Vercel address once you have it (Step 5), and add it to **Redirect URLs** too.

> Supabase's built-in email sender is rate-limited to a handful per hour. That's fine for you and Andrew. If it ever starts throttling, the fix is plugging in a real sender (Resend, Postmark) under Authentication → Emails.

## Step 4 — Get your two values

**Project Settings → API**, and copy:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — a long string starting `eyJ...`

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
5. **Deploy.** You get a URL like `daytime-xyz.vercel.app`.
6. Go back to Supabase → Authentication → URL Configuration and put that URL in **Site URL** and **Redirect URLs**. Sign-in links won't work until you do.

## Step 6 — First sign-in

1. Open your Vercel URL. You'll get a sign-in screen.
2. Enter your email, tap **Send link**, open the email, tap the link.
3. The app opens and creates your workspace automatically.
4. Tap the round button in the top-right corner → **Invite** → enter Andrew's email.

Andrew can sign in whenever he likes; the invitation waits for him. He doesn't need an account first.

## Step 7 — Put it on your phone

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

Two people and a few hundred KB of notes. This stays free.

One thing to know: **Supabase pauses free projects after a week of inactivity.** Opening the app wakes it, but the first load after a pause takes a few seconds. If that gets annoying it's $25/month to avoid, or a scheduled ping to keep it warm.

---

## Troubleshooting

**"Can't reach the workspace"** — the schema didn't run. Redo Step 2 and check for a red error in the SQL editor.

**Sign-in link goes to localhost** — Site URL in Supabase still points at localhost. Step 5, item 6.

**Signed in, but no data and no error** — you're in a fresh workspace. If your documents were in a different browser, they're still in that browser's local storage; tell me and I'll add an import.

**Edits don't appear on the other device** — realtime isn't on for the table. Re-run the last two lines of `schema.sql`.

---

## Running it locally

```bash
cp .env.example .env.local   # paste your two values in
npm run dev
```

With `.env.local` absent or empty, `npm run dev` runs the local-only version — no sign-in, no network. That's deliberate: the app has to keep working with no backend at all, which is also what lets the single-file preview build exist.
