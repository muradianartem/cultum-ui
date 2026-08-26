// Cultum semantic color tokens — the role layer components consume via useTheme().
//
// Source of truth: Figma "Cultum.app – Design System", page "Color Tokens"
// (fileKey JyrSo87oacbcbALO8JO9At, node 27465:14108). Re-extracted 2026-08-25.
//
// GENERATED from the Figma page. Every token carries a { light, dark } pair and
// references a primitive (theme/primitives.js) — never a raw hex — except the
// pressed overlays (Interactions), which are translucent rgba layers, and the
// `basic` black/white base. Names follow the Figma token names (kebab → nested
// camelCase): on-X-y → X.onY, X-…-inverse → X.…Inverse.

import { primitives as p } from './primitives';

export const colorTokens = {
  // ---- Brand ----
  brand: {
    primary: { light: p.primary[500], dark: p.primary[400] },
    primaryInverse: { light: p.primary[150], dark: p.primary[950] },
    onPrimary: { light: p.primary[975], dark: p.primary[975] },
    onPrimaryInverse: { light: p.primary[975], dark: p.primary[25] },
    secondary: { light: p.secondary[300], dark: p.secondary[850] },
    secondaryInverse: { light: p.secondary[800], dark: p.secondary[300] },
    onSecondary: { light: p.secondary[975], dark: p.secondary[25] },
    onSecondaryInverse: { light: p.secondary[25], dark: p.secondary[975] },
  },
  // ---- Background ----
  background: {
    primary: { light: p.primaryNeutral[25], dark: p.primaryNeutral[950] },
    primaryInverse: { light: p.primaryNeutral[950], dark: p.primaryNeutral[25] },
    secondary: { light: p.primaryNeutral[75], dark: p.primaryNeutral[900] },
    secondaryInverse: { light: p.primaryNeutral[950], dark: p.primaryNeutral[100] },
    brand: { light: p.primary[50], dark: p.primary[850] },
    brandInverse: { light: p.primary[850], dark: p.primary[50] },
  },
  // ---- Surface ----
  surface: {
    primary: { light: p.primaryNeutral[100], dark: p.primaryNeutral[900] },
    primaryInverse: { light: p.primaryNeutral[900], dark: p.primaryNeutral[100] },
    secondary: { light: p.primaryNeutral[200], dark: p.primaryNeutral[800] },
    secondaryInverse: { light: p.primaryNeutral[800], dark: p.primaryNeutral[200] },
    tertiary: { light: p.primaryNeutral[300], dark: p.primaryNeutral[750] },
    tertiaryInverse: { light: p.primaryNeutral[750], dark: p.primaryNeutral[300] },
  },
  // ---- Border ----
  border: {
    primary: { light: p.primaryNeutral[400], dark: p.primaryNeutral[700] },
    primaryInverse: { light: p.primaryNeutral[700], dark: p.primaryNeutral[400] },
    secondary: { light: p.primaryNeutral[300], dark: p.primaryNeutral[800] },
    secondaryInverse: { light: p.primaryNeutral[800], dark: p.primaryNeutral[300] },
    tertiary: { light: p.primaryNeutral[150], dark: p.primaryNeutral[925] },
    tertiaryInverse: { light: p.primaryNeutral[925], dark: p.primaryNeutral[150] },
  },
  // ---- Text & Icons ----
  text: {
    primary: { light: p.primaryNeutral[950], dark: p.primaryNeutral[25] },
    primaryInverse: { light: p.primaryNeutral[25], dark: p.primaryNeutral[950] },
    secondary: { light: p.primaryNeutral[800], dark: p.primaryNeutral[200] },
    secondaryInverse: { light: p.primaryNeutral[200], dark: p.primaryNeutral[800] },
    placeholder: { light: p.primaryNeutral[700], dark: p.primaryNeutral[400] },
    placeholderInverse: { light: p.primaryNeutral[300], dark: p.primaryNeutral[700] },
  },
  // ---- Disabled & Skeleton ----
  disabled: {
    surface: { light: p.primaryNeutral[150], dark: p.primaryNeutral[850] },
    on: { light: p.primaryNeutral[800], dark: p.primaryNeutral[500] },
    border: { light: p.primaryNeutral[300], dark: p.primaryNeutral[800] },
    text: { light: p.primaryNeutral[700], dark: p.primaryNeutral[500] },
    skeleton: { light: p.primaryNeutral[200], dark: p.primaryNeutral[850] },
  },
  // ---- Feedback / Information ----
  information: {
    primary: { light: p.information[500], dark: p.information[300] },
    onPrimary: { light: p.information[975], dark: p.information[975] },
    secondary: { light: p.information[150], dark: p.information[750] },
    onSecondary: { light: p.information[975], dark: p.information[25] },
  },
  // ---- Feedback / Success ----
  success: {
    primary: { light: p.success[700], dark: p.success[150] },
    onPrimary: { light: p.success[25], dark: p.success[975] },
    secondary: { light: p.success[150], dark: p.success[750] },
    onSecondary: { light: p.success[800], dark: p.success[25] },
  },
  // ---- Feedback / Warning ----
  warning: {
    primary: { light: p.warning[500], dark: p.warning[150] },
    onPrimary: { light: p.warning[925], dark: p.warning[900] },
    secondary: { light: p.warning[150], dark: p.warning[750] },
    onSecondary: { light: p.warning[925], dark: p.warning[25] },
  },
  // ---- Feedback / Error ----
  error: {
    primary: { light: p.error[500], dark: p.error[150] },
    onPrimary: { light: p.error[25], dark: p.error[975] },
    secondary: { light: p.error[150], dark: p.error[750] },
    onSecondary: { light: p.error[900], dark: p.error[25] },
  },
  // ---- Basic & Logo ----
  basic: {
    base: { light: '#000000', dark: '#FFFFFF' },
    logo: { light: p.primary[975], dark: p.primary[25] },
    onLogo: { light: p.primary[25], dark: p.primary[975] },
  },
};

// Interaction state layers (translucent overlays, not primitive colours).
export const interaction = {
  pressedInverse: { light: 'rgba(255,255,255,0.08)', dark: 'rgba(0,0,0,0.08)' },
  pressed: { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.08)' },
};

export default colorTokens;
