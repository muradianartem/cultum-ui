// Cultum color primitives — the raw shade ramps, imported from Figma.
//
// Source of truth: Figma "Cultum.app – Design System", page "Color Primitives"
// (fileKey JyrSo87oacbcbALO8JO9At, node 27835:8644). Re-extracted 2026-08-25.
//
// GENERATED from the Figma page — do not hand-edit values. Every ramp shares the
// 17-step scale (Figma labels the mid step "Base"; keyed 500). Three ramps also
// carry a 900 step that the doc page doesn't plot but tokens reference; those are
// captured from the referencing token's swatch. `basic` is the theme-independent
// black/white pair. Nothing outside theme/ imports these directly — components
// consume semantic tokens (colorTokens.js).

export const STEPS = [25, 50, 75, 100, 150, 200, 300, 400, 500, 600, 700, 750, 800, 850, 925, 950, 975];

export const primitives = {
  // Primary
  primary: { 25: '#FAFEF8', 50: '#F5FDF2', 75: '#F0FDEB', 100: '#EBFCE5', 150: '#E1FAD8', 200: '#D7F8CB', 300: '#C2F4B1', 400: '#ABF097', 500: '#93EC7C', 600: '#74B862', 700: '#57864A', 750: '#496F3E', 800: '#3B5833', 850: '#2E4228', 925: '#1B2418', 950: '#151A12', 975: '#0C100A' },
  // Secondary
  secondary: { 25: '#FCFCFC', 50: '#F9F9F8', 75: '#F5F6F5', 100: '#F2F3F2', 150: '#ECEDEB', 200: '#E5E7E5', 300: '#D9DBD8', 400: '#CCD0CB', 500: '#C0C4BE', 600: '#969995', 700: '#6E716D', 750: '#5B5D5B', 800: '#494A48', 850: '#383937', 925: '#1F1F1F', 950: '#171717', 975: '#0E0E0E' },
  // Primary Neutral
  primaryNeutral: { 25: '#FAFAFA', 50: '#F6F6F6', 75: '#F1F2F1', 100: '#ECEDEC', 150: '#E3E4E3', 200: '#DADBDA', 300: '#C8CAC8', 400: '#B6B9B6', 500: '#A5A8A5', 600: '#828482', 700: '#606160', 750: '#505150', 800: '#404140', 850: '#313231', 900: '#232323', 925: '#1C1C1C', 950: '#151515', 975: '#0C0C0C' },
  // Warning
  warning: { 25: '#FFF9F6', 50: '#FFF4EE', 75: '#FFEEE5', 100: '#FFE9DC', 150: '#FFDECB', 200: '#FFD3BA', 300: '#FFBD99', 400: '#FAA878', 500: '#F49258', 600: '#BF7347', 700: '#8C5636', 750: '#74482E', 800: '#5C3A26', 850: '#462D1E', 900: '#302017', 925: '#261A13', 950: '#1C140E', 975: '#120B07' },
  // Information
  information: { 25: '#F7FBFF', 50: '#EFF6FF', 75: '#E7F2FF', 100: '#DFEEFF', 150: '#CFE5FF', 200: '#BEDDFF', 300: '#99CCFF', 400: '#6CBCFF', 500: '#19ACFF', 600: '#2487C6', 700: '#256491', 750: '#235377', 800: '#20425E', 850: '#1C3347', 925: '#131D26', 950: '#10151C', 975: '#080D11' },
  // Error
  error: { 25: '#FFF6F4', 50: '#FFECE9', 75: '#FFE3DE', 100: '#FFD9D4', 150: '#FFC7BF', 200: '#FCB4AA', 300: '#F48E82', 400: '#E9665B', 500: '#DA3737', 600: '#AB302D', 700: '#7F2724', 750: '#69231F', 800: '#541E1A', 850: '#401916', 900: '#2D1410', 925: '#24110D', 950: '#1C0D09', 975: '#120604' },
  // Success
  success: { 25: '#F8FDF7', 50: '#F0FCF0', 75: '#E9FAE9', 100: '#E1F9E1', 150: '#D2F5D2', 200: '#C3F2C3', 300: '#A3EAA6', 400: '#80E289', 500: '#55DA6B', 600: '#47AA55', 700: '#387D41', 750: '#306737', 800: '#29522D', 850: '#213E23', 925: '#152216', 950: '#111910', 975: '#090F09' },
  // Neutral
  neutral: { 25: '#FBFBFC', 50: '#F8F8F9', 75: '#F4F4F5', 100: '#F1F0F2', 150: '#EAE9EC', 200: '#E3E2E5', 300: '#D5D3D9', 400: '#C7C5CC', 500: '#B9B7C0', 600: '#918F96', 700: '#6B6A6E', 750: '#58585B', 800: '#474649', 850: '#363538', 925: '#1E1E1F', 950: '#171617', 975: '#0D0D0E' },
  // Custom 1
  custom1: { 25: '#FBFBFB', 50: '#F7F7F7', 75: '#F3F3F3', 100: '#EFEFEF', 150: '#E7E7E7', 200: '#DFDFDF', 300: '#D0D0D0', 400: '#C0C0C0', 500: '#B1B1B1', 600: '#8B8B8B', 700: '#666666', 750: '#555555', 800: '#444444', 850: '#343434', 925: '#1D1D1D', 950: '#161616', 975: '#0D0D0D' },
  // Custom 2
  custom2: { 25: '#FBFBFB', 50: '#F7F7F7', 75: '#F3F3F3', 100: '#EFEFEF', 150: '#E7E7E7', 200: '#DFDFDF', 300: '#D0D0D0', 400: '#C0C0C0', 500: '#B1B1B1', 600: '#8B8B8B', 700: '#666666', 750: '#555555', 800: '#444444', 850: '#343434', 925: '#1D1D1D', 950: '#161616', 975: '#0D0D0D' },
  // Custom 3
  custom3: { 25: '#FBFBFB', 50: '#F7F7F7', 75: '#F3F3F3', 100: '#EFEFEF', 150: '#E7E7E7', 200: '#DFDFDF', 300: '#D0D0D0', 400: '#C0C0C0', 500: '#B1B1B1', 600: '#8B8B8B', 700: '#666666', 750: '#555555', 800: '#444444', 850: '#343434', 925: '#1D1D1D', 950: '#161616', 975: '#0D0D0D' },
  // Custom 4
  custom4: { 25: '#FBFBFB', 50: '#F7F7F7', 75: '#F3F3F3', 100: '#EFEFEF', 150: '#E7E7E7', 200: '#DFDFDF', 300: '#D0D0D0', 400: '#C0C0C0', 500: '#B1B1B1', 600: '#8B8B8B', 700: '#666666', 750: '#555555', 800: '#444444', 850: '#343434', 925: '#1D1D1D', 950: '#161616', 975: '#0D0D0D' },
  // Custom 5
  custom5: { 25: '#FBFBFB', 50: '#F7F7F7', 75: '#F3F3F3', 100: '#EFEFEF', 150: '#E7E7E7', 200: '#DFDFDF', 300: '#D0D0D0', 400: '#C0C0C0', 500: '#B1B1B1', 600: '#8B8B8B', 700: '#666666', 750: '#555555', 800: '#444444', 850: '#343434', 925: '#1D1D1D', 950: '#161616', 975: '#0D0D0D' },
  // Basic — absolute black/white, theme-independent
  basic: { black: '#000000', white: '#FFFFFF' },
};

export default primitives;
