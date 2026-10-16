// Shared value lists + label formatting for the reminder pickers.
//
// The sheets used to declare their own unit lists, and they disagreed, so
// creating a reminder and editing the same field afterwards offered different
// options. One list now backs each: FREQUENCY_UNITS for a repeat, and snooze
// is days and weeks only — putting a plant off by hours is noise, and a
// months-long snooze is really a schedule change.
//
// Pure: no React/RN imports, so it unit-tests directly.

// The month and weekday names live with the rest of the garden's date
// formatting (store/format.js); re-exported here so the sheets that already
// import from this module keep working against one definition.
export { MONTHS_SHORT, WEEKDAYS_SHORT } from '../store/format';

// `max` caps the number column for that unit; without one it runs the full list.
const unit = (plural, singular, max) => ({ plural, singular, max });

// The repeat units, ordered shortest → longest.
// Months stop at 12: the backend refuses a reminder interval past 365 days.
export const FREQUENCY_UNITS = [
  unit('days', 'day'),
  unit('weeks', 'week'),
  unit('months', 'month', 12),
];

// Snooze (the Today task sheet): days and weeks.
export const SNOOZE_DURATION_UNITS = [unit('days', 'day'), unit('weeks', 'week')];

// Index of 'days' within SNOOZE_DURATION_UNITS — what a snooze opens on.
export const DEFAULT_SNOOZE_UNIT_INDEX = 0;

// Index of 'days' within FREQUENCY_UNITS — the default a repeat opens on, and
// the fallback when a stored value can't be parsed.
export const DEFAULT_FREQUENCY_UNIT_INDEX = 0;

export const FREQUENCY_NUMBERS = Array.from({ length: 30 }, (_, i) => i + 1); // 1–30
export const SNOOZE_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12

/** The number column for a unit: `numbers`, cut at the unit's `max` if it has one. */
export const numbersFor = (numbers, u) => (u?.max ? numbers.slice(0, u.max) : numbers);

/** The repeat wheel's number column for FREQUENCY_UNITS[unitIndex]. */
export const frequencyNumbers = (unitIndex) =>
  numbersFor(FREQUENCY_NUMBERS, FREQUENCY_UNITS[unitIndex]);

// "1 day" / "2 days" — singular only at exactly 1.
export const unitLabel = (u, n) => (n === 1 ? u.singular : u.plural);
