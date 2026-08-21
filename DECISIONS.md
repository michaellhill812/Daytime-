# Decisions

Why Daytime is built the way it is, and the things that will bite anyone —
including a future me with no memory of this conversation — who changes it
without knowing. Ordered by how expensive the mistake is.

README.md is what the app is. SETUP.md is how to run it. This is why.

---

## Standing rules

These came from the person the app is for. They are not preferences.

**1. Nothing in a document that wasn't in the source.**
Wall document bodies are the source text, verbatim. No summarising, no
tidying, no appended advice, no invented examples. The whole point is being
able to tell what came from a real document and what came from an AI. A
paraphrase that reads better is still a violation. `src/data/seed.ts` carries
this rule in its docblock; an audit once found invented sentences in five
documents and every one had to be rewritten back to source.

**2. Never bump `SCHEMA_VERSION`.**
`src/store/storage.ts` discards saved state and re-seeds on a version
mismatch. The live workspace holds real, shared, irreplaceable work. New
fields are added as **optional** and defaulted at the storage boundary by
`withDefaults()`, which runs on first load *and* on every realtime payload —
a peer on an older build can still write a document without the newer field.
If a version bump ever becomes genuinely unavoidable, it needs a migration
that preserves data, and it needs saying out loud first.

**3. Never touch the `service_role` key.**
It bypasses every RLS policy. Only the anon/publishable key
(`sb_publishable_…` or legacy `eyJ…`) is ever handled, and it is designed to
be public. `.env.local` stays gitignored.

**4. Branch discipline.**
Work happens on `claude/new-session-pn540o`. `main` is Vercel's production
branch — pushing there deploys. Ask before promoting.

---

## Architecture

**One JSON document per workspace.** The whole of `DaytimeState` lives in a
single `workspace_state` row. Every device reads that row and writes it back.
This is why sync is simple, and it is also the reason messages are addressed
rather than private (see below).

**Writes are compare-and-swap.** `save_state(workspace, state, expected)`
refuses a write whose `expected` version doesn't match, and hands back the
winner's document. The client then runs a **three-way merge** against the last
revision both sides agreed on (`src/store/merge.ts`) and retries. Two people
editing different things at the same moment both survive; two people editing
the *same* entity resolve to the last writer. Only CRDTs fix that, and this
app does not need them.

**Deletion works because of the merge base.** Merging per entity against a
common ancestor is what makes a delete distinguishable from an absence, so
there are no tombstones.

**Realtime, with a self-echo guard.** The adapter subscribes to the row and
ignores any payload whose version it already holds — otherwise a client would
apply its own write and start a ping-pong.

**One store, whole-state replacement.** `useSyncExternalStore` with the state
object's identity as the change token. Every action replaces state wholesale.
Persistence is debounced 250ms; `flush()` on tab hide.

**Two adapters, one interface.** `StorageAdapter` (`load`/`save`/`clear` +
optional `subscribe`). `LocalStorageAdapter` and `SupabaseAdapter`.
`__CLOUD_BUILD__` is a Vite `define`, not an env lookup — rollup only drops
the dynamic Supabase import when the guard folds to a literal `false`, which
is what makes `VITE_EMBED=1` produce a cloud-free single-file build.

**Reverse lookups are derived, never stored.** Links live on `Task`
(`docIds`, `eventIds`) and as optional `domainId` on Doc/CalEvent. Everything
else — which tasks reference a document, which documents were added on a day
— is computed in `selectors.ts`. One place a link can go stale.

**Attaching happens on the task, not on the document.** A document belongs to
many tasks, but a task is the thing being worked on — you reach for the
reference from the job, not the other way round. `TaskSheet` offers the Wall
ranked already-attached, then same-spoke, then alphabetical, so the career
documents surface on a career task without anyone searching. `toggleTaskEvent`
exists on the store and still has no UI; `toggleTaskDoc` was in the same state
until it got one.

**Recurrence is a rule, not rows.** A repeating event is one row with a
`recurrence` field, expanded at read time by `eventsOnDay`. Thirteen rows, not
hundreds, and editing the rule stays one edit.

---

## The ring reads open work, not finished work

