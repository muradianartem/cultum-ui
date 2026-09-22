// Guards dark mode against regressions: app code takes its colours from the
// theme (useTheme()), never from literals. A hex or rgb()/rgba() in a component
// or screen stays light when the theme goes dark — exactly the half-themed look
// that kept dark mode switched off.
//
// The allowlist is by file AND value, so an exception covers only the colour it
// names. Every entry is a colour that must NOT follow the theme: scrims and glass
// over photography or the camera, the modal backdrop, the snackbar's action pill
// (constant in both Figma modes), and shadows.

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

const BACKDROP = 'rgba(14,18,11,0.4)';

const ALLOWED = {
  'theme/tokens.js': [
    'rgba(16,16,16,0.12)', 'rgba(16,16,16,0.11)', 'rgba(16,16,16,0.10)',
    'rgba(16,16,16,0.09)', 'rgb(25, 27, 21)',
  ],
  'components/BottomSheet.js': [BACKDROP],
  'components/Snackbar.js': ['#383937', '#FCFCFC'],
  'components/Avatar.js': ['rgba(21,21,21,0.4)', '#FAFAFA'],
  'screens/AddReminderSheet.js': [BACKDROP],
  'screens/TaskSheet.js': [BACKDROP],
  'screens/ProductPage.js': [
    '#0E120B', 'rgba(21,23,20,0.28)', 'rgba(21,23,20,0)', '#151714',
    'rgba(250,250,250,0.18)', 'rgba(250,250,250,0.34)', 'rgba(250,250,250,0.6)',
    '#FFFFFF', '#DADBDA',
  ],
  'screens/LoginScreen.js': [
    'rgba(13,15,10,0.5)', 'rgba(13,15,10,0.32)', 'rgba(13,15,10,0.9)', 'rgba(13,15,10,1)',
  ],
  'screens/PaywallScreen.js': ['rgba(13,15,10,0.45)', 'rgba(13,15,10,0.05)'],
  'screens/scan/ScanCameraScreen.js': [
    '#0E120B', '#151515', '#606160', '#FAFAFA', '#FFFFFF',
    'rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 'rgba(14,18,11,0.6)',
  ],
  'screens/scan/Viewfinder.js': ['rgba(0, 0, 0, 0.3)', '#FAFAFA'],
};

// Generated SVG markup, not styling.
const SKIP = new Set(['components/iconRegistry.js']);

function sourceFiles() {
  const out = ['App.js', 'theme/tokens.js'];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(rel);
      } else if (rel.endsWith('.js') && !SKIP.has(rel)) {
        out.push(rel);
      }
    }
  };
  walk('components');
  walk('screens');
  return out;
}

// Comments may quote colours (Figma references); only code counts.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

const COLOR = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b|rgba?\([^)]*\)/g;

test('components and screens read colours from the theme, not literals', () => {
  const violations = [];
  for (const rel of sourceFiles()) {
    const code = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const allowed = new Set(ALLOWED[rel] ?? []);
    for (const match of code.match(COLOR) ?? []) {
      if (!allowed.has(match)) violations.push(`${rel}: ${match}`);
    }
  }
  expect(violations).toEqual([]);
});

test('every allowlisted colour is still in use (keep the list honest)', () => {
  const stale = [];
  for (const [rel, values] of Object.entries(ALLOWED)) {
    const code = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    for (const value of values) {
      if (!code.includes(value)) stale.push(`${rel}: ${value}`);
    }
  }
  expect(stale).toEqual([]);
});
