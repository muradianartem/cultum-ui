// Shared value lists + label formatting for the reminder pickers.
//
// Three sheets used to declare their own unit lists, and they disagreed:
// SnoozeContent had [hours, days, weeks], ReminderValueSheet's frequency had
// [days, weeks, months], and its snooze had [None, hours, days, weeks]. So
// creating a reminder and editing the same field afterwards offered different
// options. One list now backs all of them — FREQUENCY_UNITS is the union, and
// snooze prepends its "None" lead to it.
//
// Pure: no React/RN imports, so it unit-tests directly.

const unit = (plural, singular) => ({ plural, singular });

// The canonical repeat/duration units, ordered shortest → longest.
export const FREQUENCY_UNITS = [
  unit('hours', 'hour'),
  unit('days', 'day'),
  unit('weeks', 'week'),
  unit('months', 'month'),
];

// Snooze leads with a "None" option (index 0) that hides the number column.
export const NONE_UNIT = unit('None', 'None');
export const SNOOZE_UNITS = [NONE_UNIT, ...FREQUENCY_UNITS];

// Index of 'days' within FREQUENCY_UNITS — the default a repeat opens on, and
// the fallback when a stored value can't be parsed. Before the lists were
// merged 'days' sat at index 0; naming it keeps that behaviour explicit now
// that 'hours' precedes it.
export const DEFAULT_FREQUENCY_UNIT_INDEX = 1;

export const FREQUENCY_NUMBERS = Array.from({ length: 30 }, (_, i) => i + 1); // 1–30
export const SNOOZE_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// "1 day" / "2 days" — singular only at exactly 1.
export const unitLabel = (u, n) => (n === 1 ? u.singular : u.plural);
