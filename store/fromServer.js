// Turning the backend's DTOs into the garden's entities.
//
// The server is the only source of truth: an entity's `id` *is* its server id,
// and every field the backend has a column for is taken from it as-is.
//
// A few fields have no column anywhere on the server, and are kept on this
// device only, carried over from the entity's previous local copy (`prev`):
//   • a reminder's `action` and `title` — ReminderOut knows only four types, so
//     a "Prune" round-trips as `custom`, and it carries no title at all;
//   • a reminder's `startAt` and `snoozedUntil`, and a completion date the user
//     back-dated (ReminderOut's `last_done_at` is only ever set by /complete);
//   • a plant's own photo (`photoUri`) and where its picture sits on disk
//     (`imageFile`, see store/media.js).
// They are never sent anywhere; they only decorate what the server returned.

import { mediaUrl } from '../api/mapPlant';
import { DEFAULT_TIME_OF_DAY, actionMeta, iconForRoomName } from './model';

/** ReminderType → the local action it most likely came from. */
const ACTION_FOR_TYPE = {
  watering: 'water',
  fertilize: 'fertilize',
  soil_change: 'repot',
  custom: 'custom',
};

/** The later of two ISO timestamps, either of which may be missing. */
const later = (a, b) => {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
};

/** RoomOut → room. */
export function roomFromServer(dto, prev = null) {
  return {
    id: dto.id,
    name: dto.name,
    // RoomOut has no icon yet; one the server does send wins.
    icon: dto.icon || prev?.icon || iconForRoomName(dto.name),
    light: dto.light ?? prev?.light ?? 'unknown',
    sortOrder: dto.sort_order ?? prev?.sortOrder ?? 0,
  };
}

/** UserPlantOut → plant (without its reminders). */
export function plantFromServer(dto, prev = null) {
  return {
    id: dto.id,
    speciesKey: dto.species_key ?? prev?.speciesKey ?? null,
    nickname: dto.nickname ?? dto.common_name ?? dto.scientific_name ?? prev?.nickname ?? 'Plant',
    roomId: dto.room_id ?? null,
    acquiredAt: dto.acquired_at ?? null,
    care: dto.care ?? prev?.care ?? null,
    // Absolutised on the way in: UserPlantOut carries the catalog's own
    // root-relative '/media/...' path, which <Image> cannot load.
    heroUri: mediaUrl(dto.image_url ?? dto.care?.image_url) ?? prev?.heroUri ?? null,
    photoUri: prev?.photoUri ?? null,
    imageFile: prev?.imageFile ?? null,
  };
}

/**
 * ReminderOut → reminder.
 *
 * `local` overrides the device-only fields outright — what a create or an edit
 * on this device just decided — where `prev` only fills them in.
 */
export function reminderFromServer(dto, prev = null, local = {}, now = new Date().toISOString()) {
  const serverAction = ACTION_FOR_TYPE[dto.type] ?? 'custom';
  // A local action survives only while it still maps onto the server's type.
  const prevAction =
    prev?.action && actionMeta(prev.action).serverType === dto.type ? prev.action : null;
  const action = local.action ?? prevAction ?? serverAction;
  const meta = actionMeta(action);
  return {
    id: dto.id,
    plantId: dto.user_plant_id ?? prev?.plantId ?? null,
    action,
    title: local.title ?? prev?.title ?? meta.label,
    intervalDays: dto.interval_days,
    timeOfDay: dto.time_of_day ? String(dto.time_of_day).slice(0, 5) : DEFAULT_TIME_OF_DAY,
    enabled: dto.enabled !== false,
    startAt: local.startAt ?? prev?.startAt ?? now,
    lastDoneAt: later(dto.last_done_at ?? null, local.lastDoneAt ?? prev?.lastDoneAt ?? null),
    snoozedUntil: local.snoozedUntil !== undefined ? local.snoozedUntil : prev?.snoozedUntil ?? null,
  };
}

/**
 * GET /users/me/rooms + GET /users/me/plants → the garden's three lists.
 *
 * `prev` is the garden as this device last knew it; only the device-only
 * fields are read from it. Anything the server did not list is gone.
 */
export function gardenFromServer(roomDtos, plantDtos, prev = { rooms: [], plants: [], reminders: [] }, now) {
  const byId = (list) => new Map((list ?? []).map((x) => [x.id, x]));
  const prevRooms = byId(prev.rooms);
  const prevPlants = byId(prev.plants);
  const prevReminders = byId(prev.reminders);

  const rooms = (roomDtos ?? []).map((dto) => roomFromServer(dto, prevRooms.get(dto.id)));
  const plants = [];
  const reminders = [];
  for (const dto of plantDtos ?? []) {
    plants.push(plantFromServer(dto, prevPlants.get(dto.id)));
    for (const r of dto.reminders ?? []) {
      reminders.push(
        reminderFromServer({ ...r, user_plant_id: r.user_plant_id ?? dto.id }, prevReminders.get(r.id), {}, now),
      );
    }
  }
  return { rooms, plants, reminders };
}
