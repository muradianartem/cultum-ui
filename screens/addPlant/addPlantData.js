// Copy and derived values for the "Add a plant" flow (Figma section
// "Add a plant", node 338:2946).
//
// Pure: no React/RN imports. The screen holds the draft (nickname, room,
// reminder rows); these helpers turn a PlantVM into the name suggestions, the
// seeded reminder rows and every piece of copy the four steps render.
//
// Reminder rows here are a *draft* shape — `{ action, title, icon, enabled,
// intervalDays, lastDoneAt?, startAt? }`. They become real reminders only on Done, when the store
// creates them (store/GardenProvider.js#addPlant), so nothing in this file
// needs to know about ids or due dates.

import {
  dateLabelFor,
  frequencyLabel,
  longDate,
  reminderDateValue,
  weekdayDate,
} from '../../store/format';
import { nextDueAt } from '../../store/schedule';
import { ACTIONS, PRIMARY_ACTIONS, actionMeta } from '../../store/model';

// Playful stand-ins, so the chip row still offers something when a species has
// only one name. Straight from the Figma mock.
export const PET_NAMES = ['Ziggy', 'Mo', 'Bruce'];

const firstWord = (s) => String(s ?? '').trim().split(/\s+/)[0] ?? '';

/**
 * The suggestion chips under the name field: the genus (first word of the latin
 * name), the common name, then the pet names — deduped, blanks dropped.
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

/**
 * The rows step 3 opens with: watering, fertilizing and repotting, all on,
 * each counted from a last-done of today until the user picks another day.
 *
 * The cadence comes from the species itself — api/mapPlant.js#careActions is
 * the same data the product page's "How to care" section states, so what the
 * page promises and what the app will actually remind about are one number.
 * A species the catalog has no interval for falls back to the action's own
 * default rather than dropping the row: not knowing the ideal gap is a poor
 * reason to deny someone a watering reminder.
 */
export function defaultReminders(vm = {}, today = new Date()) {
  const lastDoneAt = noon(today).toISOString();
  const fromCatalog = new Map((vm.careActions ?? []).map((c) => [c.action, c]));
  return PRIMARY_ACTIONS.map((key) => {
    const meta = ACTIONS[key];
    const catalog = fromCatalog.get(key);
    const intervalDays = catalog?.intervalDays ?? meta.defaultIntervalDays;
    return {
      id: key,
      action: key,
      title: meta.label,
      icon: meta.icon,
      enabled: true,
      intervalDays,
      lastDoneAt,
      // "Every 7–10 days" from the catalog reads better than a flattened
      // "Every 7 days"; only fall back to the derived label when there is none.
      frequency: catalog?.value && catalog.value !== '—' ? catalog.value : everyDays(intervalDays),
    };
  });
}

/** A reminder added through AddReminderSheet, in this flow's row shape. */
export const customReminderRow = (draft, intervalDays) => ({
  id: `custom-${draft.title}`,
  action: 'custom',
  title: draft.title,
  icon: actionMeta('custom').icon,
  enabled: true,
  intervalDays,
  // The day the sheet said it "starts on" — the first occurrence, not a last-done.
  startAt: draft.startAt ?? null,
  frequency: `Every ${draft.frequency}`,
});

// "Every 4 weeks" reads better than "Every 28 days" once a cadence is monthly.
function everyDays(days) {
  if (days % 30 === 0 && days >= 30) return days === 30 ? 'Every month' : `Every ${days / 30} months`;
  if (days % 7 === 0 && days >= 14) return `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}

/**
 * A draft row as its ReminderCard reads it — the same labels Edit Reminders
 * shows for a stored reminder, so a row looks alike before and after saving.
 * `frequency` keeps the catalog's wording ("Every 7–10 days") until the user
 * picks a cadence, which clears it.
 */
export function draftView(r) {
  const due = r.enabled ? nextDueAt(r) : null;
  return {
    nextLabel: due ? `Next reminder: ${longDate(due)}` : 'Reminder is turned off',
    dateLabel: dateLabelFor(r),
    dateValue: reminderDateValue(r),
    frequency: r.frequency ?? frequencyLabel(r.intervalDays),
  };
}

// Step 3's footer. With nothing enabled the only way on is to skip, so the CTA
// says so and de-emphasises itself; enabling anything makes it a real Continue.
export const remindersCta = (reminders = []) =>
  reminders.some((r) => r.enabled)
    ? { label: 'Continue', variant: 'primary' }
    : { label: 'Skip for now', variant: 'secondary' };

const shiftDays = (from, n) =>
  new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);

// Noon keeps the calendar day stable across DST and small timezone moves.
export const noon = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);

// "Mo added to your plants in the kitchen room".
export const successTitle = (nickname, roomName) =>
  `${String(nickname).trim()} added to your plants in the ${String(roomName).toLowerCase()} room`;

/**
 * The line under it: the soonest enabled reminder's first due date, by the same
 * rule store/GardenProvider.js#addPlant stores. A row with a chosen `startAt`
 * first comes due on that day; a row with a `lastDoneAt` a full interval after
 * it; any other row counts as having just been tended, so its first occurrence
 * is a full interval out from today. A date in the past is still named — that
 * reminder is due now.
 */
export function successSubtitle(reminders = [], today = new Date()) {
  const firsts = reminders
    .filter((r) => r.enabled)
    .map((r) => {
      const start = r.startAt ? new Date(r.startAt) : null;
      if (start && !Number.isNaN(start.getTime())) return start;
      const last = r.lastDoneAt ? new Date(r.lastDoneAt) : null;
      if (last && !Number.isNaN(last.getTime()) && r.intervalDays) {
        return shiftDays(last, r.intervalDays);
      }
      return r.intervalDays ? shiftDays(today, r.intervalDays) : null;
    })
    .filter(Boolean);
  if (firsts.length === 0) return 'There is no reminder set for now';
  const soonest = firsts.reduce((a, b) => (b < a ? b : a));
  return `Next treatment is on ${weekdayDate(soonest)}`;
}
