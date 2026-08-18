# Daytime

A personal productivity heads-up display. One user, three views — **Wheel**, **Wall**, and **World** — over a single shared dataset.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle
npm run preview  # serve the build
```

---

## Technical approach

### Platform: React + TypeScript + Vite, installable as a PWA

A web app that installs to the iPhone home screen. It runs on desktop and phone from one codebase and needs no App Store round trip to iterate on. The trade-off accepted: no native platform affordances, so anything the browser cannot do is out of scope.

There is no UI framework and no state library. The whole app is React plus about 400 lines of plain CSS; the wheel is hand-drawn SVG. Nothing here needed a dependency, and a HUD that has to feel weightless shouldn't ship a component library's opinions.

### Navigation: a bottom bar

Three views, three tabs, full width and split into equal thirds so a tab can be hit without looking. The active tab carries a hairline above it. `1` / `2` / `3` do the same on a keyboard.

This replaced a custom gesture layer — background-tap for Wall, a circular drag for Wheel, swipe-up for World — that resolved all three from a single pointer stream. It worked, and it was still the wrong answer: the spin never stopped feeling unreliable in the hand (a long arc gives the finger too many chances to drift off it), and the whole scheme read as gimmick rather than affordance. A visible bar is duller and better. The lesson is kept here rather than in the code, which is now much smaller for it.

### Data: one model, three projections

```
Domain ──< Goal
       └─< Task ──> Doc   (Wall)
                └─> CalEvent (World)
```

Cross-view links live on `Task` as `docIds` and `eventIds`, with `domainId` optional on documents and events. Reverse lookups (*which tasks reference this document?*) are derived in selectors rather than stored, so a link has exactly one place it can go stale. Deleting a document or event prunes the references pointing at it.

That is what makes the views genuinely reference each other rather than merely coexist: a task shows its linked document and event as chips wherever it appears; a document lists the tasks referencing it; the calendar shows both its own events and every deadline set on the Wheel; a domain's sheet pulls in the Wall and World items connected to it. Tapping a link opens that item in place — no view teleport.

### The centre button and the outer ring

The hub's count is **overdue + due today + high-priority work landing within three days**. Ordering inside those groups is by `priority × urgency`, where urgency is a step function of time-to-deadline (overdue 2.0 → someday 0.6). The score orders the list; it is never shown as a number, because a productivity app that makes you read a score has moved the work rather than removed it.

The ring answers two questions at once, as decided: **fill = completion, hue = priority**. Each domain owns an arc; the filled portion is the share of its tasks that are done, and its colour is the hottest priority still open — red high, amber medium, blue low, green when nothing is open. The fill grows outward from its own spoke, so a part-finished arc is unmistakably attached to its own domain rather than drifting toward its neighbour's. Overdue work turns the spoke's end cap red and breathing.

Wheel geometry is a pure function of the domain count, so adding or removing a domain re-lays the wheel out with no other change.

### Persistence: local now, swappable later

Everything is in `localStorage` behind a `StorageAdapter` interface (`load` / `save` / `clear`), which is async even though the local implementation is not. Hydration is awaited before the first render, writes are debounced and flushed when the tab hides. Dropping in a networked adapter later is a one-line change in `main.tsx` — no view knows where its data comes from. A `MemoryStorageAdapter` is included for tests.

A service worker caches the app shell, so it opens offline; there is nothing to sync, because there is no server.

---

## Layout

```
src/
  App.tsx                 navigation shell — Wheel/Wall are one layer, World rides above
  types.ts                the data model
  hooks/useNow.ts         ticking clock, so "6:30pm" becomes "2d overdue" on its own
  store/
    storage.ts            StorageAdapter + local and in-memory implementations
    store.ts              observable state container and all mutations
    selectors.ts          salience, ring state, cross-view links, calendar queries
    context.tsx           React bindings
  lib/                    date, polar geometry, ids
  components/             Wheel, sheets, task rows, the bottom bar
  views/                  WheelView, WallView, WorldView
  data/seed.ts            the domains and the Wall documents, source text only
public/docs/              the source files those documents link to
```

## What is in it

Nothing in this app is sample data. There are no invented tasks, goals, events or day notes — invented data makes it impossible to tell at a glance what is real, which is the one thing a personal HUD cannot afford. The Wheel starts empty and fills with whatever you actually put in it.

**Document bodies are source text only.** Every line is transcribed from the file it links to — nothing paraphrased, summarised, re-headed or editorialised, and no connective sentences added. Content may be omitted, never reworded, so anything read in the app can be trusted as the document's own words. Commentary about a document belongs in conversation, not in its body.

A document whose content is a drawing names a `diagram` key instead of carrying markup, so the drawing lives in code and the data stays plain. Edge labels in the state triangle are set horizontally beside each side rather than rotated along it as in the original — at phone width, text on a 60° slant is not readable. The structure and wording are the source's.

A domain can also name one document as its `guideDocId`: the document that *is* the domain rather than one filed under it. Those domains lead with that text instead of a task list, and omit the task-count line, since "clear" means nothing on a procedure.

The Wall ships with thirteen reference documents, each carrying its full text so it is readable and searchable in the app, and linking to its source file in `public/docs/`:

| Document | Domain |
|---|---|
| 60 Second Reset Framework | 60s Reset (guide) |
| Daily Schedule | Daily Routine (guide) |
| Working Block Tasks | Work |
| Limiting Beliefs | Sessions |
| Limiting Beliefs Redefined | Sessions |
| Vision + Value Statements | Sessions |
| Emotional State (diagram) | Sessions |
| Michael's 5-Day Machine Routine | Self-Care |
| Your Two Days, and the Plan From Here | Sessions |
| Steady the Base, Then Build | Sessions |
| Career Research Findings | Work |
| Michael Hill — Resume | Work |
| AI Project Experience | Work |

The seed is written on first run and never again, so edits are never overwritten. `SCHEMA_VERSION` in `src/store/storage.ts` guards that: bumping it discards saved state and re-seeds, which is how the placeholder dataset was retired.

### The embed build

`VITE_EMBED=1 npm run build` produces a variant with attachment links omitted, for inlining into a single self-contained HTML file that has no file server behind it. Document text is identical; only the links to `public/docs/` are dropped, so the embed never shows a dead link.

Not built yet, and worth deciding on before they are:

- **Editing domains from the UI.** The store supports add / rename / recolour / remove and the wheel adapts to any count; there is no settings surface yet.
- **Goal progress** is displayed but not editable — it should probably derive from its domain's task completion rather than being typed in.
- **Recurring tasks and events**, which change the data model rather than extending it.
- **Multi-day and timed event layout** in World: events are listed per day, not laid out on a time grid.
