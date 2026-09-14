// The app's one snackbar host.
//
// Mounted above <Router> (App.js) because routing/Route.js unmounts a screen
// the moment you navigate: a bar owned by a screen would die with it, taking
// its Undo — and the sync hold behind that Undo — along.
//
// Pure UI. It knows nothing about the garden; callers hand it a label and an
// optional action, and it guarantees the one thing they depend on: whatever
// makes the bar go away, `onDismiss` fires exactly once.
//
// One constraint worth knowing: a React Native Modal is a separate native
// window on iOS, so this bar renders *beneath* an open sheet or dialog. Every
// call site today closes its sheet in the same handler that shows the bar.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Snackbar from './Snackbar';
import { space } from '../theme/foundations';

/** How long a bar stays up. Long enough to read it and take an action back. */
export const SNACK_MS = 5000;

const SnackbarContext = createContext(null);

// A screen rendered outside the provider (a bare component test) should render,
// not crash — the messages are feedback, never load-bearing.
const NO_HOST = { show: () => 0, hide: () => {}, setOffset: () => {} };

/**
 * @param {number} [duration]  default visible time, overridable per message
 */
export function SnackbarProvider({ children, duration = SNACK_MS }) {
  const insets = useSafeAreaInsets();
  const [snack, setSnack] = useState(null);
  const [offset, setOffset] = useState(0);

  // The bar currently on screen, readable from timers and from the unmount
  // cleanup — both fire outside a render and would see a stale snapshot.
  const current = useRef(null);
  const timer = useRef(null);
  const seq = useRef(0);

  /**
   * The single way a bar ever changes. Every exit — expiry, ✕, replacement,
   * pressing the action, backgrounding, unmount — goes through here, so the
   * leaving message's `onDismiss` runs once and only once.
   */
  const settle = useCallback((next) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const leaving = current.current;
    current.current = next;
    setSnack(next);
    leaving?.onDismiss?.();
  }, []);

  // `id` guards against a timer from an already-replaced bar killing this one.
  const hide = useCallback(
    (id) => {
      if (id != null && current.current?.id !== id) return;
      settle(null);
    },
    [settle],
  );

  /**
   * @param {{label: string, icon?: React.ReactNode,
   *          action?: {label: string, onPress: () => void},
   *          duration?: number, dismissible?: boolean,
   *          onDismiss?: () => void}} message
   * @returns {number} id, for a targeted `hide`
   */
  const show = useCallback(
    (message) => {
      const id = (seq.current += 1);
      settle({ ...message, id });
      timer.current = setTimeout(() => hide(id), message.duration ?? duration);
      return id;
    },
    [duration, hide, settle],
  );

  useEffect(() => {
    // iOS suspends JS timers in the background, so a bar left standing could
    // outlive the session by minutes — holding an undo open on something the
    // user can no longer see. Leaving the app settles it.
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') settle(null);
    });
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
      const leaving = current.current;
      current.current = null;
      leaving?.onDismiss?.();
    };
  }, [settle]);

  const value = useMemo(() => ({ show, hide, setOffset }), [show, hide]);

  // Pressing the action runs the caller's handler *first*: an Undo has to land
  // before the `onDismiss` that retires the undo token.
  const action = snack?.action
    ? {
      label: snack.action.label,
      onPress: () => {
        snack.action.onPress?.();
        hide(snack.id);
      },
    }
    : undefined;

  // With an action pill there is no room for a ✕ on a 343pt bar, and the bar
  // times out on its own anyway.
  const dismissible = snack ? snack.dismissible ?? !snack.action : false;

  return (
    <SnackbarContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {snack ? (
          <View
            pointerEvents="box-none"
            style={[styles.host, { bottom: (offset || insets.bottom) + space[16] }]}
          >
            <Snackbar
              key={snack.id}
              label={snack.label}
              icon={snack.icon}
              action={action}
              onDismiss={dismissible ? () => hide(snack.id) : undefined}
            />
          </View>
        ) : null}
      </View>
    </SnackbarContext.Provider>
  );
}

/** `{ show, hide }` — stable identities, safe in a dependency array. */
export function useSnackbar() {
  return useContext(SnackbarContext) ?? NO_HOST;
}

/**
 * Tell the host how much room the screen's own bottom furniture takes, so the
 * bar sits above it rather than behind it. The value is the *total* clearance
 * from the screen edge — safe-area inset included — not an extra on top of it.
 * Measure it (`onLayout`) rather than hardcoding a height.
 */
export function useSnackbarOffset(px) {
  const { setOffset } = useSnackbar();
  useEffect(() => {
    setOffset(px);
    return () => setOffset(0);
  }, [px, setOffset]);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  host: { position: 'absolute', left: space[16], right: space[16], alignItems: 'center' },
});
