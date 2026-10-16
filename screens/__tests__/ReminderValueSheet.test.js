import { FIELD, buildResult, parseValue } from '../ReminderValueSheet';
import { DEFAULT_FREQUENCY_UNIT_INDEX } from '../durationUnits';

// buildResult/parseValue cover the amount fields only — `date` is picked on a
// <Calendar> now, and formats via shortDate()/parseShortDate() in
// screens/addReminderData.js, which addReminderData.test.js covers.
//
// Frequency reads its units from screens/durationUnits.js: FREQUENCY_UNITS is
// [days, weeks, months], so the unit index for "days" is 0.
const DAYS_UNIT = DEFAULT_FREQUENCY_UNIT_INDEX; // 0

describe('buildResult', () => {
  test('frequency formats number + plural unit', () => {
    // FREQ numbers are 1..30 (index 6 → 7); units [days, weeks, months].
    expect(buildResult('frequency', 6, DAYS_UNIT)).toBe('7 days');
    expect(buildResult('frequency', 1, 1)).toBe('2 weeks');
  });

  test('frequency offers the units shared with the create flow', () => {
    expect(FIELD.frequency.units.map((u) => u.plural)).not.toContain('hours');
    expect(buildResult('frequency', 2, 2)).toBe('3 months');
  });

  test('frequency holds months inside 12, whatever the number wheel says', () => {
    expect(buildResult('frequency', 29, 2)).toBe('12 months');
    expect(parseValue('frequency', '18 months')).toEqual({ a: 11, b: 2 });
    expect(parseValue('frequency', '18 days')).toEqual({ a: 17, b: DAYS_UNIT });
  });

  test('frequency uses the singular unit for a value of 1', () => {
    expect(buildResult('frequency', 0, DAYS_UNIT)).toBe('1 day');
  });

  test('there is no snooze field — snoozing lives on the Today task sheet', () => {
    expect(Object.keys(FIELD)).toEqual(['date', 'frequency']);
  });
});

describe('parseValue', () => {
  test('frequency round-trips through buildResult', () => {
    const { a, b } = parseValue('frequency', '7 days');
    expect(buildResult('frequency', a, b)).toBe('7 days');
  });

  test('frequency parses a singular value', () => {
    const { a, b } = parseValue('frequency', '1 day');
    expect(buildResult('frequency', a, b)).toBe('1 day');
  });

  test('falls back to defaults for unparseable input', () => {
    // Unparseable frequency lands on "1 day" — 'days', not the list's leading
    // 'hours', via FIELD.frequency.defaultUnitIndex.
    expect(parseValue('frequency', 'garbage')).toEqual({ a: 0, b: DAYS_UNIT });
    expect(parseValue('frequency', undefined)).toEqual({ a: 0, b: DAYS_UNIT });
    expect(buildResult('frequency', 0, DAYS_UNIT)).toBe('1 day');
  });
});
