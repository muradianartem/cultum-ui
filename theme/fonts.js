// The typefaces the Figma text styles name, as the static faces the app loads.
//
// Figma (Typography, node 27627:2008) sets Display and every Heading in
// Literata and everything else in Inter, at three weights: Regular 400,
// Medium 500 and Bold 700. Each weight is its own file, registered under its
// own family alias ('Inter_700Bold', …) — a `fontFamily: 'Inter'` string names
// nothing that was ever loaded, and asking a Regular face for '700' makes the
// platform fake a bold instead of using the real one.
//
// Only the faces a text style actually uses are imported, from their per-weight
// entry points: the package index would pull every weight and italic into the
// bundle.
//
// FONT_FACES is what <FontGate> (theme/FontGate.js) loads before the app mounts.

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_700Bold } from '@expo-google-fonts/literata/700Bold';

export const FONT_FACES = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Literata_400Regular,
  Literata_700Bold,
};

// Figma family → weight → the alias FONT_FACES registers it under.
export const FONT_FAMILIES = {
  Inter: { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 700: 'Inter_700Bold' },
  Literata: { 400: 'Literata_400Regular', 700: 'Literata_700Bold' },
};

// The runtime fontFamily for a Figma family + weight. Throws rather than falling
// back, so a style asking for a face that isn't bundled fails in tests instead
// of quietly rendering in the system font.
export function fontFace(family, weight) {
  const face = FONT_FAMILIES[family]?.[weight];
  if (!face) throw new Error(`No bundled face for ${family} ${weight}`);
  return face;
}
