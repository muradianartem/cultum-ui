import { FIELD, buildResult, parseValue } from '../ReminderValueSheet';
import { DEFAULT_FREQUENCY_UNIT_INDEX } from '../durationUnits';

// buildResult/parseValue cover the amount fields only — `date` is picked on a
// <Calendar> now, and formats via shortDate()/parseShortDate() in
// screens/addReminderData.js, which addReminderData.test.js covers.
//
// Frequency and snooze both read their units from screens/durationUnits.js:
// FREQUENCY_UNITS is [days, weeks, months]; SNOOZE_UNITS is [None, days,
// weeks]. So the unit index for "days" is 0 on the frequency wheel and 1 on
// the snooze wheel.
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

  test('frequency uses the singular unit for a value of 1', () => {
    expect(buildResult('frequency', 0, DAYS_UNIT)).toBe('1 day');
  });

  test('snooze returns "None" for the None unit regardless of number', () => {
    expect(buildResult('snooze', 5, 0)).toBe('None');
  });

  test('snooze formats number + unit for a real unit', () => {
    // SNOOZE numbers 1..12; units [None, days, weeks].
    expect(buildResult('snooze', 1, 1)).toBe('2 days');
    expect(buildResult('snooze', 0, 2)).toBe('1 week');
  });

  test('snooze offers days and weeks only', () => {
    expect(FIELD.snooze.units.map((u) => u.plural)).toEqual(['None', 'days', 'weeks']);
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

  test('snooze parses "None" to the None unit', () => {
    const { b } = parseValue('snooze', 'None');
    expect(b).toBe(0);
  });

  test('falls back to defaults for unparseable input', () => {
    // Unparseable frequency lands on "1 day" — 'days', not the list's leading
    // 'hours', via FIELD.frequency.defaultUnitIndex.
    expect(parseValue('frequency', 'garbage')).toEqual({ a: 0, b: DAYS_UNIT });
    expect(parseValue('frequency', undefined)).toEqual({ a: 0, b: DAYS_UNIT });
    expect(buildResult('frequency', 0, DAYS_UNIT)).toBe('1 day');
  });
});
