// Cultum non-color foundations — radius, spacing, stroke, blur, opacity, and the
// typography scale, imported from Figma "Cultum.app – Design System".
//
// Source of truth (fileKey JyrSo87oacbcbALO8JO9At), one Figma page each:
//   Radius     node 27465:22840      Spacing   node 27465:22713
//   Stroke     node 27518:5435       Blur      node 27627:3800
//   Opacity    node 27518:5511       Typography node 27627:2008
// Extracted 2026-08-25.
//
// These are the Figma-accurate scales, added alongside the prototype-derived
// `radius`/`spacing`/`fontSize` still exported from theme/tokens.js (which many
// components use). Migrate components onto these during the fan-out, then retire
// the old ones. Scalar scales are keyed by their Figma value (radius[8] === 8).

// ---- Radius (corner values, px) ----
export const radius = { 0: 0, 4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32, full: 9999 };

// ---- Spacing (gaps / padding / margins, px) ----
export const space = { 0: 0, 2: 2, 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32, 48: 48 };

// ---- Stroke (border / divider widths, px) ----
export const stroke = { 1: 1, 2: 2, 8: 8 };

// ---- Blur (backdrop blur radius, px) ----
export const blur = { 8: 8, 16: 16, 32: 32 };

// ---- Opacity (Figma percentages → 0–1 fractions for RN) ----
export const opacity = { 0: 0, 25: 0.25, 50: 0.5, 75: 0.75, 100: 1 };

// ---- Typography ----
// Each Figma text style → a ready-to-spread RN text style. Figma specifies the
// family as Inter for EVERY style (Display and Headings included — note this
// differs from the prototype's serif display font). lineHeight is the Figma
// percentage resolved to px (fontSize × ratio: 120% / 130% / 140%).
//
// IMPORTANT: `fontFamily: 'Inter'` renders only if Inter is loaded (e.g. via
// @expo-google-fonts/inter + expo-font); otherwise RN falls back to the system
// face. Load it at app startup before relying on these, or swap to 'System'.
const FAMILY = 'Inter';
const w = { regular: '400', medium: '500', bold: '700' };
const style = (fontSize, fontWeight, ratio) => ({
  fontFamily: FAMILY,
  fontSize,
  fontWeight,
  lineHeight: Math.round(fontSize * ratio * 100) / 100,
});

export const typography = {
  display: style(40, w.bold, 1.2),

  headingLarge: style(32, w.regular, 1.2),
  headingLargeEmphasized: style(32, w.bold, 1.2),
  headingMedium: style(24, w.regular, 1.2),
  headingMediumEmphasized: style(24, w.bold, 1.2),
  headingSmall: style(20, w.regular, 1.3),
  headingSmallEmphasized: style(20, w.bold, 1.3),

  bodyLarge: style(16, w.regular, 1.4),
  bodyLargeEmphasized: style(16, w.bold, 1.4),
  bodyMedium: style(14, w.regular, 1.4),
  bodyMediumEmphasized: style(14, w.bold, 1.4),
  bodySmall: style(12, w.regular, 1.4),
  bodySmallEmphasized: style(12, w.bold, 1.4),

  buttonMedium: style(16, w.medium, 1.2),
  buttonSmall: style(14, w.medium, 1.2),

  caption: style(12, w.regular, 1.4),
  captionEmphasized: style(12, w.bold, 1.4),
};

export default { radius, space, stroke, blur, opacity, typography };
