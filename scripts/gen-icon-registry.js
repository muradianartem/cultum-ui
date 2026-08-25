const fs = require('fs');
const path = require('path');

const SRC = path.join(process.cwd(), 'assets/icons');
const OUT = path.join(process.cwd(), 'components/iconRegistry.js');

// Multicolor brand logos — keep their original fills, don't recolor.
const BRAND = new Set(['apple', 'facebook', 'google', 'x']);

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.svg')).sort();

const entries = files.map((file) => {
  const name = file.replace(/\.svg$/, '');
  let xml = fs.readFileSync(path.join(SRC, file), 'utf8');

  if (!BRAND.has(name)) {
    // Monochrome icons: let the Icon component's `color` prop drive them.
    xml = xml.replace(/fill="#151515"/g, 'fill="currentColor"');
  }

  // Collapse whitespace between tags so the registry stays compact.
  xml = xml.replace(/\n\s*/g, '').trim();

  return [name, xml];
});

const body = entries
  .map(([name, xml]) => `  ${JSON.stringify(name)}: ${JSON.stringify(xml)},`)
  .join('\n');

const out = `// AUTO-GENERATED from assets/icons/*.svg — do not edit by hand.
// Regenerate after adding icons. ${entries.length} icons.
// Monochrome icons use fill="currentColor" (driven by <Icon color>).
// Brand logos (${[...BRAND].join(', ')}) keep their original colors.

export const ICON_XML = {
${body}
};

export const ICON_NAMES = Object.keys(ICON_XML);
`;

fs.writeFileSync(OUT, out);
console.log(`Wrote ${entries.length} icons to ${OUT}`);
