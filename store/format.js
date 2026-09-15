// Display formatting for garden data.
//
// Pure. The reminder sheets round-trip their values through display strings
// ("2 days", "21 Aug", "None") — see screens/ReminderValueSheet.js's
// buildResult/parseValue — so every formatter here has a matching parser, and
// the pair is the contract between the store's numbers and the wheels' strings.

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** "21 Aug" */
export const shortDate = (date) => `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;

/** "Sun 17, Aug" — the add-a-plant success line. */
export const weekdayDate = (date) =>
  `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()}, ${MONTHS_SHORT[date.getMonth()]}`;

/**
 * "Tue, Aug 18" — formatted by hand rather than via toLocaleDateString, whose
 * options aren't reliably honored on Hermes across platforms.
 */
export const longDate = (date) =>
  `${WEEKDAYS_SHORT[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;

/**
 * An interval in days as the "<n> <unit>" string the frequency wheel speaks.
 *
 * Weeks and months are only used where they divide cleanly and actually read
 * better than the day count — 7 stays "7 days" (that is how people talk about
 * watering), while 28 becomes "4 weeks" and 30 "1 month".
 */
export function frequencyValue(days) {
  const d = Math.max(1, Math.round(Number(days) || 1));
  if (d >= 30 && d % 30 === 0) return plural(d / 30, 'month');
  if (d >= 14 && d % 7 === 0) return plural(d / 7, 'week');
  return plural(d, 'day');
}

/** "Every 7 days" — a reminder's subtitle. */
export const frequencyLabel = (days) => `Every ${frequencyValue(days)}`;

/**
 * The inverse of frequencyValue, for values coming back off a wheel. Hours are
 * offered by the shared duration units but can't be a reminder cadence, so they
 * round up to a whole day.
 */
export function parseFrequency(value, fallback = 7) {
  const m = /^(\d+)\s*(hour|day|week|month)s?$/i.exec(String(value ?? '').trim());
  if (!m) return fallback;
  const n = Number(m[1]);
  switch (m[2].toLowerCase()) {
    case 'hour':
      return Math.max(1, Math.round(n / 24));
    case 'week':
      return n * 7;
    case 'month':
      return n * 30;
    default:
      return Math.max(1, n);
  }
}

/** A duration string ("2 days", "None") as milliseconds; 0 for none/unparsable. */
export function durationMs(value) {
  const m = /^(\d+)\s*(hour|day|week|month)s?$/i.exec(String(value ?? '').trim());
  if (!m) return 0;
  const n = Number(m[1]);
  const hour = 60 * 60 * 1000;
  switch (m[2].toLowerCase()) {
    case 'hour':
      return n * hour;
    case 'week':
      return n * 7 * 24 * hour;
    case 'month':
      return n * 30 * 24 * hour;
    default:
      return n * 24 * hour;
  }
}

/**
 * The date row's label on the reminders screen. A schedule that has already run
 * is anchored to the last time it was done; one that hasn't, to its start.
 */
export const dateLabelFor = (reminder) =>
  reminder?.lastDoneAt ? `Last ${verbNoun(reminder.action)}` : 'Start date';

// "Last watering" / "Last fertilizing" reads naturally; the rest fall back to a
// plain "Last done", which beats "Last rotating".
const NOUNS = { water: 'watering', fertilize: 'fertilizing', repot: 'repotting' };
const verbNoun = (action) => NOUNS[action] ?? 'done';

/** The date a reminder's date row shows, as "21 Aug". */
export const reminderDateValue = (reminder) => {
  const raw = reminder?.lastDoneAt ?? reminder?.startAt;
  return raw ? shortDate(new Date(raw)) : '—';
};

/** "Next reminder is on Tue, Aug 18" — the product page's all-caught-up line. */
export const nextReminderLabel = (dueAt) =>
  dueAt ? `Next reminder is on ${longDate(new Date(dueAt))}` : 'No reminders';

/** "3 plants" — a room's subtitle. */
export const roomSubtitle = (count) => plural(count ?? 0, 'plant');

/**
 * A room card's meta line: "3 plants · 2 to check". The second clause is only
 * there when something actually needs attention, so a settled room reads as a
 * plain count.
 */
export const roomMeta = (count, due = 0) =>
  due > 0 ? `${roomSubtitle(count)} · ${due} to check` : roomSubtitle(count);

// ---------------------------------------------------------------------------
// Time of day
//
// Reminders store "HH:mm" in 24-hour form (store/model.js, and the backend's
// `time_of_day`); the UI shows a 12-hour clock, and the wheel picks its three
// columns apart. Keeping the conversion here — beside parseFrequency and
// frequencyValue — means the boundary between what is stored and what is shown
// is crossed in exactly one place.
// ---------------------------------------------------------------------------

/** "09:00" → { hour12: 9, minute: 0, period: 'AM' }. Garbage in → 9:00 AM. */
export function timeParts(timeOfDay) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(timeOfDay ?? ''));
  const h = match ? Math.min(23, Number(match[1])) : 9;
  const m = match ? Math.min(59, Number(match[2])) : 0;
  return {
    hour12: h % 12 === 0 ? 12 : h % 12,
    minute: m,
    period: h < 12 ? 'AM' : 'PM',
  };
}

/** { hour12, minute, period } → "09:00". */
export function timeOfDayFrom({ hour12, minute, period }) {
  const base = hour12 % 12; // 12 AM → 0, 12 PM → 12
  const h = period === 'PM' ? base + 12 : base;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** "09:00" → "9:00 AM" — the value shown on the Reminder time row. */
export function timeLabel(timeOfDay) {
  const { hour12, minute, period } = timeParts(timeOfDay);
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

/** "9:00 AM" → "09:00". The inverse of timeLabel, for round-tripping. */
export function parseTimeOfDay(label, fallback = '09:00') {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(label ?? '').trim());
  if (!match) return fallback;
  return timeOfDayFrom({
    hour12: Number(match[1]),
    minute: Number(match[2]),
    period: match[3].toUpperCase(),
  });
}
