// Device preferences, hydrated synchronously so render #1 is already correct.
//
// Sits above ThemeProvider (which consumes `appearance`) and therefore above
// AuthProvider — which is also structurally what "a preference survives a
// sign-out" means, not just where the file lives on disk.
//
// `notificationPermission` rides along here even though it is not persisted:
// the OS owns it, the app can only observe it, and every consumer that wants
// the preference also wants to know whether the OS will honour it.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_PREFS, loadPrefsSync, savePrefs } from '../lib/prefsStorage';
import { createSaver } from '../store/persist';
import { ensurePermission, permissionStatus } from '../notifications';

// One tap, not a burst of mutations — this only coalesces a fast double-tap on
// the appearance picker.
const SAVE_DEBOUNCE_MS = 250;

// Mirrors ThemeProvider's DEFAULT_CONTEXT: any component can render outside a
// provider (isolated tests, a screen rendered on its own) and read sane values
// instead of crashing on a null context.
const DEFAULT_CONTEXT = {
  ...DEFAULT_PREFS,
  notificationPermission: 'undetermined',
  setAppearance: () => {},
  setReminderTime: () => {},
  setNotificationsEnabled: async () => {},
  refreshNotificationPermission: async () => {},
};

const PrefsContext = createContext(DEFAULT_CONTEXT);

export function PrefsProvider({ children, initial = null }) {
  // Synchronous read — see lib/prefsStorage.js. No `ready` flag, because there
  // is no window during which the values are unknown.
  const [prefs, setPrefs] = useState(() => initial ?? loadPrefsSync());
  const [notificationPermission, setNotificationPermission] = useState('undetermined');

  const saver = useRef(null);
  if (!saver.current) saver.current = createSaver(SAVE_DEBOUNCE_MS, savePrefs);

  const update = useCallback((patch) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      saver.current.queue(next);
      return next;
    });
  }, []);

  // A pending write must not be lost because the tree went away.
  useEffect(() => {
    const flush = saver.current.flush;
    return () => flush();
  }, []);

  const refreshNotificationPermission = useCallback(async () => {
    const status = await permissionStatus();
    setNotificationPermission(status);
    return status;
  }, []);

  useEffect(() => {
    refreshNotificationPermission();
  }, [refreshNotificationPermission]);

  // The user can grant or revoke in iOS Settings while we are backgrounded.
  // Without re-probing, the notifications row is stale forever — and worse, a
  // newly granted permission would never trigger a reschedule.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshNotificationPermission();
      else saver.current.flush();
    });
    return () => sub.remove();
  }, [refreshNotificationPermission]);

  const setAppearance = useCallback((appearance) => update({ appearance }), [update]);
  const setReminderTime = useCallback((reminderTime) => update({ reminderTime }), [update]);

  /**
   * The master switch records *intent*, and is written before the OS is asked.
   *
   * Turning it on when permission is refused deliberately leaves the pref
   * `true`: storing `false` would mean a user who later allows notifications in
   * iOS Settings comes back to a switch that is still off and has to toggle it
   * again. The row renders the *effective* state (this pref AND the OS's
   * answer), so an intent the OS is blocking is visible rather than silent.
   */
  const setNotificationsEnabled = useCallback(
    async (enabled) => {
      update({ notificationsEnabled: enabled });
      if (!enabled) return 'granted';
      const granted = await ensurePermission();
      const status = await refreshNotificationPermission();
      return granted && status === 'granted' ? 'granted' : 'denied';
    },
    [update, refreshNotificationPermission],
  );

  const value = useMemo(
    () => ({
      ...prefs,
      notificationPermission,
      setAppearance,
      setReminderTime,
      setNotificationsEnabled,
      refreshNotificationPermission,
    }),
    [
      prefs,
      notificationPermission,
      setAppearance,
      setReminderTime,
      setNotificationsEnabled,
      refreshNotificationPermission,
    ],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  return useContext(PrefsContext);
}
