import { primitives, STEPS } from '../primitives';

// The canonical 17-step scale every ramp shares (Figma "Base" step keyed 500).
const CANONICAL_STEPS = [25, 50, 75, 100, 150, 200, 300, 400, 500, 600, 700, 750, 800, 850, 925, 950, 975];

const RAMPS = [
  'primary', 'secondary', 'primaryNeutral',
  'warning', 'information', 'error', 'success', 'neutral',
  'custom1', 'custom2', 'custom3', 'custom4', 'custom5',
];

describe('color primitives', () => {
  test('exposes the canonical step scale', () => {
    expect(STEPS).toEqual(CANONICAL_STEPS);
  });

  test('all 13 ramps contain the 17 canonical steps as valid 6-digit hex', () => {
    for (const ramp of RAMPS) {
      expect(primitives[ramp]).toBeDefined();
      for (const step of CANONICAL_STEPS) {
        expect(primitives[ramp][step]).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  // Three ramps carry an extra intermediate 900 step (referenced by tokens but
  // not plotted on the primitives doc page); captured from the token swatch.
  test('primaryNeutral / warning / error carry the extra 900 step', () => {
    expect(primitives.primaryNeutral[900]).toBe('#232323');
    expect(primitives.warning[900]).toBe('#302017');
    expect(primitives.error[900]).toBe('#2D1410');
  });

  // Anchors verified directly against the Figma primitives page (node 27835:8644).
  test('base (500) steps match Figma', () => {
    expect(primitives.primary[500]).toBe('#93EC7C'); // brand green
    expect(primitives.error[500]).toBe('#DA3737');
    expect(primitives.success[500]).toBe('#55DA6B');
    expect(primitives.warning[500]).toBe('#F49258');
    expect(primitives.information[500]).toBe('#19ACFF');
  });

  test('exposes theme-independent basic black/white', () => {
    expect(primitives.basic).toEqual({ black: '#000000', white: '#FFFFFF' });
  });
});
