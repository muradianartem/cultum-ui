// Cultum design tokens — ported from the prototype's css/tokens.css (v2).
// Palette derived from the Cultum logo lockup (lime mark on near-black),
// AllTrails structural DNA, plant-care semantics. Light only — no dark tokens.

export const colors = {
  // ---- brand ----
  lime: '#A9F03B', // the logo mark green — brand moments only
  green: '#93EC7C', // primary action fill (care verbs) — ink sits on top
  greenInk: '#10200A', // text/icons sitting on green
  greenDeep: '#3F6B1C', // green text & icons on light grounds
  greenPale: '#EAF7D8', // soft green fills
  sage: '#EFF5E4', // zone tint
  brandDark: '#0E120B', // splash / onboarding / dark chrome
  brandDark2: '#1A2114', // raised dark surface

  // ---- neutrals (warm, biased toward the green) ----
  paper: '#FAFAF6',
  surface: '#FFFFFF',
  surface2: '#F1F2EB',
  ink: '#191B15',
  ink2: '#62655A', // 6.2:1 on paper
  ink3: '#767A6B', // 4.6:1 on paper — carries real copy, must pass AA
  ink4: '#9A9D90', // decoration only: dividers, disabled glyphs, never text
  hairline: '#E7E9DE',
  grabber: '#D8DACE', // bottom-sheet drag handle (new; ~ink4 lightened)

  // ---- semantic ----
  water: '#4E97D1',
  waterPale: '#E4F0F9',
  waterDeep: '#2B6EA6',
  amber: '#A85E08',
  amberPale: '#FBEED0',
  danger: '#C04A0B',
  dangerPale: '#F9E8DC',
  dotFine: '#93EC7C',
  dotAttention: '#C08417',

  // ---- inverted surfaces (dark pills on light) ----
  invertBg: '#0E120B',
  invertInk: '#FFFFFF',

  // ---- intro surfaces: splash, onboarding, permission ----
  onbSurface: '#FFFFFF',
  onbInk: '#191B15',
  onbLine: '#E7E9DE',

  white: '#FFFFFF',
};

// ---- badge semantics (Figma: "Badge – P2", node 26744:5100) ----
// Three Functions (intents) × four ways of applying them (Styles):
//   solid   — filled pill (Style=Primary):    bg: solid,  text: onSolid
//   soft    — tinted pill (Style=Secondary):  bg: soft,   text: softInk
//   line    — hairline / text (Outlined, No background):  border/text: line
// Neutral's solid is the brand green, so it reuses colors.green; the rest are
// Figma values with no existing token equivalent, added here as the source of truth.
export const badge = {
  neutral: { solid: colors.green, onSolid: '#0C100A', soft: '#D9DBD8', softInk: '#0E0E0E', line: colors.green },
  positive: { solid: '#387D41', onSolid: '#F8FDF7', soft: '#D2F5D2', softInk: '#29522D', line: '#387D41' },
  negative: { solid: '#DA3737', onSolid: '#FFF6F4', soft: '#FFC7BF', softInk: '#2D1410', line: '#DA3737' },
};