`RingSegment.load` is the share of a domain's sector that gets painted, and it
is driven by **open** tasks. It was `done / total` — a completion bar — and
that was the wrong instrument on a glanceable HUD: a domain with four untouched
tasks drew nothing at all, so the spoke most owed attention was the one drawn
emptiest, while a nearly-cleared domain blazed. Reported from the app as "I
have an open task under self care that isn't appearing in the outside ring",
which is exactly right.

The scale is **absolute** — `openCount / 6`, floored at 0.2 so one open task is
never invisible, capped at a full sector. Two alternatives were considered and
both are worse:

- *A proportion of the domain's own list* is what it used to be, inverted. One
  open of one would fill the whole sector while five of twenty filled a
  quarter — backwards for "how much is here".
- *Normalising against the busiest domain* makes every other arc lengthen the
  moment you clear the heaviest one. **Finishing work must never look like
  acquiring it.**

A fixed ceiling costs saturation past six open tasks and buys a mark that means
the same thing every time you look at it. `FULL_LOAD` in `selectors.ts` is the
knob.

Consequences worth knowing: a fully finished domain now draws an **empty** arc
rather than a full green one, so `DONE_COLOR` had no reader left and is gone —
"clear" is said by the label and by the dimmed spoke cap instead. Open counts,
the overdue dot, and the hub's number were never part of this and did not
change. `tests/ring.mjs` covers the flip and fails loudly against the old
encoding.

---

## Identity, and the workspace-routing bug

Authorship is stored as an **email**, not a name. It is the one identifier
that doesn't move under you — editing a Google profile must not orphan
everything someone ever added, and the "was this me?" comparison behind the
updates bell depends on it being stable. Display names are resolved at *read*
time from a directory fetched at boot (`store.people`), so names can improve
without rewriting a single stored record.

**`ensure_workspace()` picks by member count.** Signing in creates a workspace
for anyone who has none, so whoever opens the app before their invitation
arrives ends up owning an empty one. Preferring a workspace you *own* left
them stranded there forever — a complete, working app full of seed data, with
nothing on screen to say it was the wrong room. It reads exactly like broken
sync and it is not. A room with other people in it is the one you meant;
ownership and age only break ties between equals.

The obvious fix is not enough, which is worth remembering: `invite_member()`
adds the membership row *directly* when the invited address already has an
account, and never creates an invite row at all. Preferring a freshly-claimed
invitation therefore misses precisely the case that causes the problem.

`supabase/workspace_routing_test.sql` reproduces the whole sequence against a
real Postgres and fails on the old function.

---

## Auth

Two ways in, both live in `src/cloud/SignIn.tsx`.

**Google OAuth is the good path.** It sends no mail, so no sender
restriction, rate limit, or spam filter can touch it. The redirect URI
registered with Google is the **Supabase callback**
(`https://<ref>.supabase.co/auth/v1/callback`), not the Vercel URL — Google
returns the user to Supabase, which forwards them to the app. The consent
screen sits in Testing mode, which admits only addresses listed as test
users; that is the trade for skipping Google's verification review.

**Email is a typed code, never a link.** A tappable link failed hard on
mobile: mail security scanners (Outlook Safe Links and friends) pre-visit
links to check them, and Supabase's link is single-use, so the scan burned the
token and the human's tap hit a spent link. A typed code has nothing to
pre-fetch.

Three things about that flow are non-obvious:

- The code is only in the mail if `{{ .Token }}` is in the Magic Link
  template — and **the template body cannot be edited without custom SMTP**.
  That is why Resend is in the setup at all.
- The code's length is a project setting, 6 to 10 digits, unreadable by the
  client. Hardcoding 6 silently truncated an 8-digit code and it could never
  verify.
- Supabase labels the token `email` for an address it has never seen and
  `magiclink` for one it knows, and the digits look identical. `verifyOtp`
  tries one and falls back; a wrong *type* is rejected without spending the
  token, so the retry is free.

---

## Notes are addressed, not private

Messages live in the shared document like everything else, so a note "to
Leila" is carried in everyone's copy. The app shows it only to its
recipients; nothing hides it from someone who goes looking. The composer says
so in as many words, because the alternative is someone assuming a privacy
this cannot provide. Real privacy needs a `messages` table with its own
row-level rules.

