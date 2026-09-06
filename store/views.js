// Card models for the Rooms screens.
//
// These sit between the store and the presentational primitives (RoomCard,
// PlantCard, PlantGrid), which want a flat `{ name, meta, photos }` or
// `{ title, subtitle, photo }` and know nothing about reminders. Keeping the
// shaping here means the screens stay declarative and the shapes stay tested.
//
// Pure — every function takes the whole state and a clock.

import { frequencyLabel, roomMeta, roomSubtitle } from './format';
import { livePlants, plantPhoto, plantSpecies, plantsInRoom } from './model';
import { todayTasks } from './schedule';

/**
 * One plant tile.
 *
 * `speciesKey` rides along because tapping a card used to go through
 * screens/scan/openPlant.js; an owned plant now navigates by `id` instead, but
 * the key is still what identifies the species behind it.
 */
export const plantCard = (plant) => ({
  id: plant.id,
  title: plant.nickname,
  subtitle: plantSpecies(plant),
  photo: plantPhoto(plant),
  speciesKey: plant.speciesKey,
});

/**
 * One room card: its plants' photos as the 2×2 mosaic, and a meta line that
 * mentions what needs attention only when something does.
 */
export function roomCard(state, room, now = new Date()) {
  const plants = plantsInRoom(state, room.id);
  const dueIds = new Set(todayTasks(state, now).map((t) => t.plantId));
  const due = plants.filter((p) => dueIds.has(p.id)).length;
  return {
    id: room.id,
    name: room.name,
    meta: roomMeta(plants.length, due),
    photos: plants.map(plantPhoto).filter(Boolean),
  };
}

/** Every room holding at least one plant, as cards. */
export const roomCards = (state, now = new Date()) =>
  state.rooms
    .filter((room) => plantsInRoom(state, room.id).length > 0)
    .map((room) => roomCard(state, room, now));

/** "3 plants" — the room-detail nav subtitle. */
export const roomDetailSubtitle = (state, roomId) =>
  roomSubtitle(plantsInRoom(state, roomId).length);

const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * Search across both kinds of thing the Rooms screen holds.
 *
 * Rooms match on their name; plants match on either the nickname the user gave
 * them or the species underneath ("monstera" finds "Kitchen Monstera" and "Mo"
 * alike). Plants are searched across every room and come back flat, in room
 * order, so the results grid reads top-down the way the list does.
 *
 * A blank query returns nothing — callers treat that as "idle" (show the room
 * list), not as "no results".
 */
export function searchGarden(state, query = '', now = new Date()) {
  const q = norm(query);
  if (!q) return { rooms: [], plants: [] };

  const rooms = state.rooms
    .filter((room) => norm(room.name).includes(q) && plantsInRoom(state, room.id).length > 0)
    .map((room) => roomCard(state, room, now));

  const plants = livePlants(state)
    .filter((p) => norm(p.nickname).includes(q) || norm(plantSpecies(p)).includes(q))
    .map(plantCard);

  return { rooms, plants };
}

/** A plant's reminders as the "what it needs" lines on its own page. */
export const reminderLines = (reminders = []) =>
  reminders.map((r) => ({ id: r.id, title: r.title, frequency: frequencyLabel(r.intervalDays) }));
