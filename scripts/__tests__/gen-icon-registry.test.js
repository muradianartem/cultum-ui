import fs from 'fs';
import path from 'path';

const { build, normalise } = require('../gen-icon-registry');

const svg = (body) => `<svg viewBox="0 0 24 24" fill="none">${body}</svg>`;

test('a monochrome icon has its one ink turned into currentColor, whatever the hex', () => {
  const out = normalise('a', 'monochrome', svg('<path fill="black" fill-opacity="0.35"/><path stroke="black"/>'));
  expect(out).toBe(svg('<path fill="currentColor" fill-opacity="0.35"/><path stroke="currentColor"/>'));
});

test('clip-path colours are left alone and do not count as ink', () => {
  const clip = '<defs><clipPath id="c"><rect fill="white"/></clipPath></defs>';
  const out = normalise('a', 'monochrome', svg(`<g clip-path="url(#c)"><path fill="#151515"/></g>${clip}`));
  expect(out).toBe(svg(`<g clip-path="url(#c)"><path fill="currentColor"/></g>${clip}`));
});

test('a monochrome icon with two inks is rejected rather than half-tinted', () => {
  expect(() => normalise('two', 'monochrome', svg('<path fill="#151515"/><path fill="#FF0000"/>'))).toThrow(
    /two\.svg: monochrome icon has 2 ink colours/
  );
});

test('brand icons are copied as drawn, and flags cannot be bundled', () => {
  const logo = svg('<path fill="#4285F4"/><path fill="#EA4335"/>');
  expect(normalise('g', 'brand', logo)).toBe(logo);
  expect(() => normalise('f', 'flag', logo)).toThrow(/cannot be bundled/);
});

test('the checked-in registry is what the generator produces', () => {
  const onDisk = fs.readFileSync(path.join(__dirname, '../../components/iconRegistry.js'), 'utf8');
  expect(build()).toBe(onDisk);
});
