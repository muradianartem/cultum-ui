// Cultum component recipes — the mode-independent measurements each component
// is built from, plus elevation and motion.
//
// Foundation scales (radius, spacing, stroke, blur, opacity, type) live only in
// theme/foundations.js. A recipe here refers to them wherever Figma's value is a
// scale step; a value that isn't one is written out and listed, with its Figma
// source, in design-system/exceptions.json.
//
// Colour is not here. Every colour comes from the semantic { light, dark } roles
// in theme/colorTokens.js, resolved for the active theme by useTheme()
// (theme/ThemeProvider.js).

import { radius as r, space, stroke } from './foundations';
import { fontFace } from './fonts';

// ---- button (Figma: "Button – P1", node 26734:3379) ----
// Sizes: lg 56 / md 48 / sm 40, pad 20/16/16, gap 8. `label` names the
// Figma text style: Button Medium for Large and Medium, Button Small for Small.
export const button = {
  sizes: {
    lg: { height: 56, paddingHorizontal: space[20], label: 'buttonMedium' },
    md: { height: 48, paddingHorizontal: space[16], label: 'buttonMedium' },
    sm: { height: 40, paddingHorizontal: space[16], label: 'buttonSmall' },
  },
  // Button Icon (Figma "Button Icon – P1", 26734:5388): square/circular, one
  // step smaller than the text button.
  iconSizes: { lg: 48, md: 40, sm: 32 },
};

// ---- divider (Figma: "Divider – P1", node 26744:5104) ----
// Size=Small → 1px hairline; Size=Large → 8px block separator.
export const divider = { blockHeight: stroke[8] };

// ---- toggle (Figma: "Toggle", node 27383:1945) ----
// 60×28 pill track; a wide 34×22 thumb slides left↔right (3↔23).
export const toggle = { width: 60, height: 28, thumbW: 34, thumbH: 22, pad: 3 };

// ---- checkbox (Figma: "Checkbox – P1", node 26744:5102) ----
// 22px box; State=Active shows a 38px pressed halo.
export const checkbox = { size: 22, radius: 6, haloSize: 38 };

// ---- radio button (Figma: "Radio Button – P1", node 26744:5111) ----
// 22px circle; State=Pressed shows a 38px halo.
export const radio = { size: 22, haloSize: 38 };

// ---- chip (Figma: "Chip – P1", node 26744:6933) ----
// Selectable 32px pill with an optional 24px leading icon.
export const chip = { height: 32, iconSize: 24 };

// ---- loading indicator (Figma: "Loading Indicator – P2", node 26744:5109) ----
// 24px ring, 2px stroke.
export const loading = { size: 24, stroke: stroke[2] };

// ---- state / empty-state (Figma: "State – P2", node 26744:5115) ----
export const emptyState = {
  cardRadius: r[16],
  width: 343,
  iconSizes: { lg: 48, md: 40, sm: 32 },
};

// ---- snackbar (Figma: "Snackbar – P2", node 26744:5114) ----
export const snackbar = { radius: r[8], width: 343, minHeight: 56 };

// ---- segmented control (Figma: "Segmented Control – P2", node 26744:5113) ----
export const segmented = { pad: space[4] };

// ---- search bar (Figma: "Search Bar – P2", node 26744:5112) ----
export const searchBar = { height: 48 };

// ---- text input (Figma: "Text Input – P2", node 26734:5390) ----
export const textInput = { height: 48, radius: r[8] };

// ---- card (Figma: "Card – P2", node 26744:5101) ----
export const card = { radius: r[16], padding: space[20], gap: space[12], iconBadgeSize: 48 };

// ---- list (Figma: "List – P2", node 26744:5108) ----
export const list = { cardRadius: r[16], rowRadius: r[12], beforeBadgeSize: 40 };

// ---- dropdown menu (Figma: "Dropdown Menu – P2", node 26744:5106) ----
export const menu = { radius: r[16], itemRadius: r[12], width: 208 };

// ---- navigation bar (Figma: "Navigation bar – P2", node 26744:6012) ----
export const navbar = { height: 56 };

// ---- avatar (Figma: "Avatar - P3", node 26744:5099) ----
export const avatar = {
  sizes: { xs: 24, sm: 32, md: 40, lg: 56 },
  // Figma text style per size, for initials and for the "+N" overflow. They
  // differ only at Medium, where Figma sets the overflow in Body Large.
  initials: { xs: 'caption', sm: 'bodySmall', md: 'bodySmall', lg: 'headingSmall' },
  overflow: { xs: 'caption', sm: 'bodySmall', md: 'bodyLarge', lg: 'headingSmall' },
};

// ---- overlay (Figma: "Overlay - P3", node 26744:5110) ----
// The scrim is the page ground (background-primary) at this opacity.
export const overlay = { opacity: 0.85 };

// ---- tabs (Figma: "Tabs - P3", node 26744:5117) ----
export const tabs = { height: 40 };

// ---- bottom sheet (Figma: "Bottom Sheet – P2", node 26744:6931) ----
export const sheet = { radiusTop: r[16] };

// ---- wheel picker items (App Design "Today / Snooze for", node 1:11114) ----
// Unnamed Inter Regular: 20 for the selected row, 18 at 45% for the rest. No
// line height — each row is a fixed 44pt band the text is centred in.
export const wheel = {
  active: { fontFamily: fontFace('Inter', 400), fontSize: 20 },
  dim: { fontFamily: fontFace('Inter', 400), fontSize: 18, opacity: 0.45 },
};

// ---- calendar (Figma: "Calendar", node 360:29 / "Calendar Day", node 359:39) ----
export const calendar = { radius: r[16], cardRadius: 20, daySize: 32 };

// ---- elevation ----
// Figma's effect styles, layer for layer (design-system/figma-foundations.json).
// `boxShadow` renders them where the platform draws box shadows; `elevation` is
// Android's single-layer approximation, kept separate from the Figma layers.
const layers = (...l) => l.join(', ');
const LOW = [
  '0px 0px 2px 0px rgba(16,16,16,0.12)',
  '0px 2px 4px 0px rgba(16,16,16,0.11)',
  '0px 4px 8px 0px rgba(16,16,16,0.10)',
];
export const elevation = {
  // Elevation/Low — Dropdown Menu, Snackbar.
  low: { boxShadow: layers(...LOW), elevation: 3 },
  // Elevation/Medium — Low plus a wide, soft fourth layer.
  medium: { boxShadow: layers(...LOW, '0px 16px 32px 0px rgba(16,16,16,0.09)'), elevation: 6 },
};

// Shadows with no design-system effect style behind them, each listed in
// design-system/exceptions.json. Use `elevation` wherever Figma names one.
export const shadow = {
  // Dialog — the design system has no Dialog component.
  float: {
    shadowColor: 'rgb(25, 27, 21)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  // Bottom-sheet lift, cast upward from the sheet edge. The design system's
  // Bottom Sheet carries no effect; the app's "Choose a plan" sheet (265:159)
  // draws 0 -8 32 rgba(0,0,0,0.18), close to but not this.
  sheet: {
    shadowColor: 'rgb(25, 27, 21)',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 24,
  },
};

// ---- motion (durations in ms for RN Animated) ----
export const motion = {
  durFast: 180,
  dur: 300,
  durSlow: 440,
};

export default { button, calendar, card, chip, menu, navbar, tabs, avatar, overlay, sheet, wheel, divider, toggle, checkbox, radio, loading, emptyState, snackbar, segmented, searchBar, textInput, list, elevation, shadow, motion };
