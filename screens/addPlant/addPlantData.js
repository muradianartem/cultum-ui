// Data + formatting for the "Add a plant" flow (Figma section "Add a plant",
// node 338:2946).
//
// Pure: no React/RN imports. The screen holds the draft (nickname, room,
// reminders); these helpers turn a PlantVM into the name suggestions, the
// seeded reminder rows and every piece of copy the four steps render, and on
// Done into the plant record the product page is re-entered with.
//
// V1 mock — the record goes back into route params; nothing is persisted and no
// notification is scheduled.

import { MONTHS_SHORT, WEEKDAYS_SHORT } from '../durationUnits';

// Playful stand-ins, so the chip row still offers something when a species has
// only one name. Straight from the Figma mock.
export const PET_NAMES = ['Ziggy', 'Mo', 'Bruce'];

// The five rooms the design ships with. `icon` values are Cultum icon names
// (see components/iconRegistry.js); Bathroom borrows the shower glyph, which is
// what Figma uses.
export const DEFAULT_ROOMS = [
  { id: 'living-room', name: 'Living Room', icon: 'living-room' },
  { id: 'kitchen', name: 'Kitchen', icon: 'kitchen' },
  { id: 'bedroom', name: 'Bedroom', icon: 'bedroom' },
  { id: 'bathroom', name: 'Bathroom', icon: 'shower' },
  { id: 'office', name: 'Office', icon: 'office' },
];

// Fertilizing has no species data behind it (PlantDetail carries water, sun,
// temperature and humidity only), so it opens on a monthly default.
export const FERTILIZE_FREQUENCY = 'Every 30 days';

const firstWord = (s) => String(s ?? '').trim().split(/\s+/)[0] ?? '';

/**
 * The suggestion chips under the name field: the genus (first word of the latin
 * name), the common name, then the pet names — deduped, blanks dropped. On the
 * default Monstera VM this is exactly the Figma row.
 */
export function nameSuggestions(vm = {}) {
  const all = [firstWord(vm.latinName), vm.commonName, ...PET_NAMES];
  const seen = new Set();
  return all.filter((n) => {
    const s = String(n ?? '').trim();
    if (!s || seen.has(s.toLowerCase())) return false;
    seen.add(s.toLowerCase());
    return true;
  });
}

// Ids only need to be unique within the session (V1 keeps rooms in local
// state), but they must not collide when two are added in the same millisecond
// — so count rather than timestamp. Same seam as addReminderData's ids.
let seq = 0;
export const resetRoomIds = () => {
  seq = 0;
}; // test seam

// A user-created room. Custom rooms have no glyph of their own, so they all
// take the generic `home` icon — which is what the Figma "Custom" row shows.
export const makeRoom = (name) => ({
  id: `room-${(seq += 1)}`,
  name: String(name).trim(),
  icon: 'home',
});

/**
 * Days between waterings, read off the plant's own care facts — careFacts[0] is
 * always Water (see api/mapPlant.js), formatted "Every 7 days" or the ranged
 * "Every 7–10 days", whose low end we take. Null when the species has only a
 * prose note ("When the top inch is dry") we can't turn into a schedule.
 */
export function wateringDays(careFacts) {
  const value = careFacts?.[0]?.value;
  const match = /(\d+)/.exec(String(value ?? ''));
  return match ? Number(match[1]) : null;
}

/**
 * The two rows step 3 opens with. Both start OFF: the user opts in, and the
 * schedule then comes from the plant itself rather than from another question.
 */
export function defaultReminders(vm = {}) {
  const days = wateringDays(vm.careFacts);
  return [
    {
      id: 'watering',
      title: 'Watering',
      icon: 'outlined-water',
      enabled: false,
      frequency: days ? `Every ${days} days` : null,
      everyDays: days,
    },
    {
      id: 'fertilizing',
      title: 'Fertilizing',
      icon: 'power',
      enabled: false,
      frequency: FERTILIZE_FREQUENCY,
      everyDays: 30,
    },
  ];
}

// A reminder added through AddReminderSheet, in the row shape this flow uses.
// That sheet stores its repeat as "2 days" / "3 weeks" (addReminderData's
// frequencyValue), which reads fine as a subtitle but carries no day count, so
// custom rows don't feed the "next treatment" date.
export const customReminderRow = (reminder) => ({
  id: reminder.id,
  title: reminder.title,
  icon: 'bell',
  enabled: true,
  frequency: reminder.frequency ? `Every ${reminder.frequency}` : null,
  everyDays: null,
});

// "Reminder is turned off" until the user opts in, then the schedule.
export const reminderSubtitle = (r) =>
  !r.enabled ? 'Reminder is turned off' : r.frequency ?? 'Reminder is on';

// Step 3's footer. With nothing enabled the only way on is to skip, so the CTA
// says so and de-emphasises itself; enabling anything makes it a real Continue.
export const remindersCta = (reminders = []) =>
  reminders.some((r) => r.enabled)
    ? { label: 'Continue', variant: 'primary' }
    : { label: 'Skip for now', variant: 'secondary' };

// "Sun 17, Aug" — the success screen's date format.
export const weekdayDate = (date) =>
  `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()}, ${MONTHS_SHORT[date.getMonth()]}`;

const shiftDays = (from, n) =>
  new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);

// "Mo added to your plants in the kitchen room".
export const successTitle = (nickname, roomName) =>
  `${String(nickname).trim()} added to your plants in the ${String(roomName).toLowerCase()} room`;

/**
 * The line under it: the soonest enabled reminder's first due date, or a note
 * that nothing is scheduled. Reminders whose repeat we can't count in days
 * (customs) don't produce a date.
 */
export function successSubtitle(reminders = [], today = new Date()) {
  const enabled = reminders.filter((r) => r.enabled);
  if (enabled.length === 0) return 'There is no reminder set for now';

  const days = enabled.map((r) => r.everyDays).filter((d) => d != null);
  if (days.length === 0) return 'Your reminders are set';

  return `Next treatment is on ${weekdayDate(shiftDays(today, Math.min(...days)))}`;
}

/** What the flow hands back to the product page on Done. */
export const makePlantRecord = ({ vm, nickname, room, reminders }) => ({
  speciesKey: vm?.speciesKey ?? null,
  nickname: String(nickname).trim(),
  room: room?.name ?? null,
  reminders: reminders.filter((r) => r.enabled),
});
