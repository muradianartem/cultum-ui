# The garden store — local-first plants, rooms and care reminders

What shipped when the app stopped running on fixtures. Every feature screen used
to hold its data in `useState` seeded from a `screens/*Data.js` module, and
`routing/Route.js` returns `null` for a non-matching route — so a completed
task, a renamed room or a newly added plant lasted exactly until the next
navigation. Nothing was written to disk, nothing reached the backend, and no
reminder was ever scheduled.

This document is the map of what replaced that.

## The domain

Three entities, all defined in [`store/model.js`](../store/model.js):

| Entity | Lives | Notes |
|---|---|---|
| **Plant** | device + server | The product entity. Caches the whole `SpeciesDetail` (`care`) so its page renders offline. |
| **Reminder** | device + server | One care action on one plant: an interval, a time of day, and when it was last done. |
| **Room** | device only | The backend has no room entity — a room is just the `location` string on a plant. |

A plant's "interface" is its reminders, drawn from the `ACTIONS` catalog:
water, fertilize, repot, prune, mist, rotate, clean leaves, and a free-text
custom. The first three map onto the server's own reminder types
(`watering` / `fertilize` / `soil_change`); everything past them rides as
`custom` and keeps its identity in the local `action` and `title` fields.

## Layers

```
screens/                     read through useGarden(), never touch state directly
  └── store/GardenProvider   hydrate → expose state + actions → persist, reschedule, sync
        ├── store/reducer    pure (state, action) → state; stamps, dirty flags, outbox
        ├── store/schedule   pure due-date engine: what is due today, what is coming
        ├── store/persist    one JSON document via expo-file-system
        ├── store/sync       outbox drain + GET /users/me/plants merge
        └── notifications/   one local notification per upcoming occurrence
```

Everything below the provider is pure and clock-injectable, which is why the
scheduling, merge and formatting rules are unit-tested rather than exercised
through the UI.

### Why a provider above the Router

`routing/Route.js:32` unmounts a screen the moment you navigate away. Anything
the domain has to remember therefore cannot live in a screen. `<GardenProvider>`
sits above `<Router>` in [`App.js`](../App.js), hydrates once, and every screen
reads through `useGarden()`.

That also changed how screens are addressed: `RoomsScreen` used to
`navigate('room', { room })` with the whole object, and `ProductPage` took a
view-model plus a `nickname` and a `room` string. Both now navigate by id
(`{ roomId }`, `{ plantId }`) and read the current record, which is what makes a
rename visible on the screen you came from.

## Scheduling

A reminder is a **cadence, not a queue**: missing three waterings produces one
overdue task, not three. `nextDueAt` is

```
(lastDoneAt ? lastDoneAt + intervalDays : startAt)  at timeOfDay,
pushed later by snoozedUntil while that is still in the future
```

which is also what the backend prescribes — `POST /reminders/{id}/complete`'s own
docs say *"the app derives the next due date from `last_done_at + interval_days`
locally."*

`todayTasks` collects everything due by end of day (overdue included);
`upcomingTasks` projects each cadence forward across a horizon, so a weekly
watering appears on each of its dates rather than only the next one.

## Persistence

The whole garden is one JSON document in the app's document directory.
`expo-file-system` was already autolinked into the native project (it ships as a
dependency of `expo` itself), so this needed no new native module. Writes go to
a sibling `.tmp` and are moved over the target with `overwrite: true`, so a
crash mid-write leaves the previous document intact.

Saves are debounced (`createSaver`) and flushed when the app backgrounds or the
provider unmounts.

## Sync

Local-first: every mutation is applied and persisted before sync is considered.
Sync is catch-up, never a gate, and its failures are silent — the app is fully
usable with the radio off.

The backend endpoints (verified against the live OpenAPI) are wrapped in
[`api/garden.js`](../api/garden.js). `GET /users/me/plants` is described by the
backend as "the sync endpoint": one call returns every plant with its reminders
and full care data embedded, which is why `store/sync.js` pulls the whole garden
rather than diffing per entity.

**Push** drains an outbox of intents (`plant.create`, `reminder.update`, …).
Payloads are read from *current* state rather than snapshotted at queue time, so
a row edited three times before a connection appears is pushed once, with its
final values. A transport failure stops the drain and keeps the queue; a 4xx
drops that entry, because retrying it forever would never fix it.

**Pull** merges by `serverId`. Server values win, with three exceptions:

1. fields marked **dirty** — see below;
2. fields the server has no column for (`title`, `snoozedUntil`, `photoUri`,
   `archived`, `roomId`);
3. reminders with a queued push, which are newer than what came back.

### The dirty-field rule

There is **no `PATCH /users/me/plants/{id}`**. A rename, a move between rooms and
an archive therefore cannot be pushed at all. The reducer marks those fields
dirty and the merge refuses to overwrite a dirty field; without that, renaming a
plant and then syncing would silently undo the rename. When the backend grows
that endpoint, the fix is to add a `plant.update` outbox op and clear the flags
on a successful push — the same shape `plant.create` already uses.

Two other backend gaps worth knowing: a reminder carries no title, so a custom
reminder's name lives only on the device that made it; and while
`auth/AuthProvider.js`'s `DEV_BYPASS_AUTH` is on, its fake tokens 401 against
every garden endpoint, so sync will quietly do nothing.

## Notifications

`expo-notifications`, local only. iOS allows 64 pending local notifications, so
the app takes the next `MAX_SCHEDULED` (56) occurrences across every plant and
rebuilds the whole set whenever the garden changes. Rebuilding wholesale rather
than diffing keeps "what is scheduled" a pure function of the store.

Permission is requested the first time a plant is added with a reminder — the
first moment it means anything — not on launch. A tapped notification opens that
plant, handled by `notifications/NotificationRouter`, which is rendered inside
`<Router>` because every route unmounts.

## Testing

`store/testing.js` (deliberately outside `__tests__`, so jest doesn't run it)
provides `seedGarden` for building a document from a compact description and
`renderWithGarden` for mounting a screen over a real provider.

Two things to know when writing tests here:

- **Freeze the clock.** `renderWithGarden(…, { clock })` freezes the provider's
  `now` and every mutation's timestamp; without it a test that reasons about
  "today" passes today and fails tomorrow.
- **Unmount.** `afterEach(cleanupTrees)`. The provider holds a clock interval and
  an `AppState` subscription that are only released on unmount, and a mounted
  tree keeps the jest worker alive.

## Not done

Gallery and the full-screen image viewer (the catalog has one image per species,
so there is nothing to scroll yet), the journal tab's contents, the Discover
tab, and the backend's missing plant `PATCH`.
