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
// Axes: Type (variant) × Destructive × Size × State. `bg`/`bgPressed`/`fg`
// (+ `border` where drawn); disabled + font live below. Type=Primary enabled
// is the brand green, so it reuses colors.green. Sizes: lg 56 / md 48 / sm 40,
// pad 20/16/16, gap 8; label Inter Medium 500 (16 for lg+md, 14 for sm).
export const button = {
  primary: { bg: colors.green, bgPressed: '#9CEE86', fg: '#0C100A' },
  secondary: { bg: '#D9DBD8', bgPressed: '#C8C9C7', fg: '#151515' },
  outline: { bg: '#FAFAFA', bgPressed: '#B6B9B6', fg: '#151515', border: '#B6B9B6' },
  ghost: { bg: 'transparent', bgPressed: '#E3E4E3', fg: '#151515' },
  // Destructive=True
  dangerPrimary: { bg: '#DA3737', bgPressed: '#DD4747', fg: '#FFF6F4' },
  dangerSecondary: { bg: '#FFC7BF', bgPressed: '#EBB7B0', fg: '#2D1410' },
  dangerOutline: { bg: '#FAFAFA', bgPressed: '#EBB7B0', fg: '#DA3737', border: '#DA3737' },
  dangerGhost: { bg: 'transparent', bgPressed: '#FFC7BF', fg: '#DA3737' },
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

// ---- toggle (Figma: "Toggle – P1", node 26744:5118) ----
// 60×28 pill track; a wide 34×22 thumb slides left↔right (3↔23) and shifts
// grey→green with the on/off state. Track darkens while pressed.
export const toggle = {
  track: '#ECEDEC',
  trackPressed: '#D9DAD9',
  thumbOff: '#B6B9B6',
  thumbOn: colors.green,
  width: 60,
  height: 28,
  thumbW: 34,
  thumbH: 22,
  pad: 3,
};

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

export default { colors, badge, button, chip, sheet, divider, toggle, checkbox, radio, radius, spacing, fonts, fontSize, shadow, controls, motion };