// ---- button (Figma: "Button – P1", node 26734:3379) ----
// Axes: Type (variant) × Destructive × Size × State. `bg`/`fg` (+ `border` where
// drawn); disabled + font live below. Type=Primary enabled is the brand green,
// so it reuses colors.green. Sizes: lg 56 / md 48 / sm 40, pad 20/16/16, gap 8;
// label Inter Medium 500 (16 for lg+md, 14 for sm).
//
// State=Pressed follows Figma's two models: the filled types (primary/secondary
// + destructive) swap to a distinct `bgPressed` fill, while outline/ghost keep
// their base fill and darken with a translucent `pressedLayer` state layer laid
// over the top (Figma "State=Pressed" for Outlined/Ghost = rgba(0,0,0,0.08)).
// Variants that darken via the state layer are flagged `stateLayer: true`.
export const button = {
  pressedLayer: 'rgba(0,0,0,0.08)', // Figma outline/ghost State=Pressed overlay
  primary: { bg: colors.green, bgPressed: '#9CEE86', fg: '#0C100A' },
  secondary: { bg: '#D9DBD8', bgPressed: '#C8C9C7', fg: '#151515' },
  outline: { bg: '#FAFAFA', fg: '#151515', border: '#B6B9B6', stateLayer: true },
  ghost: { bg: 'transparent', fg: '#151515', stateLayer: true },
  // Destructive=True
  dangerPrimary: { bg: '#DA3737', bgPressed: '#DD4747', fg: '#FFF6F4' },
  dangerSecondary: { bg: '#FFC7BF', bgPressed: '#EBB7B0', fg: '#2D1410' },
  dangerOutline: { bg: '#FAFAFA', fg: '#DA3737', border: '#DA3737', stateLayer: true },
  dangerGhost: { bg: 'transparent', fg: '#DA3737', stateLayer: true },
  // State=Disabled (shared across filled types)
  disabledBg: '#E3E4E3', disabledFg: '#404140', disabledBorder: '#C8CAC8',
  sizes: {
    lg: { height: 56, paddingHorizontal: 20, fontSize: 16 },
    md: { height: 48, paddingHorizontal: 16, fontSize: 16 },
    sm: { height: 40, paddingHorizontal: 16, fontSize: 14 },
  },
  // Button Icon (Figma "Button Icon – P1", 26734:5388): square/circular, same
  // colours, one step smaller than the text button.
  iconSizes: { lg: 48, md: 40, sm: 32 },
};

// ---- divider (Figma: "Divider – P1", node 26744:5104) ----
// Size=Small → 1px hairline; Size=Large → 8px block separator. Margin adds a
// 16px horizontal inset. Split-with-label centres a Caption between two hairlines.
export const divider = {
  hairline: '#B6B9B6',
  block: '#ECEDEC',
  blockHeight: 8,
  labelInk: '#404140',
};

// ---- toggle (Figma: "Toggle", node 27383:1945) ----
// 60×28 pill track; a wide 34×22 thumb slides left↔right (3↔23). Geometry only —
// colours come from the semantic tokens via useTheme() (see Toggle.js).
export const toggle = { width: 60, height: 28, thumbW: 34, thumbH: 22, pad: 3 };

// ---- checkbox (Figma: "Checkbox – P1", node 26744:5102) ----
// 22px box: grey outline when off, green fill + glyph when checked/indeterminate.
// State=Active shows a 38px pressed halo; Disabled greys the fill/glyph.
// (Figma draws the box as an SVG; with no react-native-svg we render it in Views.)
export const checkbox = {
  size: 22,
  radius: 6,
  border: '#B6B9B6',
  fill: colors.green,
  glyph: '#0C100A',
  disabledFill: '#E3E4E3',
  disabledGlyph: '#404140',
  halo: 'rgba(0,0,0,0.08)',
  haloSize: 38,
};

// ---- radio button (Figma: "Radio Button – P1", node 26744:5111) ----
// 22px circle: grey ring when unselected, green ring + centre dot when selected.
// State=Pressed shows a 38px halo; Disabled greys the ring/dot.
export const radio = {
  size: 22,
  ring: '#B6B9B6',
  ringSelected: colors.green,
  ringDisabled: '#C8CAC8',
  dot: colors.green,
  dotDisabled: '#E3E4E3',
  halo: 'rgba(0,0,0,0.08)',
  haloSize: 38,
};

// ---- chip (Figma: "Chip – P1", node 26744:6933) ----
// Selectable 32px pill. State=Active is the selected look (darker bg + ink);
// Pressed shares the darker bg; Disabled greys it. Optional 24px leading icon
// (pad 4/8 with icon, 12 without). Label is Body/Body Medium (14px).
export const chip = {
  bg: '#ECEDEC',
  bgPressed: '#D9DAD9',
  bgSelected: '#D9DAD9',
  bgDisabled: '#E3E4E3',
  ink: '#151515',
  inkSelected: '#0C100A',
  inkDisabled: '#404140',
  height: 32,
  iconSize: 24,
};

