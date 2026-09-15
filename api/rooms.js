import { apiFetch } from './client';

/**
 * The user's rooms — a real server entity, not a plant's `location` string.
 *
 * All of these need a bearer token; api/client.js attaches it. Every call is
 * driven by store/sync.js from the outbox, never by a screen directly.
 *
 * `icon` is a Cultum icon name (components/iconRegistry.js). RoomOut does not
 * carry it yet — the backend is adding it — so it is sent on every write and
 * read back when present; store/model.js#roomIcon fills the gap until then.
 * FastAPI ignores unknown body fields, so sending it early is harmless.
 */

/** GET /users/me/rooms → RoomOut[] */
export async function listRooms() {
  return apiFetch('/users/me/rooms');
}

/** POST /users/me/rooms → RoomOut (201) */
export async function createRoom({ name, icon, light, sortOrder }) {
  const body = { name };
  if (icon !== undefined && icon !== null) body.icon = icon;
  if (light !== undefined && light !== null) body.light = light;
  if (sortOrder !== undefined && sortOrder !== null) body.sort_order = sortOrder;
  return apiFetch('/users/me/rooms', { method: 'POST', body: JSON.stringify(body) });
}

/** PATCH /users/me/rooms/{id} → RoomOut. Every field is optional. */
export async function updateRoom(roomId, patch) {
  const body = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.icon !== undefined) body.icon = patch.icon;
  if (patch.light !== undefined) body.light = patch.light;
  if (patch.sortOrder !== undefined) body.sort_order = patch.sortOrder;
  return apiFetch(`/users/me/rooms/${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** DELETE /users/me/rooms/{id} (204). The server leaves its plants roomless. */
export async function deleteRoom(roomId) {
  return apiFetch(`/users/me/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' });
}
