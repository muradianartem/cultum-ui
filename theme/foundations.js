// Cultum non-color foundations — radius, spacing, stroke, blur, opacity, and the
// typography scale, imported from Figma "Cultum.app – Design System".
//
// Source of truth (fileKey JyrSo87oacbcbALO8JO9At), one Figma page each:
//   Radius     node 27465:22840      Spacing   node 27465:22713
//   Stroke     node 27518:5435       Blur      node 27627:3800
//   Opacity    node 27518:5511       Typography node 27627:2008
// Re-verified 2026-09-21 against design-system/figma-foundations.json, the
// reviewed snapshot theme/__tests__/figmaParity.test.js checks this file with.
//
// This is the only place a foundation scale is defined. theme/tokens.js holds
// component recipes, which reference these values. Scalar scales are keyed by
// their Figma value (radius[8] === 8).

import { fontFace } from './fonts';

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
// Figma "Typography" (node 27627:2008): 19 text styles. Display and every
// Heading are Literata; Body, Button and Caption are Inter. lineHeight is the
// Figma percentage resolved to px (fontSize × 120 / 130 / 140%), kept to its
// exact decimal (Heading Extra Small is 23.4, not 23).
//
// `typographyMeta` is the Figma definition — family, weight, size, line height.
// `typography` is the same thing as ready-to-spread RN text styles: fontFamily
// names the loaded static face for that weight (theme/fonts.js), so there is no
// fontWeight — the weight is in the face, and adding one would make Android and
// the web synthesise a bolder copy. To change weight, change style, e.g.
// bodyMedium → bodyMediumEmphasized; never override fontWeight.
const def = (family, weight, fontSize, percent) => ({
  family,
  weight,
  fontSize,
  lineHeight: Math.round(fontSize * percent) / 100,
});

export const typographyMeta = {
  display: def('Literata', 700, 40, 120),

  headingLarge: def('Literata', 400, 32, 120),
  headingLargeEmphasized: def('Literata', 700, 32, 120),
  headingMedium: def('Literata', 400, 24, 120),
  headingMediumEmphasized: def('Literata', 700, 24, 120),
  headingSmall: def('Literata', 400, 20, 130),
  headingSmallEmphasized: def('Literata', 700, 20, 130),
  headingExtraSmall: def('Literata', 400, 18, 130),
  headingExtraSmallEmphasized: def('Literata', 700, 18, 130),

  bodyLarge: def('Inter', 400, 16, 140),
  bodyLargeEmphasized: def('Inter', 700, 16, 140),
  bodyMedium: def('Inter', 400, 14, 140),
  bodyMediumEmphasized: def('Inter', 500, 14, 140),
  bodySmall: def('Inter', 400, 12, 140),
  bodySmallEmphasized: def('Inter', 700, 12, 140),

  buttonMedium: def('Inter', 500, 16, 120),
  buttonSmall: def('Inter', 500, 14, 120),

  caption: def('Inter', 400, 12, 140),
  captionEmphasized: def('Inter', 500, 12, 140),
};

export const typography = Object.fromEntries(
  Object.entries(typographyMeta).map(([name, m]) => [
    name,
    { fontFamily: fontFace(m.family, m.weight), fontSize: m.fontSize, lineHeight: m.lineHeight },
  ])
);

// Figma's Body text styles also carry paragraph spacing: the gap between two
// paragraphs of the same style. It belongs between consecutive paragraphs (a
// marginTop on the second onward), not as a bottom margin on every label — so
// it is kept out of the spreadable styles above.
export const paragraphSpacing = { bodyLarge: 8, bodyMedium: 8, bodySmall: 4 };

// A text style for a single-line <TextInput>: the face and size, without the
// line height. iOS draws single-line input text off-centre when a lineHeight
// is set, so inputs take their height from the field instead
// (design-system/exceptions.json, "input-line-height").
export const inputText = (name) => {
  const { fontFamily, fontSize } = typography[name];
  return { fontFamily, fontSize };
};

export default { radius, space, stroke, blur, opacity, typography, typographyMeta, paragraphSpacing, inputText };
