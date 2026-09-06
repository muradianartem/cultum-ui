// Label formatting for the "Add new reminder" sheet (Figma section
// "Reminders / Add new reminder", node 362:17102).
//
// Pure: no React/RN imports. The sheet holds wheel indices and a Date; these
// helpers turn them into the CTA labels and, on confirm, into the draft its
// caller converts into a real reminder (screens/RemindersScreen.js). Unit lists
// come from ./durationUnits.js so the create flow and the edit sheet stay in
// step; date formatting comes from store/format.js, which owns the display
// strings the wheels and the store trade in.

import { shortDate } from '../store/format';
import {
  DEFAULT_FREQUENCY_UNIT_INDEX,
  FREQUENCY_NUMBERS,
  FREQUENCY_UNITS,
  MONTHS_SHORT,
  unitLabel,
} from './durationUnits';

export { shortDate };

// The wheel opens on "2 days", matching the Figma.
export const DEFAULT_NUMBER_INDEX = 1; // FREQUENCY_NUMBERS[1] === 2
export const DEFAULT_UNIT_INDEX = DEFAULT_FREQUENCY_UNIT_INDEX; // 'days'

// Shift by calendar day (not by 24h) so DST changes can't slip the date.
const shiftDays = (from, n) =>
  new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/**
 * Read a stored "21 Aug" back into a Date.
 *
 * Reminder dates carry no year, so this picks the occurrence nearest `today`.
 * That keeps the common case right across a New Year boundary: on 3 Jan a
 * "28 Dec" last-watering resolves to last December, not eleven months away.
 * Unparseable input falls back to today. A 29 Feb stored against a non-leap
 * year clamps to the 28th.
 */
export function parseShortDate(value, today = new Date()) {
  const [dayStr, monStr] = String(value ?? '').trim().split(/\s+/);
  const month = MONTHS_SHORT.findIndex(
    (m) => m.toLowerCase() === (monStr ?? '').toLowerCase()
  );
  const day = parseInt(dayStr, 10);

  if (month < 0 || !Number.isFinite(day)) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  const year = today.getFullYear();
  return [year - 1, year, year + 1]
    .map((y) => new Date(y, month, Math.min(day, daysInMonth(y, month))))
    .reduce((best, d) =>
      Math.abs(d - today) < Math.abs(best - today) ? d : best
    );
}

// Step 3's CTA: "Set 10 Sep".
export const setDateLabel = (date) => `Set ${shortDate(date)}`;

// Step 2's CTA: "Remind every 2 days" — and "Remind every day" at 1, which
// reads better than "every 1 day".
export function frequencyLabel(numberIndex, unitIndex) {
  const n = FREQUENCY_NUMBERS[numberIndex];
  const u = FREQUENCY_UNITS[unitIndex];
  return n === 1
    ? `Remind every ${u.singular}`
    : `Remind every ${n} ${unitLabel(u, n)}`;
}

// The stored "2 days" detail-row value. Kept in the same shape buildResult()
// produces in ReminderValueSheet so a new reminder is editable straight away.
export function frequencyValue(numberIndex, unitIndex) {
  const n = FREQUENCY_NUMBERS[numberIndex];
  return `${n} ${unitLabel(FREQUENCY_UNITS[unitIndex], n)}`;
}

// The calendar's suggestion chips, relative to `today` so they never go stale.
export const startDateSuggestions = (today = new Date()) => [
  { label: 'Today', date: shiftDays(today, 0) },
  { label: 'Yesterday', date: shiftDays(today, -1) },
  { label: 'A week ago', date: shiftDays(today, -7) },
  { label: 'Two weeks ago', date: shiftDays(today, -14) },
];

/**
 * What the sheet hands back on confirm: the three answers it collected, in the
 * display vocabulary the wheels speak. Its caller turns that into a real
 * reminder — ids, intervals and scheduling all belong to the store, not here.
 *
 * `numberIndex`/`unitIndex` index FREQUENCY_NUMBERS / FREQUENCY_UNITS; `date`
 * is the chosen start date.
 */
export function makeReminderDraft({ label, numberIndex, unitIndex, date }) {
  return {
    title: label.trim(),
    dateValue: shortDate(date),
    frequency: frequencyValue(numberIndex, unitIndex),
  };
}
