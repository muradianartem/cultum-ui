// The garden's domain model: the plants a user owns, the rooms they sit in and
// the care reminders attached to them.
//
// Pure — no React, no React Native, no network. Everything here is a plain
// object or a function over plain objects, so the whole model is unit-testable
// and can be serialised straight to disk (see store/persist.js). The one import
// is store/media.js's `fileUri`, which is path arithmetic against a constant
// and touches no file; the I/O in that module stays on its own side.
//
// The shapes deliberately mirror the backend's `UserPlantOut` / `ReminderOut`
// (see api/garden.js) so a sync is a field rename rather than a translation.
// Where the server has no equivalent the field is marked local-only; those are
// the ones store/sync.js must never overwrite from a pull.

import { fileUri } from './media';

/** Bump when a stored document's shape changes; store/persist.js migrates. */
export const STATE_VERSION = 2;

// Ids only have to be unique within one device's document. A timestamp gives
// them a natural sort order, the counter separates two made in the same
// millisecond, and the random tail keeps two devices from colliding before a
// server id takes over.
let seq = 0;
export const resetIds = () => {
  seq = 0;
}; // test seam
export const uid = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${(seq += 1).toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

// ---------------------------------------------------------------------------
// Care actions — the "interface" a plant exposes.
//
// The catalog is local; the backend only knows four reminder types
// (watering | soil_change | fertilize | custom), so anything past the first
// three rides as `custom` and keeps its identity in the local `action` +
// `title` fields. `tone` resolves against the theme's semantic colour families
// ('neutral' means the plain surface tint — see the Chip helpers in the
// reminders screens).
// ---------------------------------------------------------------------------
export const ACTIONS = {
  water: {
    key: 'water',
    label: 'Watering',
    verb: 'Water',
    icon: 'outlined-water',
    tone: 'information',
    serverType: 'watering',
    defaultIntervalDays: 7,
  },
  fertilize: {
    key: 'fertilize',
    label: 'Fertilizing',
    verb: 'Feed',
    icon: 'shovel',
    tone: 'warning',
    serverType: 'fertilize',
    defaultIntervalDays: 30,
  },
  repot: {
    key: 'repot',
    label: 'Repotting',
    verb: 'Repot',
    icon: 'plant',
    tone: 'success',
    serverType: 'soil_change',
    // Twelve months, kept as a clean multiple of 30 so the frequency wheel can
    // show and re-pick it as "12 months" rather than a bare day count.
    defaultIntervalDays: 360,
  },
  prune: {
    key: 'prune',
    label: 'Pruning',
    verb: 'Prune',
    icon: 'outlined-cut',
    tone: 'neutral',
    serverType: 'custom',
    defaultIntervalDays: 90,
  },
  mist: {
    key: 'mist',
    label: 'Misting',
    verb: 'Mist',
    icon: 'cloude',
    tone: 'information',
    serverType: 'custom',
    defaultIntervalDays: 3,
  },
  rotate: {
    key: 'rotate',
    label: 'Rotating',
    verb: 'Rotate',
    icon: 'sync',
    tone: 'neutral',
    serverType: 'custom',
    defaultIntervalDays: 14,
  },
  clean: {
    key: 'clean',
    label: 'Leaf cleaning',
    verb: 'Clean the leaves of',
    icon: 'stickers',
    tone: 'neutral',
    serverType: 'custom',
    defaultIntervalDays: 30,
  },
  custom: {
    key: 'custom',
    label: 'Reminder',
    verb: 'Check on',
    icon: 'bell',
    tone: 'neutral',
    serverType: 'custom',
    defaultIntervalDays: 7,
  },
};

/** The action a reminder belongs to, falling back to the generic one. */
export const actionMeta = (key) => ACTIONS[key] ?? ACTIONS.custom;

/**
 * The actions offered up-front when adding a plant, in Figma order. Everything
 * else in the catalog is reachable through "Add new reminder".
 */
export const PRIMARY_ACTIONS = ['water', 'fertilize', 'repot'];

/** Every action a user can pick, generic "custom" last. */
export const ACTION_ORDER = [
  'water',
  'fertilize',
  'repot',
  'prune',
  'mist',
  'rotate',
  'clean',
  'custom',
];

// Rooms come from the backend (GET /users/me/rooms); a fresh install has none
// until the first pull lands. `icon` values are Cultum icon names
// (components/iconRegistry.js).

/**
 * The ids v1 builds seeded every install with. Only store/persist.js reads
 * this, to tell a room the user actually used from stock scenery.
 */
export const LEGACY_DEFAULT_ROOM_IDS = ['living-room', 'kitchen', 'bedroom', 'bathroom', 'office'];

/** A room's icon when the server hasn't sent one: matched on its name. */
const ROOM_ICON_BY_NAME = {
  'living room': 'living-room',
  kitchen: 'kitchen',
  bedroom: 'bedroom',
  bathroom: 'shower',
  office: 'office',
};

const DEFAULT_ROOM_ICON = 'home';

/** The icon for a room name — what a new room is created with. */
export const iconForRoomName = (name) =>
  ROOM_ICON_BY_NAME[String(name ?? '').trim().toLowerCase()] ?? DEFAULT_ROOM_ICON;

/**
 * The icon to draw for a room. RoomOut does not carry `icon` yet (the backend
 * is adding it), so the name mapping stands in until it does.
 */
export const roomIcon = (room) => room?.icon || iconForRoomName(room?.name);

/** Reminders fire mid-morning unless the user moves them. */
export const DEFAULT_TIME_OF_DAY = '09:00';

/** An empty garden — what a first launch starts from. */
export const emptyState = () => ({
  version: STATE_VERSION,
  plants: [],
  reminders: [],
  rooms: [],
  outbox: [],
  // Writes the server rejected for good (store/sync.js#drainOutbox), newest
  // last and capped. Recorded, not shown: there is no UI for them yet, but a
  // change that never reached the server should leave a trace.
  failed: [],
  lastSyncAt: null,
  profileName: null,
});

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/**
 * A plant the user owns.
 *
 * `care` is the cached SpeciesDetail the whole product page renders from, so an
 * owned plant stays fully readable offline. `dirty` records local-only fields
 * the server has no column for (today just `archived`), which must survive
 * every pull (store/sync.js). A rename or a move is pushed instead.
 */
export const makePlant = ({
  speciesKey,
  nickname,
  roomId = null,
  care = null,
  heroUri = null,
  photoUri = null,
  acquiredAt = null,
  now = new Date(),
}) => ({
  id: uid('plant'),
  serverId: null,
  speciesKey: speciesKey ?? null,
  nickname: String(nickname ?? '').trim(),
  roomId,
  acquiredAt: acquiredAt ?? isoDate(now),
  care,
  heroUri: heroUri ?? care?.image_url ?? null,
  photoUri, // a photo the user took, preferred over the catalog image
  // Where the picture actually lives on this device, relative to the document
  // directory (store/media.js). The two URIs above are where it *came* from;
  // this is the only one that still resolves offline, or after a sign-out has
  // thrown the document away and a pull rebuilt it.
  imageFile: null,
  archived: false,
  dirty: {},
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
});

/**
 * One care action scheduled on one plant.
 *
 * `startAt` anchors the first occurrence before anything has been completed;
 * afterwards `lastDoneAt` drives it. `snoozedUntil` pushes a single occurrence
 * later without touching the cadence. Both `title` and `snoozedUntil` are
 * local-only — the server's ReminderOut carries neither.
 */
export const makeReminder = ({
  plantId,
  action = 'water',
  title,
  intervalDays,
  timeOfDay = DEFAULT_TIME_OF_DAY,
  enabled = true,
  startAt = null,
  now = new Date(),
}) => {
  const meta = actionMeta(action);
  return {
    id: uid('rem'),
    serverId: null,
    plantId,
    action: meta.key,
    title: String(title ?? meta.label).trim() || meta.label,
    intervalDays: Number(intervalDays ?? meta.defaultIntervalDays),
    timeOfDay,
    enabled,
    startAt: startAt ?? now.toISOString(),
    lastDoneAt: null,
    snoozedUntil: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
};

/**
 * A room. `serverId` is RoomOut.id once the create has been pushed; `light` and
 * `sortOrder` mirror the server's fields. `sortOrder` is assigned by the
 * reducer when the room is added, so callers leave it out.
 */
export const makeRoom = ({ name, icon, light = 'unknown', sortOrder = 0, now = new Date() }) => {
  const trimmed = String(name ?? '').trim();
  return {
    id: uid('room'),
    serverId: null,
    name: trimmed,
    icon: icon ?? iconForRoomName(trimmed),
    light,
    sortOrder,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Selectors — everything the screens read, derived rather than stored, so
// there is exactly one source of truth.
// ---------------------------------------------------------------------------

/** "2026-09-05" — the date-only format the backend's `acquired_at` wants. */
export const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

export const livePlants = (state) => state.plants.filter((p) => !p.archived);

export const plantById = (state, id) => state.plants.find((p) => p.id === id) ?? null;

export const roomById = (state, id) => state.rooms.find((r) => r.id === id) ?? null;

export const roomName = (state, id) => roomById(state, id)?.name ?? null;

/** Rooms in the order the server keeps them, ties broken by name. */
export const sortedRooms = (state) =>
  [...state.rooms].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
  );

export const remindersForPlant = (state, plantId) =>
  state.reminders.filter((r) => r.plantId === plantId);

export const plantsInRoom = (state, roomId) =>
  livePlants(state).filter((p) => p.roomId === roomId);

/** The first plant the user owns of a given species, if any. */
export const plantBySpecies = (state, speciesKey) =>
  speciesKey ? livePlants(state).find((p) => p.speciesKey === speciesKey) ?? null : null;

/**
 * Rooms with at least one live plant, in catalog order. The Rooms screen lists
 * these — an empty room has nothing to show and would read as a dead end.
 */
export const occupiedRooms = (state) =>
  state.rooms.filter((room) => plantsInRoom(state, room.id).length > 0);

/**
 * What a plant's card and hero render.
 *
 * The cached file first: it is the only source that survives the radio being
 * off, and after a sign-out it is the only one that survives at all. The two
 * remote/temporary URIs are the fallback for the window between a plant being
 * added and its image finishing its download.
 */
export const plantPhoto = (plant) => {
  const uri = fileUri(plant?.imageFile) ?? plant?.photoUri ?? plant?.heroUri;
  return uri ? { uri } : null;
};

/**
 * The species line under a nickname ("Monstera deliciosa").
 *
 * Falls back to the species key, which is the slugified Latin name — read back
 * as a name rather than shown raw, so a plant added before its care data
 * arrived still reads like a plant and not like a URL.
 */
export const plantSpecies = (plant) => {
  const scientific = plant?.care?.scientific_name;
  if (scientific) return scientific;
  const key = plant?.speciesKey;
  if (!key) return '';
  const words = key.split('-');
  return [words[0].charAt(0).toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ');
};