// ---- loading indicator (Figma: "Loading Indicator – P2", node 26744:5109) ----
// 24px ring, 2px stroke #606160 spinning through the 4 Figma frames. Drawn as a
// rotating bordered circle (no react-native-svg).
export const loading = { size: 24, stroke: 2, color: '#606160', track: '#ECEDEC' };

// ---- state / empty-state (Figma: "State – P2", node 26744:5115) ----
// Centred placeholder: an icon badge (reuses button colours) + title + subtitle
// + optional actions. Style=Card wraps it in a grey rounded panel.
export const emptyState = {
  cardBg: '#ECEDEC',
  cardRadius: 16,
  titleInk: '#151515', // Literata Bold 20
  subtitleInk: '#404140', // Inter 14
  width: 343,
  iconSizes: { lg: 48, md: 40, sm: 32 },
};

// ---- snackbar (Figma: "Snackbar – P2", node 26744:5114) ----
// Dark 343×56 pill: 12px light copy, optional leading icon, optional dark action
// pill, optional close (Dismissable=True). Sits over content with a low shadow.
export const snackbar = {
  bg: '#151515',
  border: '#B6B9B6',
  ink: '#FAFAFA',
  radius: 8,
  actionBg: '#383937',
  actionInk: '#FCFCFC',
  width: 343,
  minHeight: 56,
};

// ---- segmented control (Figma: "Segmented Control – P2", node 26744:5113) ----
// Pill track (#ECEDEC, 4px pad) of equal segments; the selected one is a white
// pill. Labels are Body/Body Medium Emphasized (Inter 500, 14).
export const segmented = {
  trackBg: '#ECEDEC',
  thumbBg: '#FAFAFA',
  pressedBg: 'rgba(0,0,0,0.08)',
  ink: '#151515',
  inkDisabled: '#404140',
  pad: 4,
};

// ---- search bar (Figma: "Search Bar – P2", node 26744:5112) ----
// 48px pill field: leading search glyph, input, trailing clear button when
// filled. Focus (Active) adds a 1px ink border; pressed/disabled shift the fill.
export const searchBar = {
  bg: '#ECEDEC',
  bgPressed: '#D9DAD9',
  bgDisabled: '#E3E4E3',
  focusBorder: '#151515',
  ink: '#151515',
  placeholder: '#606160',
  clearBg: '#D9DBD8',
  height: 48,
};

// ---- text input (Figma: "Text Input – P2", node 26734:5390) ----
// Label (+ optional tag) over a 48px field (#FAFAFA, 8px radius, 16 pad), over a
// helper line. State axis → borders: Focused ink, Error red, Disabled grey fill.
export const textInput = {
  bg: '#FAFAFA',
  bgDisabled: '#E3E4E3',
  border: '#B6B9B6',
  borderFocus: '#151515',
  borderError: '#DA3737',
  ink: '#151515',
  placeholder: '#606160',
  labelInk: '#151515',
  optionalInk: '#404140',
  helperInk: '#404140',
  errorInk: '#DA3737',
  height: 48,
  radius: 8,
};

// ---- card (Figma: "Card – P2", node 26744:5101) ----
// Grey rounded container: optional icon badge + title/subtitle, optional body,
// optional 1–2 actions (reuse <Button size="md">) laid out horizontal/vertical.
export const card = {
  bg: '#ECEDEC',
  radius: 16,
  padding: 20,
  gap: 12,
  titleInk: '#151515', // Literata Bold 20
  subtitleInk: '#404140', // Inter 14
  bodyInk: '#404140',
  iconBadgeBg: '#D9DBD8',
  iconBadgeSize: 48,
};

// ---- list (Figma: "List – P2", node 26744:5108) ----
// A ListItem row: optional before area (icon badge/avatar), title + optional
// subtitle, optional after area (checkbox/toggle/label/icon), optional divider.
// Style=List is edge-to-edge; Style=Card wraps the group in a grey panel.
export const list = {
  titleInk: '#151515', // Body Large 16
  subtitleInk: '#404140', // Body Medium 14
  pressedList: '#E6E6E6',
  pressedCard: '#D9DAD9',
  cardBg: '#ECEDEC',
  cardRadius: 16,
  rowRadius: 12,
  beforeBadgeBg: '#D9DBD8',
  beforeBadgeSize: 40,
};

