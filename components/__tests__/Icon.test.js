import fs from 'fs';
import path from 'path';
import TestRenderer, { act } from 'react-test-renderer';
import manifest from '../../design-system/icon-manifest.json';
import { ICON_XML, ICON_NAMES } from '../iconRegistry';
import Icon from '../Icon';

const ROOT = path.resolve(__dirname, '../..');
const ASSETS = fs
  .readdirSync(path.join(ROOT, 'assets/icons'))
  .filter((f) => f.endsWith('.svg'))
  .map((f) => f.replace(/\.svg$/, ''))
  .sort();

const all = [...manifest.icons, ...manifest.localExtensions];
const bundled = all.filter((e) => e.status === 'bundled');
const kindOf = Object.fromEntries(bundled.map((e) => [e.localName, e.kind]));

describe('icon manifest', () => {
  test('catalogues every Figma icon component: 157 icons and 260 flags', () => {
    expect(manifest.icons).toHaveLength(417);
    expect(manifest.icons.filter((e) => e.kind !== 'flag')).toHaveLength(157);
    expect(manifest.icons.filter((e) => e.kind === 'flag')).toHaveLength(260);
    expect(new Set(manifest.icons.map((e) => e.node)).size).toBe(417);
  });

  test('every non-flag Figma icon is bundled', () => {
    const notBundled = manifest.icons.filter((e) => e.kind !== 'flag' && e.status !== 'bundled');
    expect(notBundled.map((e) => e.figmaName)).toEqual([]);
  });

  test('flags are deferred, not bundled', () => {
    for (const e of manifest.icons.filter((i) => i.kind === 'flag')) {
      expect(e.status).toBe('deferred-unused');
      expect(ICON_XML[e.localName]).toBeUndefined();
    }
  });

  test('local names are unique', () => {
    const names = all.map((e) => e.localName);
    expect(names.length).toBe(new Set(names).size);
  });

  test('the documented aliases point at real Figma names', () => {
    for (const [local, figmaName] of Object.entries(manifest.aliases)) {
      expect(manifest.icons.find((e) => e.figmaName === figmaName)?.localName).toBe(local);
    }
  });
});

describe('assets, manifest and registry agree', () => {
  test('the bundled set is exactly the SVG files on disk', () => {
    expect(bundled.map((e) => e.localName).sort()).toEqual(ASSETS);
  });

  test('the registry holds exactly the SVG files on disk', () => {
    expect([...ICON_NAMES].sort()).toEqual(ASSETS);
  });

  test('monochrome icons draw only in currentColor', () => {
    for (const name of ICON_NAMES.filter((n) => kindOf[n] === 'monochrome')) {
      const drawn = ICON_XML[name].replace(/<(clipPath|mask)\b[\s\S]*?<\/\1>/g, '');
      const inks = [...drawn.matchAll(/(?:fill|stroke|stop-color)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((v) => v !== 'none');
      expect([name, [...new Set(inks)]]).toEqual([name, inks.length ? ['currentColor'] : []]);
    }
  });

  test('brand logos keep their own colours', () => {
    for (const name of ICON_NAMES.filter((n) => kindOf[n] === 'brand')) {
      expect([name, ICON_XML[name].includes('currentColor')]).toEqual([name, false]);
    }
  });
});

// A literal <Icon name="…"> anywhere in the app must resolve; an unknown name
// renders nothing, silently, in production.
test('every literal <Icon name> in the app is bundled', () => {
  const files = [];
  const walk = (dir) => {
    for (const d of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (d.name !== '__tests__') walk(rel);
      } else if (rel.endsWith('.js') && !rel.endsWith('iconRegistry.js')) files.push(rel);
    }
  };
  ['components', 'screens', 'billing'].forEach(walk);
  const unknown = [];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const [, name] of src.matchAll(/<Icon\s+name="([^"]+)"/g)) {
      if (!ICON_XML[name]) unknown.push(`${rel}: ${name}`);
    }
  }
  expect(unknown).toEqual([]);
});

describe('<Icon>', () => {
  const render = (el) => {
    let tree;
    act(() => {
      tree = TestRenderer.create(el);
    });
    return tree;
  };

  test('renders a known glyph at the requested size and colour', () => {
    const node = render(<Icon name="all-inclusive" size={20} color="#123456" />).root.findByProps({
      xml: ICON_XML['all-inclusive'],
    });
    expect(node.props).toMatchObject({ width: 20, height: 20, color: '#123456' });
  });

  test('an unknown name renders nothing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(render(<Icon name="no-such-icon" />).toJSON()).toBeNull();
    warn.mockRestore();
  });
});
