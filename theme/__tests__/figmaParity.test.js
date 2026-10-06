// Drift check: the theme against design-system/figma-foundations.json.
//
// The snapshot was captured from the Figma file and reviewed by hand. Nothing
// here derives expected values from theme/ itself — a change to a token that
// isn't also a reviewed change to the snapshot fails. To take a Figma update,
// follow docs/figma-import.md ("Refreshing the foundations snapshot").

import fs from 'fs';
import path from 'path';
import figma from '../../design-system/figma-foundations.json';
import { primitives } from '../primitives';
import { colorTokens, interaction } from '../colorTokens';
import { radius, space, stroke, blur, opacity, typography, typographyMeta, paragraphSpacing } from '../foundations';
import { FONT_FACES, FONT_FAMILIES } from '../fonts';
import * as tokens from '../tokens';
import exceptions from '../../design-system/exceptions.json';

describe('scales', () => {
  test('radius, spacing, stroke and blur equal the Figma pages', () => {
    expect(radius).toEqual(figma.scales.radius);
    expect(space).toEqual(figma.scales.space);
    expect(stroke).toEqual(figma.scales.stroke);
    expect(blur).toEqual(figma.scales.blur);
  });

  test('opacity is the Figma percentage as a fraction', () => {
    const expected = Object.fromEntries(
      Object.entries(figma.scales.opacityPercent).map(([k, v]) => [k, v / 100])
    );
    expect(opacity).toEqual(expected);
  });
});

describe('typography', () => {
  test('the app defines exactly the 19 Figma text styles', () => {
    expect(Object.keys(typographyMeta).sort()).toEqual(Object.keys(figma.typography).sort());
    expect(Object.keys(figma.typography)).toHaveLength(19);
  });

  test.each(Object.entries(figma.typography))('%s matches Figma', (name, f) => {
    expect(typographyMeta[name]).toEqual({
      family: f.family,
      weight: f.weight,
      fontSize: f.fontSize,
      lineHeight: f.lineHeight,
    });
    expect(typography[name]).toEqual({
      fontFamily: FONT_FAMILIES[f.family][f.weight],
      fontSize: f.fontSize,
      lineHeight: f.lineHeight,
    });
  });

  test('every face a style renders in is registered for loading', () => {
    for (const s of Object.values(typography)) expect(FONT_FACES[s.fontFamily]).toBeTruthy();
  });

  test('paragraph spacing matches the applied Body styles', () => {
    const expected = Object.fromEntries(
      Object.entries(figma.typography)
        .filter(([, f]) => f.paragraphSpacing)
        .map(([name, f]) => [name, f.paragraphSpacing.value])
    );
    expect(paragraphSpacing).toEqual(expected);
  });
});

describe('colour primitives', () => {
  test('all 13 plotted ramps × 17 steps equal the Figma page (221 values)', () => {
    let count = 0;
    for (const [ramp, steps] of Object.entries(figma.primitives)) {
      for (const [step, hex] of Object.entries(steps)) {
        expect([ramp, step, primitives[ramp][step]]).toEqual([ramp, step, hex]);
        count += 1;
      }
    }
    expect(count).toBe(221);
  });

  // Not plotted on the primitives page, but named by semantic tokens.
  test('semantic-only 900 steps equal the swatches that reference them', () => {
    for (const [ramp, steps] of Object.entries(figma.semanticOnlySteps)) {
      for (const [step, { hex }] of Object.entries(steps)) {
        expect([ramp, step, primitives[ramp][step]]).toEqual([ramp, step, hex]);
      }
    }
  });

  test('ramps carry no step Figma does not define', () => {
    for (const [ramp, steps] of Object.entries(primitives)) {
      if (ramp === 'basic') continue;
      const known = new Set([
        ...Object.keys(figma.primitives[ramp]),
        ...Object.keys(figma.semanticOnlySteps[ramp] ?? {}),
      ]);
      expect(Object.keys(steps).filter((s) => !known.has(s))).toEqual([]);
    }
  });
});

