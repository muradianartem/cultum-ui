// Folding a finished sync round into the garden as it is *now*.
//
// A round awaits the network for seconds. Anything the user did meanwhile is
// already in the reducer's state, and the round's own document — built from the
// snapshot it started with — knows nothing about it. So the round does not
// replace the document: it reports what it learned (store/sync.js#syncGarden)
// and this rebases that onto the current state.
//
// What the push did is read off the difference between `base` and `pushed`.
// Outbox entries are never cloned (store/outbox.js), so identity says which
// ones the round processed:
//   • in `base` but not `pushed` → processed; retire it;
//   • in `pushed` but not `base` → re-queued waiting on a dependency; carry it.
// An entry the user superseded mid-round is a new object, so it survives.
//
// Assumes hydration doesn't land mid-round (it runs once, on mount). If it did,
// every entry would look new: harmless — they would just stay queued.

import { enqueue } from './outbox';
import { MAX_FAILED, markLocalOnly, mergeGarden } from './sync';

/**
 * Per kind: the fields a create sends, and the ops that correct a create the
 * user edited or deleted while it was in flight.
 */
const KINDS = {
  rooms: { update: 'room.update', remove: 'room.delete', fields: ['name', 'icon', 'light', 'sortOrder'] },
  plants: { update: 'plant.update', remove: 'plant.delete', fields: ['nickname', 'roomId'] },
  reminders: {
    update: 'reminder.update',
    remove: 'reminder.delete',
    fields: ['intervalDays', 'timeOfDay', 'enabled'],
  },
};

/**
 * @param {object} current  the reducer's state when the round finished
 * @param {import('./sync').SyncRound} round
 * @returns {object} the state to commit — `current` itself when the round
 *   learned nothing, so no effect keyed on it re-fires
 */
export function applySyncRound(current, round) {
  const { base, pushed, remote, now } = round;
  let next = current;

  // 1. Retire what the round processed.
  const retired = new Set(base.outbox.filter((e) => !pushed.outbox.includes(e)));
  if (retired.size > 0) next = { ...next, outbox: next.outbox.filter((e) => !retired.has(e)) };

  // 2. Carry what it re-queued — unless the row is gone, or the user already
  //    queued the same intent.
  for (const e of pushed.outbox) {
    if (base.outbox.includes(e) || !exists(next, e.localId)) continue;
    if (next.outbox.some((x) => x.op === e.op && x.localId === e.localId)) continue;
    next = { ...next, outbox: [...next.outbox, e] };
  }

  // 3. Adopt the server ids its creates earned.
  for (const kind of Object.keys(KINDS)) {
    const before = new Map(base[kind].map((x) => [x.id, x]));
    for (const row of pushed[kind]) {
      const was = before.get(row.id);
      if (row.serverId && was && !was.serverId) next = adoptServerId(next, kind, was, row.serverId);
    }
  }

  // 4. Keep the rejections the push recorded. Records are never cloned either,
  //    so the new ones are those `base` did not hold.
  const baseFailed = base.failed ?? [];
  const added = (pushed.failed ?? []).filter((f) => !baseFailed.includes(f));
  if (added.length > 0) next = { ...next, failed: [...(next.failed ?? []), ...added].slice(-MAX_FAILED) };
  // A room the server refused stays, marked local-only, whatever happened to it
  // mid-round (a rename, say) — so its plants stop waiting on a create.
  for (const f of added) {
    if (f.op === 'room.create' && next.rooms.some((r) => r.id === f.localId)) {
      next = markLocalOnly(next, f.localId);
    }
  }

  // 5. Pull. Rows with a queued push stay local (mergeGarden's own rule), which
  //    is what keeps every mid-round edit above.
  if (remote) next = mergeGarden(next, remote.plants, now, remote.rooms);
  return next;
}

const exists = (state, id) => Object.keys(KINDS).some((k) => state[k].some((x) => x.id === id));

function adoptServerId(state, kind, was, serverId) {
  const { update, remove, fields } = KINDS[kind];
  const row = state[kind].find((x) => x.id === was.id);

  // Deleted while its create was in flight: the reducer had no serverId to
  // queue a delete with, but the server has the row now.
  if (!row) {
    // A reminder whose plant went too needs nothing: the plant's delete cascades.
    if (kind === 'reminders' && !state.plants.some((p) => p.id === was.plantId)) return state;
    return { ...state, outbox: [...state.outbox, { op: remove, localId: was.id, serverId, attempts: 0 }] };
  }

  const adopted = { ...row, serverId };
  // The server now holds the created values, so a plant's dirty flags are spent
  // — unless the user set new ones mid-round, which the create never saw.
  if (kind === 'plants' && row.dirty === was.dirty) adopted.dirty = {};
  const next = { ...state, [kind]: state[kind].map((x) => (x.id === was.id ? adopted : x)) };

  // Edited while its create was in flight: the create sent the old values, and
  // the reducer queued no update because there was no serverId to aim it at.
  if (fields.some((f) => was[f] !== row[f])) {
    return { ...next, outbox: enqueue(next.outbox, update, was.id, serverId) };
  }
  return next;
}
