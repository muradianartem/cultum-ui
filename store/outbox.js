// The outbox: queued intents waiting to reach the server.
//
// Its own module so both the reducer and the sync rebase (store/applySync.js)
// can build entries without importing each other.
//
// Entries are immutable and never cloned: every helper here filters or appends,
// so an entry nobody touched keeps its identity. store/applySync.js relies on
// that to tell which entries a sync round actually processed.

/**
 * Queue one intent to push.
 *
 * Entries are collapsed per (op, localId): the drain reads the *current* state
 * to build its payload, so two edits to the same reminder are one push, and
 * re-queueing only matters for ordering. `serverId` is carried on the entry
 * itself because a delete has to survive the entity leaving state.
 */
export function enqueue(outbox, op, localId, serverId = null) {
  const rest = outbox.filter((e) => !(e.op === op && e.localId === localId));
  return [...rest, { op, localId, serverId, attempts: 0 }];
}

export const dropAll = (outbox, localId) => outbox.filter((e) => e.localId !== localId);

/**
 * Queue a deletion. Something the server has never seen is simply forgotten,
 * along with whatever was queued for it — pushing a create and then a delete
 * for the same row would be two round trips to reach where we already are.
 */
export function enqueueDelete(outbox, op, localId, serverId) {
  const cleared = dropAll(outbox, localId);
  return serverId ? [...cleared, { op, localId, serverId, attempts: 0 }] : cleared;
}
