// Builds the app icon, Android adaptive icon layers, splash image and favicon
// from assets/brand/logo.svg (Figma App Design, component "Logo" 268:7177).
//
// The logo is a rounded #93EC7C tile with the dark mark on it. Each output
// re-frames that SVG rather than redrawing it:
//   icon.png                  square, opaque, full-bleed — iOS applies its own
//                             corner mask, so the tile's rounding is dropped.
//   android-icon-foreground   mark only, inside the adaptive-icon safe zone
//                             (inner 66 of 108dp).
//   android-icon-background   solid tile colour.
//   android-icon-monochrome   mark only, white — Android uses its alpha.
//   splash-icon.png           the rounded tile as drawn, on transparency.
//   favicon.png               the rounded tile.
//
//   node scripts/gen-app-icons.js

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const logo = fs.readFileSync(path.join(ASSETS, 'brand/logo.svg'), 'utf8');

const TILE = logo.match(/<rect\b[^>]*fill="(#[0-9A-Fa-f]{6})"/)[1];
const MARK = logo.match(/<g id="mark"[\s\S]*?<\/g>/)[0];

// Padding around the 88-unit tile that puts the mark (~70 units wide) inside
// the adaptive icon's 66/108 safe zone.
const ADAPTIVE_VIEWBOX = '-15 -15 118 118';

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">${body}</svg>`;

const outputs = [
  ['icon.png', 1024, svg('0 0 88 88', `<rect width="88" height="88" fill="${TILE}"/>${MARK}`)],
  ['android-icon-foreground.png', 512, svg(ADAPTIVE_VIEWBOX, MARK)],
  ['android-icon-background.png', 512, svg('0 0 88 88', `<rect width="88" height="88" fill="${TILE}"/>`)],
  ['android-icon-monochrome.png', 432, svg(ADAPTIVE_VIEWBOX, MARK.replace(/stroke="#[0-9A-Fa-f]{6}"/, 'stroke="#FFFFFF"'))],
  ['splash-icon.png', 1024, logo],
  ['favicon.png', 48, logo],
];

for (const [file, size, source] of outputs) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(ASSETS, file), png);
  console.log(`assets/${file} ${size}×${size}`);
}
