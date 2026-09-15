import { apiFetch } from './client';

/**
 * The user's garden — the plants they own and the reminders on them.
 *
 * All of these need a bearer token; api/client.js attaches it and handles the
 * 401-refresh-replay, so nothing here has to know about the session.
 *
 * The backend describes GET /users/me/plants as "the sync endpoint": one call
 * returns every plant with its reminders and full care data embedded, which is
 * why store/sync.js pulls the whole garden rather than diffing per entity.
 *
 * Two gaps shape store/sync.js and are worth stating here rather than being
 * rediscovered: a plant has no archived column (so an archive stays on the
 * device), and a reminder carries no title (so a custom reminder's name lives
 * only on the device). Rooms have their own resource — see api/rooms.js.
 */

/** GET /users/me/plants → UserPlantOut[] */
export async function getGarden() {
  return apiFetch('/users/me/plants');
}

/**
 * POST /users/me/plants → UserPlantOut (201)
 *
 * `roomId` is the room's *server* id (RoomOut.id). The legacy free-text
 * `location` is no longer sent.
 */
export async function addPlant({ speciesKey, nickname, roomId, acquiredAt }) {
  return apiFetch('/users/me/plants', {
    method: 'POST',
    body: JSON.stringify({
      species_key: speciesKey,
      nickname: nickname ?? null,
      room_id: roomId ?? null,
      acquired_at: acquiredAt ?? null,
    }),
  });
}

/**
 * PATCH /users/me/plants/{id} → UserPlantOut
 *
 * A rename or a move. `roomId: null` is sent as an explicit null, which takes
 * the plant out of its room; `undefined` leaves the field alone.
 */
export async function updatePlant(userPlantId, { nickname, roomId }) {
  const body = {};
  if (nickname !== undefined) body.nickname = nickname;
  if (roomId !== undefined) body.room_id = roomId;
  return apiFetch(`/users/me/plants/${encodeURIComponent(userPlantId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** DELETE /users/me/plants/{id} — cascades to the plant's reminders. */
export async function removePlant(userPlantId) {
  return apiFetch(`/users/me/plants/${encodeURIComponent(userPlantId)}`, { method: 'DELETE' });
}

/**
 * POST /users/me/plants/{id}/reminders → ReminderOut (201)
 *
 * @param {object} r  { type, intervalDays, timeOfDay?, enabled }
 *   `type` is the server's enum (watering | soil_change | fertilize | custom) —
 *   store/model.js's ACTIONS maps the app's richer catalog onto it.
 */
export async function createReminder(userPlantId, r) {
  return apiFetch(`/users/me/plants/${encodeURIComponent(userPlantId)}/reminders`, {
    method: 'POST',
    body: JSON.stringify({
      type: r.type,
      interval_days: r.intervalDays,
      time_of_day: r.timeOfDay ?? null,
      enabled: r.enabled !== false,
    }),
  });
}

/** PATCH /reminders/{id} → ReminderOut. Every field is optional. */
export async function updateReminder(reminderId, patch) {
  const body = {};
  if (patch.type !== undefined) body.type = patch.type;
  if (patch.intervalDays !== undefined) body.interval_days = patch.intervalDays;
  if (patch.timeOfDay !== undefined) body.time_of_day = patch.timeOfDay;
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  return apiFetch(`/reminders/${encodeURIComponent(reminderId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** DELETE /reminders/{id} */
export async function deleteReminder(reminderId) {
  return apiFetch(`/reminders/${encodeURIComponent(reminderId)}`, { method: 'DELETE' });
}

/**
 * POST /reminders/{id}/complete → ReminderOut
 *
 * Stamps `last_done_at`; the next due date is derived from it locally
 * (store/schedule.js), which is what the endpoint's own docs prescribe.
 */
export async function completeReminder(reminderId) {
  return apiFetch(`/reminders/${encodeURIComponent(reminderId)}/complete`, { method: 'POST' });
}
