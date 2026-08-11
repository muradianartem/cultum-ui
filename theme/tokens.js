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

export default { colors, radius, spacing, fonts, fontSize, shadow, controls, motion };
