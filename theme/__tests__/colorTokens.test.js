import { primitives } from '../primitives';
import { colorTokens } from '../colorTokens';

// Every hex any ramp defines (incl. basic black/white) — used to prove tokens
// only ever reference real primitives.
const ALL_PRIMITIVE_HEXES = new Set(
  Object.values(primitives).flatMap((ramp) => Object.values(ramp))
);

// The semantic color sections whose leaves must resolve to a primitive in both
// modes (every section except `interaction`, which is exported separately and
// holds translucent rgba overlays rather than primitive colours).
const COLOR_SECTIONS = [
  'brand', 'background', 'surface', 'border', 'text',
  'disabled', 'information', 'success', 'warning', 'error', 'basic',
];

describe('color tokens', () => {
  test('brand-primary is the brand green (light primary-500 / dark primary-400)', () => {
    expect(colorTokens.brand.primary).toEqual({
      light: primitives.primary[500], // #93EC7C
      dark: primitives.primary[400],
    });
    expect(colorTokens.brand.primary.light).toBe('#93EC7C');
    expect(colorTokens.brand.onPrimary).toEqual({
      light: primitives.primary[975],
      dark: primitives.primary[975],
    });
  });

  test('spot-checks against Figma token→primitive references', () => {
    expect(colorTokens.brand.secondary.light).toBe(primitives.secondary[300]);
    expect(colorTokens.surface.primary.dark).toBe(primitives.primaryNeutral[900]);
    expect(colorTokens.error.onSecondary.light).toBe(primitives.error[900]);
    expect(colorTokens.text.primary.light).toBe(primitives.primaryNeutral[950]);
    expect(colorTokens.border.primary.light).toBe(primitives.primaryNeutral[400]);
  });

  test('all 12 semantic sections are present', () => {
    for (const section of COLOR_SECTIONS) {
      expect(colorTokens[section]).toBeDefined();
    }
  });

  test('every semantic token leaf has a light and a dark value', () => {
    for (const section of COLOR_SECTIONS) {
      for (const leaf of Object.values(colorTokens[section])) {
        expect(leaf).toHaveProperty('light');
        expect(leaf).toHaveProperty('dark');
      }
    }
  });

  test('every semantic token value references a real primitive (no hand-typed hex)', () => {
    for (const section of COLOR_SECTIONS) {
      for (const leaf of Object.values(colorTokens[section])) {
        expect(ALL_PRIMITIVE_HEXES.has(leaf.light)).toBe(true);
        expect(ALL_PRIMITIVE_HEXES.has(leaf.dark)).toBe(true);
      }
    }
  });
});
