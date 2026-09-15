// Local notifications for upcoming care.
//
// iOS caps an app at 64 pending local notifications, so this doesn't try to
// schedule the whole future: it takes the next `MAX_SCHEDULED` occurrences
// across every plant and rebuilds the whole set whenever the garden changes.
// Rebuilding wholesale rather than diffing keeps it honest — there is no
// bookkeeping to drift out of sync with the reminders themselves.
//
// Everything here degrades to a no-op if permission was refused or the module
// is unavailable (Expo Go on some platforms), because a plant reminder failing
// to schedule must never break adding a plant.

import * as Notifications from 'expo-notifications';
import { actionMeta } from '../store/model';
import { todayTasks, upcomingTasks } from '../store/schedule';

/** Comfortably under iOS's 64, leaving room for anything else the app adds. */
export const MAX_SCHEDULED = 56;

/** How far ahead to look. Beyond this the set is rebuilt long before it matters. */
const HORIZON_DAYS = 60;

/**
 * Show a banner even while the app is foregrounded — a watering reminder that
 * arrives silently because the user happened to be in the app is a reminder
 * that didn't happen.
 */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Ask once, and only when it means something — the first time the user adds a
 * plant, not on launch. Returns whether we may schedule.
 */
export async function ensurePermission() {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return !!asked.granted;
  } catch (e) {
    console.warn('[notifications] permission check failed:', e?.message ?? e);
    return false;
  }
}

/**
 * What the OS will do, without asking it to do anything.
 *
 * `ensurePermission()` cannot be used to *render* a row: it prompts. This is
 * the read-only twin — the settings screen needs to know whether a permission
 * has been refused so it can say so, and iOS gives no other signal (a denied
 * `scheduleNotificationAsync` still resolves; the OS just holds nothing).
 *
 * 'denied' means refused and un-askable — the only remedy is iOS Settings.
 * 'undetermined' means we may still prompt.
 */
export async function permissionStatus() {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    return current.canAskAgain === false ? 'denied' : 'undetermined';
  } catch {
    // The module isn't there (Expo Go on some platforms) — nothing will ever
    // be delivered, and that is not something the user can fix.
    return 'unavailable';
  }
}

/** "Water Penny" — the verb reads as an instruction; a custom reminder keeps
 *  the name the user gave it, which is already phrased how they want it. */
function contentFor(task) {
  const meta = actionMeta(task.typeKey);
  const title = meta.key === 'custom' ? task.title : `${meta.verb} ${task.plant}`;
  const detail = meta.key === 'custom' ? task.plant : task.title;
  return {
    title,
    body: task.room && task.room !== 'No room' ? `${detail} · ${task.room}` : detail,
    data: { plantId: task.plantId, reminderId: task.reminderId },
  };
}

/**
 * The occurrences worth scheduling: everything still ahead of us, soonest
 * first, trimmed to the platform's budget. Today's tasks are included when
 * their time of day hasn't passed — the rest are already visible in the app.
 */
export function pendingOccurrences(state, now = new Date(), limit = MAX_SCHEDULED) {
  const ahead = (t) => new Date(t.dueAt) > now;
  return [...todayTasks(state, now).filter(ahead), ...upcomingTasks(state, now, HORIZON_DAYS)]
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    .slice(0, limit);
}

// Serialisation state for rescheduleAll — see the guard inside it.
let running = false;
let queued = null;

/**
 * Rebuild the whole schedule from the garden as it stands.
 *
 * Safe to call on every state change: cancelling and re-adding a few dozen
 * local notifications is cheap, and it makes "what is scheduled" a pure
 * function of the store rather than a second thing to keep correct.
 */
export async function rescheduleAll(state, now = new Date(), options = {}) {
  const { notificationsEnabled = true } = options;

  // Two overlapping runs would interleave one's cancelAll into the middle of
  // the other's scheduling loop and leave the OS holding a partial set. Serialise
  // instead, and remember that a request arrived mid-flight so the last state
  // wins rather than being dropped.
  if (running) {
    queued = { state, now, options };
    return;
  }
  running = true;
  try {
    await rebuild(state, now, notificationsEnabled);
  } finally {
    running = false;
    const next = queued;
    queued = null;
    if (next) await rescheduleAll(next.state, next.now, next.options);
  }
}

async function rebuild(state, now, notificationsEnabled) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    // The master switch governs OS delivery only. It deliberately does not
    // touch any reminder's own `enabled` flag: that one is pushed to the
    // server, so writing it here would silently disable the user's reminders
    // on their other devices.
    if (!notificationsEnabled) {
      if (__DEV__) console.log('[notifications] master switch off — nothing scheduled');
      return;
    }
    const due = pendingOccurrences(state, now);
    for (const task of due) {
      await Notifications.scheduleNotificationAsync({
        content: contentFor(task),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(task.dueAt),
        },
      });
    }
    if (__DEV__) {
      // What the OS is actually holding, not what we asked for — the two differ
      // when permission was refused, and that is worth being able to see.
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      console.log(`[notifications] scheduled ${due.length}, OS holds ${pending.length}`);
    }
  } catch (e) {
    console.warn('[notifications] could not reschedule:', e?.message ?? e);
  }
}

/** Drop everything we have pending (sign-out). */
export async function cancelAll() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing to clean up if the module isn't there.
  }
}
