// The garden's domain model: the plants a user owns, the rooms they sit in and
// the care reminders attached to them.
//
// Pure — no React, no React Native, no network. Everything here is a plain
// object or a function over plain objects, so the whole model is unit-testable
// and can be serialised straight to disk (see store/persist.js).
//
// The shapes deliberately mirror the backend's `UserPlantOut` / `ReminderOut`
// (see api/garden.js) so a sync is a field rename rather than a translation.
// Where the server has no equivalent the field is marked local-only; those are
// the ones store/sync.js must never overwrite from a pull.

/** Bump when a stored document's shape changes; store/persist.js migrates. */
export const STATE_VERSION = 1;

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

// The rooms a fresh install offers. They are only a pick-list: a room does not
// exist for the Rooms screen until a plant names it, and the user can add their
// own. `icon` values are Cultum icon names (components/iconRegistry.js).
export const DEFAULT_ROOMS = [
  { id: 'living-room', name: 'Living Room', icon: 'living-room' },
  { id: 'kitchen', name: 'Kitchen', icon: 'kitchen' },
  { id: 'bedroom', name: 'Bedroom', icon: 'bedroom' },
  { id: 'bathroom', name: 'Bathroom', icon: 'shower' },
  { id: 'office', name: 'Office', icon: 'office' },
];

/** Reminders fire mid-morning unless the user moves them. */
export const DEFAULT_TIME_OF_DAY = '09:00';

/** An empty garden — what a first launch starts from. */
export const emptyState = () => ({
  version: STATE_VERSION,
  plants: [],
  reminders: [],
  rooms: DEFAULT_ROOMS.map((r) => ({ ...r })),
  outbox: [],
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
 * owned plant stays fully readable offline. `dirty` records which fields the
 * user has changed locally; because the backend has no PATCH for a user plant,
 * those changes cannot be pushed and must survive every pull (store/sync.js).
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

/** A room. Local-only: the server stores just its name, as a plant's location. */
export const makeRoom = (name, icon = 'home') => ({
  id: uid('room'),
  name: String(name ?? '').trim(),
  icon,
});

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

/** What a plant's card and hero render: the user's photo, else the catalog's. */
export const plantPhoto = (plant) => {
  const uri = plant?.photoUri ?? plant?.heroUri;
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