describe('semantic colours', () => {
  const BASIC = { black: [0, 0, 0], white: [255, 255, 255] };
  const hexOf = (ref) => {
    if (ref.basic) {
      if (ref.alpha === undefined) return ref.basic === 'black' ? '#000000' : '#FFFFFF';
      return `rgba(${BASIC[ref.basic].join(',')},${ref.alpha})`;
    }
    return figma.primitives[ref.ramp]?.[ref.step] ?? figma.semanticOnlySteps[ref.ramp][ref.step].hex;
  };
  const resolve = (path) => {
    const [group, leaf] = path.split('.');
    return (group === 'interaction' ? interaction : colorTokens[group])?.[leaf];
  };

  test('all 58 documented rows are covered', () => {
    expect(figma.semantic).toHaveLength(58);
  });

  test.each(figma.semantic.map((row) => [row.figmaName, row]))('%s', (_, row) => {
    expect(resolve(row.appPath)).toEqual({ light: hexOf(row.light), dark: hexOf(row.dark) });
  });

  test('the app defines no semantic colour Figma does not document', () => {
    const documented = new Set(figma.semantic.map((r) => r.appPath));
    const defined = [
      ...Object.entries(colorTokens).flatMap(([g, leaves]) => Object.keys(leaves).map((l) => `${g}.${l}`)),
      ...Object.keys(interaction).map((l) => `interaction.${l}`),
    ];
    expect(defined.filter((p) => !documented.has(p))).toEqual([]);
  });
});

describe('elevation', () => {
  test.each(['low', 'medium'])('%s is the Figma effect style, layer for layer', (level) => {
    const layers = tokens.elevation[level].boxShadow.split(/,\s+(?=\d)/);
    expect(layers).toEqual(figma.elevation[level]);
  });
});

// ---- guards: consumers take type and geometry from the foundations ----

const ROOT = path.resolve(__dirname, '../..');
const appFiles = () => {
  const out = [];
  const walk = (dir) => {
    for (const d of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (d.name !== '__tests__') walk(rel);
      } else if (rel.endsWith('.js') && !rel.endsWith('iconRegistry.js')) out.push(rel);
    }
  };
  ['components', 'screens', 'billing'].forEach(walk);
  return out;
};
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const excused = (rel, prop) =>
  exceptions.exceptions.some((x) => x.consumer === rel && x.properties.includes(prop));

describe('guards', () => {
  test('every exception names a file that exists and says where it comes from', () => {
    for (const x of exceptions.exceptions) {
      expect([x.id, fs.existsSync(path.join(ROOT, x.consumer))]).toEqual([x.id, true]);
      expect(['verified-figma', 'unresolved']).toContain(x.status);
      expect(x.reason.length).toBeGreaterThan(10);
    }
  });

  test('no fontFamily is a bare string — faces come from typography or fontFace()', () => {
    const offenders = appFiles().filter((rel) => /fontFamily:\s*['"]/.test(read(rel)));
    expect(offenders).toEqual([]);
  });

  // A raw size, line height, tracking, weight or face is a departure from the
  // named styles; each one has to be recorded in design-system/exceptions.json.
  test.each(['fontSize', 'lineHeight', 'letterSpacing', 'fontWeight', 'fontFamily'])(
    'every raw %s is a recorded exception',
    (prop) => {
      const re = new RegExp(`\\b${prop}:`);
      const offenders = appFiles().filter((rel) => re.test(read(rel)) && !excused(rel, prop));
      expect(offenders).toEqual([]);
    }
  );

  test('the prototype token families are gone and nothing imports them', () => {
    const exported = Object.keys(tokens);
    for (const name of ['radius', 'spacing', 'fonts', 'fontSize', 'controls']) {
      expect(exported).not.toContain(name);
    }
    const legacy = /import\s*\{[^}]*\b(radius|spacing|fonts|fontSize|controls)\b[^}]*\}\s*from\s*'[./]*theme\/tokens'/;
    expect(appFiles().filter((rel) => legacy.test(read(rel)))).toEqual([]);
  });
});
