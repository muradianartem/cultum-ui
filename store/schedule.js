// The due-date engine.
//
// Pure and date-injectable: every entry point takes `now`, so the whole thing
// is testable without mocking the clock. Nothing here reads or writes state —
// it derives tasks from reminders, which is the app's single source of truth
// for "what needs doing".
//
// A reminder is a cadence, not a queue: missing three waterings does not
// produce three tasks, it produces one overdue task. That is what the backend
// assumes too ("the app derives the next due date from last_done_at +
// interval_days locally").

import { frequencyLabel } from './format';
import { actionMeta, livePlants, plantPhoto, roomName } from './model';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight at the start of `date`'s calendar day, in the device's zone. */
export const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** The last instant of `date`'s calendar day. */
export const endOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

/**
 * `date` shifted by whole calendar days. Built from Y/M/D rather than by adding
 * milliseconds so a DST boundary doesn't slide the clock time by an hour.
 */
export const addDays = (date, n) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + n,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );

/** `date` moved to "HH:mm" on its own day. */
export const atTimeOfDay = (date, timeOfDay) => {
  const [h, m] = String(timeOfDay ?? '09:00')
    .split(':')
    .map((n) => Number(n) || 0);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
};

/** Whole calendar days between two instants — sign follows `b - a`. */
export const daysBetween = (a, b) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

/**
 * When a reminder next comes due.
 *
 * Before anything has been completed the schedule opens on `startAt`; after a
 * completion it runs from `lastDoneAt` plus the interval. A snooze pushes that
 * one occurrence later without disturbing the cadence underneath, so it only
 * applies while it is still in the future relative to the natural date.
 *
 * @returns {Date|null} null when the reminder can never fire (disabled elsewhere)
 */
export function nextDueAt(reminder) {
  if (!reminder) return null;
  const interval = Math.max(1, Number(reminder.intervalDays) || 1);

  const base = reminder.lastDoneAt
    ? addDays(new Date(reminder.lastDoneAt), interval)
    : new Date(reminder.startAt ?? reminder.createdAt ?? Date.now());

  let due = atTimeOfDay(base, reminder.timeOfDay);

  if (reminder.snoozedUntil) {
    const snoozed = new Date(reminder.snoozedUntil);
    if (snoozed > due) due = snoozed;
  }
  return due;
}

/**
 * The occurrence after `after`, stepping the cadence forward rather than
 * re-anchoring — so a plant watered every 6 days keeps landing on its own
 * rhythm no matter how far ahead you look.
 */
export function occurrenceAfter(reminder, after) {
  const interval = Math.max(1, Number(reminder.intervalDays) || 1);
  let due = nextDueAt(reminder);
  if (!due) return null;
  let guard = 0;
  while (due <= after && guard < 4000) {
    due = addDays(due, interval);
    guard += 1;
  }
  return due;
}

/** "Today" / "Tomorrow" / "3d ago" / "In 5d" — the badge on a task card. */
export function dueLabel(dueAt, now = new Date()) {
  if (!dueAt) return '';
  const n = daysBetween(now, dueAt);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 0) return `${-n}d ago`;
  return `In ${n}d`;
}

/**
 * Turn one reminder occurrence into the row shape screens/TaskCard.js renders:
 * `{ title, plant, room, due, photo }` plus the ids the actions need.
 */
function toTask(state, plant, reminder, dueAt, now) {
  const meta = actionMeta(reminder.action);
  return {
    id: `${reminder.id}@${dueAt.getTime()}`,
    reminderId: reminder.id,
    plantId: plant.id,
    title: reminder.title || meta.label,
    // "Every 6 days" — the cadence, for surfaces that show a task next to the
    // schedule it came from (the product page's task rows).
    subtitle: frequencyLabel(reminder.intervalDays),
    plant: plant.nickname,
    room: roomName(state, plant.roomId) ?? 'No room',
    due: dueLabel(dueAt, now),
    dueAt: dueAt.toISOString(),
    photo: plantPhoto(plant),
    icon: meta.icon,
    tone: meta.tone,
    typeKey: meta.key,
    typeHeader: meta.label,
    overdue: dueAt < startOfDay(now),
  };
}

/** Every reminder that can actually fire, paired with its plant. */
function activePairs(state) {
  const plants = new Map(livePlants(state).map((p) => [p.id, p]));
  return state.reminders
    .filter((r) => r.enabled && plants.has(r.plantId))
    .map((r) => ({ reminder: r, plant: plants.get(r.plantId) }));
}

/**
 * Everything due today or earlier, overdue first and then by plant name — the
 * order the Today screen's groups are built from.
 */
export function todayTasks(state, now = new Date()) {
  const cutoff = endOfDay(now);
  const out = [];
  for (const { reminder, plant } of activePairs(state)) {
    const due = nextDueAt(reminder);
    if (due && due <= cutoff) out.push(toTask(state, plant, reminder, due, now));
  }
  return out.sort(
    (a, b) => new Date(a.dueAt) - new Date(b.dueAt) || a.plant.localeCompare(b.plant),
  );
}

/**
 * What is coming after today, projected forward across the horizon so a weekly
 * watering appears on each of its dates rather than only the next one.
 */
export function upcomingTasks(state, now = new Date(), horizonDays = 30) {
  const from = endOfDay(now);
  const until = endOfDay(addDays(now, horizonDays));
  const out = [];

  for (const { reminder, plant } of activePairs(state)) {
    const interval = Math.max(1, Number(reminder.intervalDays) || 1);
    let due = occurrenceAfter(reminder, from);
    let guard = 0;
    while (due && due <= until && guard < 200) {
      out.push(toTask(state, plant, reminder, due, now));
      due = addDays(due, interval);
      guard += 1;
    }
  }
  return out.sort(
    (a, b) => new Date(a.dueAt) - new Date(b.dueAt) || a.plant.localeCompare(b.plant),
  );
}

/** Today's tasks for one plant — what the product page's task list shows. */
export const plantTasks = (state, plantId, now = new Date()) =>
  todayTasks(state, now).filter((t) => t.plantId === plantId);

/**
 * The soonest thing scheduled for a plant, whenever it falls. Drives the
 * product page's "All caught up · Next reminder is on …" line.
 */
export function nextTaskForPlant(state, plantId, now = new Date()) {
  const dues = state.reminders
    .filter((r) => r.plantId === plantId && r.enabled)
    .map((r) => nextDueAt(r))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return dues[0] ?? null;
}
