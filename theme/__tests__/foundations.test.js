import { radius, space, stroke, blur, opacity, typography } from '../foundations';

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

describe('typography scale (Figma)', () => {
  const NAMES = [
    'display',
    'headingLarge', 'headingLargeEmphasized',
    'headingMedium', 'headingMediumEmphasized',
    'headingSmall', 'headingSmallEmphasized',
    'bodyLarge', 'bodyLargeEmphasized',
    'bodyMedium', 'bodyMediumEmphasized',
    'bodySmall', 'bodySmallEmphasized',
    'buttonMedium', 'buttonSmall',
    'caption', 'captionEmphasized',
  ];

  test('exposes all 17 Figma text styles', () => {
    expect(Object.keys(typography).sort()).toEqual([...NAMES].sort());
  });

  test('every style is a complete RN text style', () => {
    for (const name of NAMES) {
      const s = typography[name];
      expect(s.fontFamily).toBe('Inter');
      expect(typeof s.fontSize).toBe('number');
      expect(typeof s.lineHeight).toBe('number');
      expect(['400', '500', '700']).toContain(s.fontWeight);
    }
  });

  test('anchor styles match Figma (size / weight / 120–140% line height)', () => {
    expect(typography.display).toMatchObject({ fontSize: 40, fontWeight: '700', lineHeight: 48 });
    expect(typography.headingSmall).toMatchObject({ fontSize: 20, fontWeight: '400', lineHeight: 26 }); // 130%
    expect(typography.bodyMedium).toMatchObject({ fontSize: 14, fontWeight: '400', lineHeight: 19.6 }); // 140%
    expect(typography.buttonMedium).toMatchObject({ fontSize: 16, fontWeight: '500', lineHeight: 19.2 }); // 120%
  });
});
