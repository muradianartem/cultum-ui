import { radius, space, stroke, blur, opacity, typography, typographyMeta, paragraphSpacing } from '../foundations';
import { FONT_FACES, FONT_FAMILIES, fontFace } from '../fonts';

describe('foundation scales (Figma)', () => {
  test('radius scale matches Figma', () => {
    expect(radius).toEqual({ 0: 0, 4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32, full: 9999 });
  });

  test('spacing scale matches Figma', () => {
    expect(space).toEqual({ 0: 0, 2: 2, 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32, 48: 48 });
  });

  test('stroke scale matches Figma', () => {
    expect(stroke).toEqual({ 1: 1, 2: 2, 8: 8 });
  });

  test('blur scale matches Figma', () => {
    expect(blur).toEqual({ 8: 8, 16: 16, 32: 32 });
  });

  test('opacity scale is fractional (Figma percentages)', () => {
    expect(opacity).toEqual({ 0: 0, 25: 0.25, 50: 0.5, 75: 0.75, 100: 1 });
  });
});

// Values are checked against the reviewed Figma snapshot in figmaParity.test.js;
// these check the shape the rest of the app relies on.
describe('typography styles', () => {
  test('every style is a spreadable RN text style naming a bundled face', () => {
    for (const [name, s] of Object.entries(typography)) {
      expect(Object.keys(s).sort()).toEqual(['fontFamily', 'fontSize', 'lineHeight']);
      expect(FONT_FACES[s.fontFamily]).toBeDefined();
      expect(s.fontFamily).toBe(FONT_FAMILIES[typographyMeta[name].family][typographyMeta[name].weight]);
    }
  });

  // The weight lives in the face. A fontWeight on top would make Android and the
  // web synthesise a bolder copy of an already-bold file.
  test('no style carries a fontWeight', () => {
    for (const s of Object.values(typography)) expect(s).not.toHaveProperty('fontWeight');
  });

  test('metadata and runtime styles cover the same names', () => {
    expect(Object.keys(typography)).toEqual(Object.keys(typographyMeta));
  });

  test('paragraph spacing is metadata, not part of any style', () => {
    expect(paragraphSpacing).toEqual({ bodyLarge: 8, bodyMedium: 8, bodySmall: 4 });
    for (const s of Object.values(typography)) expect(s).not.toHaveProperty('marginBottom');
  });
});

describe('fontFace', () => {
  test('throws for a face that is not bundled rather than falling back', () => {
    expect(() => fontFace('Literata', 500)).toThrow(/No bundled face/);
    expect(() => fontFace('Helvetica', 400)).toThrow(/No bundled face/);
  });
});
