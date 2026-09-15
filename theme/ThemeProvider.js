// Cultum theme runtime — resolves the { light, dark } semantic tokens to the
// active color scheme and exposes them to components via useTheme().
//
// Components read colors from useTheme() (resolved hex strings for the active
// mode), never from colorTokens/primitives directly. Mode follows the OS by
// default and can be overridden with useThemeMode().setMode('light'|'dark'|'system').

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colorTokens, interaction } from './colorTokens';

// The full token tree the app themes over. Every leaf is a { light, dark } pair.
const TOKENS = { ...colorTokens, interaction };

/**
 * Deep-map a tree whose leaves are { light, dark } objects to a same-shaped tree
 * of the value for `mode`. Pure — the unit of theming logic worth testing alone.
 */
export function resolveTokens(tokens, mode) {
  const out = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (value && typeof value === 'object' && 'light' in value && 'dark' in value) {
      out[key] = value[mode];
    } else if (value && typeof value === 'object') {
      out[key] = resolveTokens(value, mode);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Default context = the light theme with a no-op setMode. This lets any
// component render outside a provider (isolated tests, storybook-style previews)
// without crashing; the app wraps its root in <ThemeProvider> for real theming.
const DEFAULT_CONTEXT = {
  mode: 'system',
  setMode: () => {},
  colorScheme: 'light',
  effective: 'light',
  t: resolveTokens(TOKENS, 'light'),
};

const ThemeContext = createContext(DEFAULT_CONTEXT);

/**
 * @param {object} p
 * @param {'system'|'light'|'dark'} [p.initialMode]  uncontrolled starting mode
 * @param {'system'|'light'|'dark'} [p.mode]         controlled mode; when given,
 *   this provider holds no state of its own and `setMode` calls `onModeChange`
 *   instead. That is how the persisted preference stays the single source of
 *   truth — passing it as `initialMode` would fork it, because `initialMode` is
 *   read once by useState and never again.
 * @param {(mode: string) => void} [p.onModeChange]
 *
 * Never remount this to change the mode (`key={mode}`): a remount resets the
 * Router's route and stack, every screen's state, and re-runs the auth and
 * garden hydrations. A prop change is a re-render, and `resolveTokens` is
 * already memoized.
 */
export function ThemeProvider({ children, initialMode = 'system', mode: modeProp, onModeChange }) {
  // 'system' follows the OS; 'light'/'dark' pin it.
  const [internalMode, setInternalMode] = useState(initialMode);
  const mode = modeProp ?? internalMode;
  const setMode = useCallback(
    (next) => {
      if (onModeChange) onModeChange(next);
      else setInternalMode(next);
    },
    [onModeChange],
  );
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const effective = mode === 'system' ? colorScheme : mode;

  const value = useMemo(
    () => ({
      mode,
      setMode,
      colorScheme,
      effective,
      t: resolveTokens(TOKENS, effective),
    }),
    [mode, setMode, colorScheme, effective]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext() {
  return useContext(ThemeContext);
}

/** Resolved token tree for the active mode: `useTheme().brand.primary` is a hex. */
export function useTheme() {
  return useThemeContext().t;
}

/** Theme mode controls: { mode, setMode, colorScheme, effective }. */
export function useThemeMode() {
  const { mode, setMode, colorScheme, effective } = useThemeContext();
  return { mode, setMode, colorScheme, effective };
}
