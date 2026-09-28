import {
  DEFAULT_FREQUENCY_UNIT_INDEX,
  DEFAULT_SNOOZE_UNIT_INDEX,
  FREQUENCY_NUMBERS,
  FREQUENCY_UNITS,
  MONTHS_SHORT,
  NONE_UNIT,
  SNOOZE_DURATION_UNITS,
  SNOOZE_NUMBERS,
  SNOOZE_UNITS,
  unitLabel,
} from '../durationUnits';

test('frequency units have no hours — a cadence is whole days at least', () => {
  expect(FREQUENCY_UNITS.map((u) => u.plural)).toEqual(['days', 'weeks', 'months']);
});

test('snooze units are hours plus the frequency units, behind a "None" lead', () => {
  expect(SNOOZE_UNITS[0]).toBe(NONE_UNIT);
  expect(SNOOZE_UNITS[0].plural).toBe('None');
  expect(SNOOZE_UNITS.slice(1)).toEqual(SNOOZE_DURATION_UNITS);
  expect(SNOOZE_DURATION_UNITS.map((u) => u.plural)).toEqual(['hours', 'days', 'weeks', 'months']);
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
