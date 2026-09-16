// Cultum design tokens — the mode-independent half of the design system:
// component geometry, radii, spacing, type, elevation and motion.
//
// Colour is not here. Every colour comes from the semantic { light, dark } roles
// in theme/colorTokens.js, resolved for the active theme by useTheme()
// (theme/ThemeProvider.js). These groups began as the prototype's light-only
// palette plus the Figma component hexes; the hexes were retired when the app
// gained dark mode, leaving each component's measurements behind.

// ---- button (Figma: "Button – P1", node 26734:3379) ----
// Sizes: lg 56 / md 48 / sm 40, pad 20/16/16, gap 8; label Inter Medium 500
// (16 for lg+md, 14 for sm).
export const button = {
  sizes: {
    lg: { height: 56, paddingHorizontal: 20, fontSize: 16 },
    md: { height: 48, paddingHorizontal: 16, fontSize: 16 },
    sm: { height: 40, paddingHorizontal: 16, fontSize: 14 },
  },
  // Button Icon (Figma "Button Icon – P1", 26734:5388): square/circular, one
  // step smaller than the text button.
  iconSizes: { lg: 48, md: 40, sm: 32 },
};

// ---- divider (Figma: "Divider – P1", node 26744:5104) ----
// Size=Small → 1px hairline; Size=Large → 8px block separator.
export const divider = { blockHeight: 8 };

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
export const loading = { size: 24, stroke: 2 };

// ---- state / empty-state (Figma: "State – P2", node 26744:5115) ----
export const emptyState = {
  cardRadius: 16,
  width: 343,
  iconSizes: { lg: 48, md: 40, sm: 32 },
};

// ---- snackbar (Figma: "Snackbar – P2", node 26744:5114) ----
export const snackbar = { radius: 8, width: 343, minHeight: 56 };

// ---- segmented control (Figma: "Segmented Control – P2", node 26744:5113) ----
export const segmented = { pad: 4 };

// ---- search bar (Figma: "Search Bar – P2", node 26744:5112) ----
export const searchBar = { height: 48 };

// ---- text input (Figma: "Text Input – P2", node 26734:5390) ----
export const textInput = { height: 48, radius: 8 };

// ---- card (Figma: "Card – P2", node 26744:5101) ----
export const card = { radius: 16, padding: 20, gap: 12, iconBadgeSize: 48 };

// ---- list (Figma: "List – P2", node 26744:5108) ----
export const list = { cardRadius: 16, rowRadius: 12, beforeBadgeSize: 40 };

// ---- dropdown menu (Figma: "Dropdown Menu – P2", node 26744:5106) ----
export const menu = { radius: 16, itemRadius: 12, width: 208 };

// ---- navigation bar (Figma: "Navigation bar – P2", node 26744:6012) ----
export const navbar = { height: 56 };

// ---- avatar (Figma: "Avatar - P3", node 26744:5099) ----
export const avatar = {
  sizes: { xs: 24, sm: 32, md: 40, lg: 56 },
  fontSizes: { xs: 10, sm: 12, md: 14, lg: 20 },
};

// ---- overlay (Figma: "Overlay - P3", node 26744:5110) ----
// The scrim is the page ground (background-primary) at this opacity.
export const overlay = { opacity: 0.85 };

// ---- tabs (Figma: "Tabs - P3", node 26744:5117) ----
export const tabs = { height: 40 };

// ---- bottom sheet (Figma: "Bottom Sheet – P2", node 26744:6931) ----
export const sheet = { radiusTop: 16 }; // Figma top corners; overrides radius.sheet

// ---- calendar (Figma: "Calendar", node 360:29 / "Calendar Day", node 359:39) ----
export const calendar = { radius: 16, cardRadius: 20, daySize: 32 };

// ---- geometry ----
export const radius = {
  card: 16,
  thumb: 12,
  tile: 11, // small icon tiles (34–36px)
  lg: 20, // hero-ish blocks
  sheet: 26,
  chip: 14,
  toast: 12,
  pill: 999,
};

export const spacing = {
  margin: 16,
  cardGap: 10,
  section: 26,
};

// ---- type ----
// Display uses a serif; UI uses the system sans; the round face is logo-only.
export const fonts = {
  display: 'Iowan Old Style', // greetings, titles, plant names, big numbers
  ui: 'System',
  round: 'System', // logo lockup only
};

export const fontSize = {
  display: 31,
  section: 25,
  sheetQuestion: 19,
  cardTitle: 16,
  body: 15,
  meta: 13,
  caption: 12,
  eyebrow: 11, // uppercase, tracked
};

// ---- elevation ---- (RN shadow objects; Android uses elevation)
export const shadow = {
  // Figma "Elevation/Low" — a soft 3-layer stack (dropdown menus, low popovers).
  low: {
    boxShadow:
      '0px 0px 2px rgba(16,16,16,0.12), 0px 2px 4px rgba(16,16,16,0.11), 0px 4px 8px rgba(16,16,16,0.10)',
    elevation: 3, // Android fallback (boxShadow is iOS/Fabric)
  },
  float: {
    shadowColor: 'rgb(25, 27, 21)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: 'rgb(25, 27, 21)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  // bottom-sheet lift — larger, softer, cast upward from the sheet edge
  sheet: {
    shadowColor: 'rgb(25, 27, 21)',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 24,
  },
  // green glow under the primary care button
  green: {
    shadowColor: '#7CD52B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
};

// ---- controls ----
export const controls = {
  btnHeight: 52,
  btnHeightSm: 44, // touch targets stay >= 44px
  touchTarget: 44,
};

// ---- motion (durations in ms for RN Animated) ----
export const motion = {
  durFast: 180,
  dur: 300,
  durSlow: 440,
};

export default { button, calendar, card, chip, menu, navbar, tabs, avatar, overlay, sheet, divider, toggle, checkbox, radio, loading, emptyState, snackbar, segmented, searchBar, textInput, list, radius, spacing, fonts, fontSize, shadow, controls, motion };
