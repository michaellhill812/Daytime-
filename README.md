# Daytime

A personal productivity heads-up display. One user, three views — **Wheel**, **Wall**, and **World** — over a single shared dataset, reached by gesture rather than chrome.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle
npm run preview  # serve the build
```

---

## Technical approach

### Platform: React + TypeScript + Vite, installable as a PWA

A web app that installs to the iPhone home screen. It runs on desktop and phone from one codebase, needs no App Store round trip to iterate on, and — decisively for this design — pointer events give exact control over the three custom gestures. The trade-off accepted: no accelerometer, so a physical "twist the phone" gesture is out of scope.

There is no UI framework and no state library. The whole app is React plus about 400 lines of plain CSS; the wheel is hand-drawn SVG. Nothing here needed a dependency, and a HUD that has to feel weightless shouldn't ship a component library's opinions.

### Gestures: one pointer stream, one resolver

All three gestures come out of a single hook, `useNavGestures`, rather than three independent listeners that would race each other. One pointer sequence produces at most one gesture:

| Gesture | Goes to | Resolved |
|---|---|---|
| Tap the background | Wall | on release — barely moved, quickly let go |
| Turn in a circle | Wheel | mid-gesture, at 100° of accumulated angle |
| Swipe up | World | on release — vertical, fast, not a rotation |
| Swipe down | back out of World | same |

**The spin** is a circular drag: the hook tracks the pointer's angle around the screen centre and accumulates signed deltas, ignoring wobble within 44px of the pivot. It fires the moment the threshold is crossed, so it feels like a dial clicking over rather than a verdict passed after you let go. A ring fills on screen as you turn, because a turn with no feedback feels like nothing is happening until suddenly it is.

The threshold is a little over a quarter turn. A half turn was the first attempt and was worse in both directions — long enough to be a chore, and long enough that the hand drifts off the arc and the accumulator stalls. `SWIPE_MAX_CURVE_DEG` moves with it: past that much curve a drag is a turn that fell short, not a swipe.

Two escape hatches keep the gestures from fighting the content underneath: `data-gesture="block"` on anything owning its own pointer handling (sheets, inputs, the rail), and `data-gesture="opaque"` on things that should absorb taps but still let a spin or swipe pass through (Wall cards, and inside the wheel the tap wedges, hub, and domain labels — but *not* the `<svg>` itself, whose square box would otherwise swallow every tap in the empty corners around the wheel). A swipe is also ignored when a scrollable ancestor could still absorb it, so scrolling a list never teleports you to another view.

Two non-obvious things this cost, both now handled in code:

- A drag across selectable text makes Chrome fire `pointercancel`, which silently killed whichever gesture came next. The gesture surface sets `user-select: none`; selection is re-enabled only where there are words worth copying.
- `setPointerCapture` on the surface looks like the right robustness fix and is not — it retargets `click` to the capturing element and swallows every button underneath.

Gestures are the intended way to move, but they are not the only way: three dots at the bottom edge show where you are and work as buttons, and `1` / `2` / `3` switch views on a keyboard.

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
  hooks/useNavGestures.ts tap / spin / swipe resolved from one pointer stream
  hooks/useNow.ts         ticking clock, so "6:30pm" becomes "2d overdue" on its own
  store/
    storage.ts            StorageAdapter + local and in-memory implementations
    store.ts              observable state container and all mutations
    selectors.ts          salience, ring state, cross-view links, calendar queries
    context.tsx           React bindings
  lib/                    date, polar geometry, ids
  components/             Wheel, sheets, task rows, overlays
  views/                  WheelView, WallView, WorldView
  data/seed.ts            the four domains and the real Wall documents
public/docs/              the source files those documents link to
```

## What is in it

Nothing in this app is sample data. There are no invented tasks, goals, events or day notes — invented data makes it impossible to tell at a glance what is real, which is the one thing a personal HUD cannot afford. The Wheel starts empty and fills with whatever you actually put in it.

The Wall ships with seven real reference documents, each carrying its full text so it is readable and searchable in the app, and linking to its source file in `public/docs/`:

| Document | Domain |
|---|---|
| 5-Day Machine Routine | Exercise |
| Daily schedule | Personal |
| Two-day workshop — summary | Personal |
| Steady the Base, Then Build (workbook) | Personal |
| Career research findings | Work |
| Resume | Work |
| AI project portfolio | Work |

The seed is written on first run and never again, so edits are never overwritten. `SCHEMA_VERSION` in `src/store/storage.ts` guards that: bumping it discards saved state and re-seeds, which is how the placeholder dataset was retired.

### The embed build

`VITE_EMBED=1 npm run build` produces a variant with attachment links omitted, for inlining into a single self-contained HTML file that has no file server behind it. Document text is identical; only the links to `public/docs/` are dropped, so the embed never shows a dead link.

Not built yet, and worth deciding on before they are:

- **Editing domains from the UI.** The store supports add / rename / recolour / remove and the wheel adapts to any count; there is no settings surface yet.
- **Goal progress** is displayed but not editable — it should probably derive from its domain's task completion rather than being typed in.
- **Recurring tasks and events**, which change the data model rather than extending it.
- **Multi-day and timed event layout** in World: events are listed per day, not laid out on a time grid.
