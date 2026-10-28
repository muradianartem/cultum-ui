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

// Framing taken from the Release Files "App Icon (iOS, Android)" canvas
// (JGm5p5KryioMadlTw2RvM7, 5036:9641). Its exports are this same mark, only
// translated and scaled:
//   iOS 1024 / Play 512       mark nudged 1.853 left, 0.88 down (optically centred).
//   Android foreground 432    mark ~38% of the canvas, well inside the dashed
//                             safe-zone circle.
const STORE_VIEWBOX = '1.853 -0.88 88 88';
const ADAPTIVE_VIEWBOX = '-42.148 -41.51 166.039 166.039';

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">${body}</svg>`;
const fill = `<rect x="-100" y="-100" width="300" height="300" fill="${TILE}"/>`;

const outputs = [
  ['icon.png', 1024, svg(STORE_VIEWBOX, fill + MARK)],
  ['android-icon-foreground.png', 432, svg(ADAPTIVE_VIEWBOX, MARK)],
  ['android-icon-background.png', 432, svg(ADAPTIVE_VIEWBOX, fill)],
  ['android-icon-monochrome.png', 432, svg(ADAPTIVE_VIEWBOX, MARK.replace(/stroke="#[0-9A-Fa-f]{6}"/, 'stroke="#FFFFFF"'))],
  ['splash-icon.png', 1024, logo],
  ['favicon.png', 48, logo],
];

for (const [file, size, source] of outputs) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(ASSETS, file), png);
  console.log(`assets/${file} ${size}×${size}`);
}
