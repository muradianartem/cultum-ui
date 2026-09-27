import { truncateText } from '../truncateText';

const LONG =
  'The ZZ plant is a tropical perennial native to eastern Africa, from Kenya ' +
  'to northeastern South Africa. It is grown as an ornamental plant for its ' +
  'glossy foliage and tolerance of low light.';

test('short text comes back untouched', () => {
  expect(truncateText('A hardy succulent.')).toEqual({
    text: 'A hardy succulent.',
    full: 'A hardy succulent.',
    truncated: false,
  });
});

test('whitespace runs collapse to single spaces', () => {
  expect(truncateText('  One\n\n two\t three  ').text).toBe('One two three');
});

test('long text is cut on a word boundary and ends in an ellipsis', () => {
  const { text, full, truncated } = truncateText(LONG);
  expect(truncated).toBe(true);
  expect(full).toBe(LONG);
  expect(text.endsWith('…')).toBe(true);
  expect(text.length).toBeLessThanOrEqual(151);
  expect(LONG.startsWith(text.slice(0, -1))).toBe(true);
  // The character after the cut in the original is a space or punctuation.
  expect(LONG[text.length - 1]).toMatch(/[\s.,]/);
});

test('dangling punctuation is dropped before the ellipsis', () => {
  const text = `${'word '.repeat(28)}end, more words here`;
  expect(truncateText(text, 144).text).toMatch(/end…$/);
});

test('a string with no spaces is hard-cut at max', () => {
  const { text } = truncateText('x'.repeat(200));
  expect(text).toBe(`${'x'.repeat(150)}…`);
});

test('nullish input is an empty string', () => {
  expect(truncateText(undefined)).toEqual({ text: '', full: '', truncated: false });
});
