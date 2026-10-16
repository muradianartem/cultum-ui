import {
  DEFAULT_FREQUENCY_UNIT_INDEX,
  DEFAULT_SNOOZE_UNIT_INDEX,
  FREQUENCY_NUMBERS,
  FREQUENCY_UNITS,
  MONTHS_SHORT,
  SNOOZE_DURATION_UNITS,
  SNOOZE_NUMBERS,
  frequencyNumbers,
  unitLabel,
} from '../durationUnits';

test('frequency units have no hours — a cadence is whole days at least', () => {
  expect(FREQUENCY_UNITS.map((u) => u.plural)).toEqual(['days', 'weeks', 'months']);
});

test('snooze units are days and weeks only', () => {
  expect(SNOOZE_DURATION_UNITS.map((u) => u.plural)).toEqual(['days', 'weeks']);
  expect(SNOOZE_DURATION_UNITS[DEFAULT_SNOOZE_UNIT_INDEX].plural).toBe('days');
});

test('the default frequency unit is days', () => {
  expect(FREQUENCY_UNITS[DEFAULT_FREQUENCY_UNIT_INDEX].plural).toBe('days');
});

test('number ranges cover the designed spans', () => {
  expect(FREQUENCY_NUMBERS[0]).toBe(1);
  expect(FREQUENCY_NUMBERS.at(-1)).toBe(30);
  expect(SNOOZE_NUMBERS[0]).toBe(1);
  expect(SNOOZE_NUMBERS.at(-1)).toBe(12);
});

test('unitLabel is singular only at exactly 1', () => {
  const days = FREQUENCY_UNITS[DEFAULT_FREQUENCY_UNIT_INDEX];
  expect(unitLabel(days, 1)).toBe('day');
  expect(unitLabel(days, 0)).toBe('days');
  expect(unitLabel(days, 2)).toBe('days');
});

test('short month names are the 12 three-letter forms', () => {
  expect(MONTHS_SHORT).toHaveLength(12);
  expect(MONTHS_SHORT[0]).toBe('Jan');
  expect(MONTHS_SHORT[8]).toBe('Sep');
});

test('the months column stops at 12; days and weeks run the full 1–30', () => {
  const index = (plural) => FREQUENCY_UNITS.findIndex((u) => u.plural === plural);
  expect(frequencyNumbers(index('months')).at(-1)).toBe(12);
  expect(frequencyNumbers(index('days')).at(-1)).toBe(30);
  expect(frequencyNumbers(index('weeks')).at(-1)).toBe(30);
});