Read state lives on the message (`readBy`), unlike the updates bell's `seen`
marker which lives in localStorage. They look like the same problem and are
not: a note is said to a *person*, so reading it on a phone should clear it on
a laptop; "have I seen this change" is about a pair of *eyes* and stays on the
device.

---

## Rendering traps, all of them paid for once already

**CSS beats SVG presentation attributes.** A `stroke` or `stroke-width` in a
CSS rule overrides the same attribute set in JSX. This has bitten twice — once
flattening the wheel's three-layer arc glow to a single width, once about to
flatten every glass gradient back to one tone. `.wheel__fill`, `.wheel__track`,
`.wheel__rim` and `.hub__edge` deliberately declare **no** stroke colour or
width in CSS, and say so in a comment. Hub hover brightens by `opacity` for
the same reason.

**Blur cost scales with pixel area, and it is enormous.** Two invisible blurs
held the whole app at ~14fps on a desktop while a phone was fine — the phone
simply had 20× fewer pixels to blur.

| | before | after |
|---|---|---|
| Wheel | 69.3ms/frame, 56 of 57 dropped | 16.67ms, none |
| Wall | 75.6ms, 51 of 52 dropped | 16.67ms, none |
| World | 124.5ms, 30 of 32 dropped | ~17ms |

The offenders were `filter: blur(20px)` on a layer inset `-20%` that animated
forever, and `backdrop-filter: blur(24px)` on a panel that is 97–99% opaque
*and* stays mounted off-screen — so it was blurring the backdrop of something
nobody was looking at, in every view. **Glass is done in gradients instead**:
a sheen, a specular, a rim light. Paint is free after the first frame.

**An SVG filter's region is measured from the path's bounding box.** An arc
near the top of a circle is nearly flat, so its box is a sliver, and a blur
gets clipped into a rectangle lying visibly across the curve. Concentric
strokes of the same path can only ever be the shape of the arc.

**`transition: all` poisons measurement.** Reading `getComputedStyle` in the
same tick as a class change returns a value mid-animation. Two attempts at
proving the info icon's colour reported a mismatch that wasn't there.

**An untimed deadline is 23:59, and must never be printed as one.** A task due
"on Thursday" is stored at the end of Thursday — that is the one minute meaning
"no particular time". Anything rendering a deadline has to ask `isTimed()`
first, or it invents an 11:59pm nobody chose. `dueLabel` printed exactly that
for untimed tasks due today; World avoids it by saying "to-do" instead. The
mirror of the same trap is dropping a time that *was* chosen: `dueLabel` showed
the clock only for today, so "tomorrow at 2:30pm" rendered as "Tomorrow". Both
directions are covered by `tests/duetime.mjs`.

**A `date`/`time` input ignores `placeholder`.** Empty, it shows only the
browser's format hint, which says how to type but never what the field is
for. They carry visible captions instead (`.capped` / `.capped__cap`) —
**every** one of them. The quick-add got captions first and the task editor was
left with two blank boxes, which is exactly how it was reported. If a date or
time input is added anywhere, it wraps in `.capped`. Two consequences that are
easy to miss: the row holding them must align on `flex-end`, or a bare button
beside them floats up against the captions; and a caption sitting directly
under a same-sized `.compose__label` heading reads as the field being labelled
twice, so the heading goes rather than the caption.

**An open `<select>` is painted by the OS.** Windows and Linux draw the popup
on a light system background while options inherit the app's near-white text —
white on white. iOS renders its own sheet and ignores page styling, which is
why it looked fine there. Options carry an opaque background of their own.

**An optional callback prop is a bug waiting for the fifth call site.**
`TaskRow` took `onOpenDoc`/`onOpenEvent` as optional props, and three of the
five lists rendering a task row never passed them — the completed-task list
among them. The chips still rendered, still focused, still looked live, and
swallowed every tap. Nothing type-checks a prop nobody passed. `TaskRow` was
already calling `usePeek()` for `openTask`, so the handlers now come from
context: a hook cannot be forgotten, and every list gets the behaviour for
free. Prefer context over an optional prop whenever the default is "do
nothing" and the component is rendered from more than one place.

**The floating buttons own the top-right corner.** Anything full-width in that
band ends up underneath them. The Wall's search has its own row for this
reason, and the whole cluster hides while World is open (via `:has()`, so the
account button — rendered outside the app tree — is covered by the same rule).

