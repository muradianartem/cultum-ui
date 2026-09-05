// Data + formatting for the Rooms screens (Figma section "Rooms", node 377:7).
//
// Pure apart from the photo `require`s: no React/RN imports, so every helper
// here is unit-testable on its own.
//
// V1 mock — these fixtures are the app's only notion of a room. Nothing is
// persisted, and the add-a-plant flow (which keeps its own DEFAULT_ROOMS in
// screens/addPlant/addPlantData.js) does not yet feed this list. A real store
// is a follow-up behind exactly these shapes.

// Photos exported from the Figma frames, named for the species they actually
// show: the mock pairs its photos with its plant names arbitrarily, so the
// pairing below is ours. `monstera-floor` stands in for Figgy's fiddle-leaf fig
// — the exported set has no ficus, and it is the closest large-leaf floor plant.
const PILEA = require('../../assets/rooms/pilea.png');
const MONSTERA_FLOOR = require('../../assets/rooms/monstera-floor.png');
const PEACE_LILY = require('../../assets/rooms/peace-lily.png');
const MONSTERA_DELICIOSA = require('../../assets/rooms/monstera-deliciosa.png');
const MONSTERA_ADANSONII = require('../../assets/rooms/monstera-adansonii.png');
const SNAKE_PLANT = require('../../assets/rooms/snake-plant.png');
const POTHOS = require('../../assets/rooms/pothos.png');
const MONSTERA_TALL = require('../../assets/rooms/monstera-tall.png');
const PHILODENDRON = require('../../assets/rooms/philodendron.png');
const ALOE = require('../../assets/rooms/aloe.png');
const FERN = require('../../assets/rooms/fern.png');

/**
 * A plant is shaped as a *card model* — the same { speciesKey, title, subtitle,
 * thumbUri, percent } contract api/mapPlant.js produces — so tapping one can go
 * straight through screens/scan/openPlant.js and land on a real Product page
 * without any new navigation code. `photo` is the local bundled art the cards
 * render; `thumbUri` stays null because these mocks have no remote image.
 *
 * `needsCheck` drives the "· N to check" half of a room's meta line.
 *
 * Rooms: { id, name, photos: [require…], plants: [Plant] }.
 */
const plant = ({ id, title, subtitle, speciesKey, photo, needsCheck = false }) => ({
  id,
  title,
  subtitle,
  speciesKey,
  photo,
  thumbUri: null,
  percent: null,
  needsCheck,
});

export const ROOMS = [
  {
    id: 'living-room',
    name: 'Living Room',
    photos: [PILEA, MONSTERA_FLOOR, PEACE_LILY, MONSTERA_TALL],
    plants: [
      plant({
        id: 'p-penny',
        title: 'Penny',
        subtitle: 'Pilea peperomioides',
        speciesKey: 'pilea-peperomioides',
        photo: PILEA,
        needsCheck: true,
      }),
      plant({
        id: 'p-figgy',
        title: 'Figgy',
        subtitle: 'Ficus lyrata',
        speciesKey: 'ficus-lyrata',
        photo: MONSTERA_FLOOR,
        needsCheck: true,
      }),
      plant({
        id: 'p-lily',
        title: 'Lily',
        subtitle: 'Spathiphyllum',
        speciesKey: 'spathiphyllum',
        photo: PEACE_LILY,
      }),
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    photos: [MONSTERA_DELICIOSA, MONSTERA_ADANSONII, ALOE, FERN],
    plants: [
      plant({
        id: 'p-kitchen-monstera',
        title: 'Kitchen Monstera',
        subtitle: 'Monstera deliciosa',
        speciesKey: 'monstera-deliciosa',
        photo: MONSTERA_DELICIOSA,
        needsCheck: true,
      }),
      plant({
        id: 'p-mo',
        title: 'Mo',
        subtitle: 'Monstera adansonii',
        speciesKey: 'monstera-adansonii',
        photo: MONSTERA_ADANSONII,
      }),
    ],
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    photos: [SNAKE_PLANT, POTHOS, PHILODENDRON, MONSTERA_TALL],
    plants: [
      plant({
        id: 'p-sunny',
        title: 'Sunny',
        subtitle: 'Sansevieria trifasciata',
        speciesKey: 'sansevieria-trifasciata',
        photo: SNAKE_PLANT,
        needsCheck: true,
      }),
      plant({
        id: 'p-zed',
        title: 'Zed',
        subtitle: 'Epipremnum aureum',
        speciesKey: 'epipremnum-aureum',
        photo: POTHOS,
      }),
    ],
  },
];

const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** The room-detail nav subtitle: "3 plants". */
export const roomSubtitle = (room) => plural(room?.plants?.length ?? 0, 'plant');

/**
 * A room card's meta line: "3 plants · 2 to check". The second clause is only
 * there when something actually needs attention, so a settled room reads as a
 * plain count.
 */
export function roomMeta(room) {
  const plants = room?.plants ?? [];
  const due = plants.filter((p) => p.needsCheck).length;
  const count = plural(plants.length, 'plant');
  return due > 0 ? `${count} · ${due} to check` : count;
}

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
 *
 * @returns {{ rooms: object[], plants: object[] }}
 */
export function searchRooms(rooms = [], query = '') {
  const q = norm(query);
  if (!q) return { rooms: [], plants: [] };

  const matched = rooms.filter((room) => norm(room.name).includes(q));
  const plants = rooms.flatMap((room) =>
    room.plants.filter(
      (p) => norm(p.title).includes(q) || norm(p.subtitle).includes(q),
    ),
  );
  return { rooms: matched, plants };
}

/** Rename one room, leaving the input untouched. */
export const renameRoom = (rooms = [], id, name) =>
  rooms.map((room) => (room.id === id ? { ...room, name: String(name).trim() } : room));