// ---- dropdown menu (Figma: "Dropdown Menu – P2", node 26744:5106) ----
// Floating surface (#FAFAFA, 8px radius, low shadow, 8px pad) of menu items;
// each item is a row (title + optional subtitle + trailing icon) that darkens
// while pressed.
export const menu = {
  bg: '#FAFAFA',
  border: '#C8CAC8', // 1px hairline around the surface (Figma "Dropdown Menu")
  radius: 16,
  itemRadius: 12,
  pressed: '#E6E6E6',
  titleInk: '#151515', // Body Large 16
  subtitleInk: '#404140', // Body Medium 14
  width: 208,
};

// ---- navigation bar (Figma: "Navigation bar – P2", node 26744:6012) ----
// Top bar: leading Back/Close button, a title (+ subtitle), 0–2 trailing ghost
// icon actions, optional bottom divider. Size=Small centres the title; Size=Large
// stacks a big serif title below the button row.
export const navbar = {
  bg: '#FAFAFA',
  titleInk: '#151515', // Literata
  subtitleInk: '#404140',
  height: 56,
};

// ---- tab bar (Figma: "Tab Bar – P2", node 26744:5116) ----
// Bottom nav of equal icon+label tabs. The active tab darkens its label and
// shows a subtle pill behind the icon; an Emphasized tab gets a green pill.
export const tabBar = {
  bg: '#FAFAFA',
  borderTop: '#B6B9B6',
  labelInactive: '#404140',
  labelActive: '#151515',
  activePill: '#ECEDEC',
  emphasizedPill: colors.green,
  pressedPill: 'rgba(0,0,0,0.08)',
};

// ---- avatar (Figma: "Avatar - P3", node 26744:5099) ----
// Circular Photo / Initials / Overflow ("+N") avatar in four sizes. Overflow
// dims a photo with a dark scrim and light text. AvatarGroup overlaps them with
// a light ring between.
export const avatar = {
  bg: '#ECEDEC',
  initialsInk: '#151515',
  overflowInk: '#FAFAFA',
  overflowScrim: 'rgba(21,21,21,0.4)',
  ring: '#FAFAFA',
  sizes: { xs: 24, sm: 32, md: 40, lg: 56 },
  fontSizes: { xs: 10, sm: 12, md: 14, lg: 20 },
};

// ---- overlay (Figma: "Overlay - P3", node 26744:5110) ----
// Full-screen scrim behind modal content; Figma uses a #FAFAFA layer at 0.85.
export const overlay = { color: '#FAFAFA', opacity: 0.85 };

// ---- tabs (Figma: "Tabs - P3", node 26744:5117) ----
// Top underline tabs: optional icon + 14px label, a green underline under the
// active tab, a hairline along the bottom. Pressed tabs get a subtle pill.
export const tabs = {
  ink: '#151515',
  inkDisabled: '#404140',
  underline: colors.green,
  border: '#B6B9B6',
  pressed: 'rgba(0,0,0,0.08)',
  height: 40,
};

// ---- bottom sheet (Figma: "Bottom Sheet – P2", node 26744:6931) ----
// Confirmation-style sheet: grabber + optional close, status icon, title,
// description, primary/secondary actions (reuse <Button>), caption.
export const sheet = {
  bg: '#F1F2F1',
  handle: '#606160',
  radiusTop: 16, // Figma top corners; overrides the prototype's radius.sheet
  statusIconBg: '#D9DBD8',
  closeBg: '#D9DBD8',
  titleInk: '#151515', // Inter Bold 18/22
  bodyInk: '#404140', // description 16/24, caption 12/16
};

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

export default { colors, badge, button, card, chip, menu, navbar, tabBar, tabs, avatar, overlay, sheet, divider, toggle, checkbox, radio, loading, emptyState, snackbar, segmented, searchBar, textInput, list, radius, spacing, fonts, fontSize, shadow, controls, motion };