Older, from the gesture era: `setPointerCapture` retargets `click` and
swallowed every tap; text selection fired `pointercancel` and silently killed
the *next* gesture; `-webkit-line-clamp` under-reports intrinsic height to a
grid, so clamped cards spilled past their own border.

---

## Postgres traps

- **`create or replace function` cannot change a return type.** Adding a
  column to `workspace_people` required `drop function` first — without it,
  running the schema over a live project fails outright instead of upgrading.
  The upgrade path is worth testing, not just the fresh install.
- **`alter publication … add table` is not idempotent.** It is wrapped in a
  `DO` block catching `duplicate_object`, because SETUP.md claims the file is
  safe to re-run and it has to actually be true.
- RLS helpers are `SECURITY DEFINER` so the membership check doesn't re-enter
  the policies that call it; without that, `workspaces` and
  `workspace_members` reference each other and every query dies of infinite
  recursion.

---

## Testing

No test runner. Everything is driven by Playwright against a **real
production build**, because most of what has actually broken here was layout,
paint, or platform behaviour that a jsdom test would have sailed straight
past.

```bash
tests/run.sh            # every suite
tests/run.sh attach     # just one
```

`run.sh` builds the app and the harness, serves both, runs the suites and
tidies up. It refuses to start if either port is already answering — a server
left over from an earlier run serves a directory that no longer exists, and
every suite then fails on a 404 that looks nothing like a stale process.

- `batch.mjs`, `verify.mjs`, `verify2.mjs` — the three views end to end
- `attrib.mjs` — authorship and the updates feed
- `attach.mjs` — linking Wall documents to tasks
- `attach2.mjs` — attaching at creation, and chips on completed tasks
- `ring.mjs` — the wheel's arc, against open work
- `duetime.mjs` — deadline labels, timed and untimed
- `whentest.mjs` — day-and-time captions in the wheel and the bell
- `walltest.mjs` — Wall header geometry at two widths, and `<option>` colour
- `infotest.mjs` — the floating button row
- `msgtest.mjs` — notes across three identities sharing one document
- `signin.mjs` — sign-in against a mocked Supabase client
- `perf.mjs` — frame timing via rAF deltas at 1920×1080. Not in the default
  set: it is slow and its numbers are about the machine, so it is a thing you
  run when you suspect a regression, not on every change.
- `supabase/workspace_routing_test.sql` — workspace routing, against a real
  Postgres (`psql -f`), not part of `run.sh`

**`tests/harness/` is committed, and that is the point.** It builds two pages
against the app's own source:

- `signin.html` — `SignIn` with a fake Supabase client whose failures are
  chosen by query string (`?oauth=disabled`, `?send=fail`, `?verify=invalid`,
  `?verify=type`, `?error=…`). Every interesting bug in that screen has been
  about what it *says* when something goes wrong, and a real project cannot be
  made to forget its Google provider on demand.
- `people.html` — the whole app over localStorage, signed in as `?me=`.
  Authorship credit, the updates bell and addressed notes are invisible in the
  plain local build because it has no actor. Several pages of this in one
  browser context are several people sharing one document.

An earlier version of both lived in a scratch directory and was deleted after
use, which meant the sign-in suite could not be re-run at all. Test scaffolding
that only exists during the session that wrote it is not a test.

`tests/pw.mjs` is the one place that knows where Playwright is. It is not a
project dependency — that would put a browser download in front of anyone who
only wants to build the app — so it resolves normally first, then falls back to
the global install, and `PLAYWRIGHT_MODULE` overrides both.

Two habits worth keeping. **Prove the test fails first** — the routing fix
looked right and the second layer of the bug only showed because the test was
run against the old function and still failed. And **screenshot anything
visual**: text-content assertions passed cleanly on a stacked date column that
was, in fact, centre-aligned and wrong. Screenshots land in `tests/.out`,
gitignored, because they are evidence for one run rather than source.

There is no outbound network in this container. Supabase and Vercel cannot be
reached, which is why the app carries self-diagnosing errors
(`explainError.ts`, `describeUrlProblem`) instead of relying on someone being
able to debug from here.
